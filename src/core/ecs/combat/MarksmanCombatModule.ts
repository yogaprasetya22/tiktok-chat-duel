// ============================================================
// MARKSMAN COMBAT MODULE (Strategy Pattern)
// ============================================================
// Primary: Predictive-aim bullet (Lead Shooting)
// Skill:   Eagle Eye — 5-round sniper burst with finisher bonus
// ============================================================

import { IClassCombatModule } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { calculateProcessedDamage, applySustain } from '@/src/core/logic/battle/combatProcessor';

const BASIC_BULLET_SPEED = 110.0;
const SNIPER_BULLET_SPEED = 55.0;

export const MarksmanCombatModule: IClassCombatModule = {
  unitClass: 'marksman',

  executeAttack(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, unitIndex, vehiclePool, simNow, towerConfig, accumulateDamage, addKillEvent, updateStats, spells } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];

    // Sniper Burst (buffed / Eagle Eye state)
    if (uData.isBuffed) {
      const sCount = (uData as any).sniperCount || 0;
      const lastS = (uData as any).lastSniperTime || 0;
      const delay = sCount === 4 ? 1500 : 800;
      if (simNow - lastS < delay || sCount >= 5) return false;

      (uData as any).sniperCount = sCount + 1;
      (uData as any).lastSniperTime = simNow;
      uData.lastAttackTime = simNow;

      const tPoolIdx = (uData as any).sniperTargetPoolIdx;
      const tData = tPoolIdx !== undefined && tPoolIdx >= 0 ? unitDataPool[tPoolIdx] : null;
      let tPos: [number, number, number] | null = null;
      let tId = (uData as any).sniperTargetId as string;

      if (tData?.isActive && !tData.isDying && tData.id === tId) {
        tPos = tData.position as [number, number, number];
      } else {
        // Re-acquire target
        const nearby = ctx.grid.queryRadius(buffers.px[i], buffers.pz[i], 35);
        for (let t2 = 0; t2 < nearby.length; t2++) {
          const nt = nearby[t2];
          if (nt.type !== u.type && nt.isActive && !nt.isDying) {
            tId = nt.id; u.targetId = nt.id; uData.targetId = nt.id;
            (uData as any).sniperTargetId = nt.id; (uData as any).sniperTargetPoolIdx = nt.poolIdx;
            const ntData = unitDataPool[nt.poolIdx];
            if (ntData) tPos = ntData.position as [number, number, number];
            break;
          }
        }
      }
      if (!tPos) return false;

      const teamColor = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
      const pool = spells.mmSpellsRef.current!;
      const s = pool[spells.mmSpellPtr.current];
      s.active = true; s.startTime = simNow;
      s.fromX = buffers.px[i]; s.fromY = 1.2; s.fromZ = buffers.pz[i];
      s.toX = tPos[0]; s.toY = tPos[1] + 1.2; s.toZ = tPos[2];
      s.color = teamColor; s.rarity = u.rarity;
      s.isBullet = true; (s as any).isSniper = true;
      (s as any).targetId = tId; (s as any).targetPoolIdx = tPoolIdx;
      (s as any).isFinisher = sCount + 1 === 5;
      (s as any).sniperSpeed = SNIPER_BULLET_SPEED;
      spells.mmSpellPtr.current = (spells.mmSpellPtr.current + 1) % pool.length;

      // Apply damage
      const targetUnit = unitIndex.get(tId);
      const targetPoolIdxResolved = targetUnit?.poolIdx ?? -1;
      const targetDataResolved = targetPoolIdxResolved >= 0 ? unitDataPool[targetPoolIdxResolved] : null;
      if (targetUnit && targetDataResolved && !targetUnit.isShield) {
        const dmg = u.attack * (sCount + 1 === 5 ? 5.0 : 1.8);
        const newHp = Math.max(0, buffers.vh[targetPoolIdxResolved] - dmg);
        buffers.vh[targetPoolIdxResolved] = newHp;
        targetUnit.hp = newHp; targetDataResolved.hp = newHp;
        accumulateDamage(tId, dmg, tPos, teamColor, simNow);
      }

      if (sCount + 1 >= 5) {
        uData.isBuffed = false; u.isBuffed = false;
        (uData as any).sniperCount = 0;
      }
      return true;
    }

    // Basic Attack (predictive aiming)
    if (!u.targetId || u.targetId === 'player-character') return false;
    const target = unitIndex.get(u.targetId);
    // STRICTOR CHECK: Must be active, not dying, and not already removed from pool
    if (!target || target.isDying || !target.isActive || target.hp <= 0) {
      u.targetId = undefined;
      uData.targetId = undefined;
      return false;
    }
    const tIdx = target.poolIdx;
    const tData = unitDataPool[tIdx];
    if (!tData || tData.id !== u.targetId) return false;

    const { dmg, isCrit } = calculateProcessedDamage(u, target, !!uData.pendingCrit);
    if (isCrit) uData.pendingCrit = false;
    applySustain(u, uData, dmg, buffers.vh, i);

    buffers.vh[tIdx] -= dmg; tData.hp = buffers.vh[tIdx]; tData.isAggroed = true; target.hp = buffers.vh[tIdx];
    if (buffers.vh[tIdx] <= 0) {
      addKillEvent(u.userName, target.userName, target.isBoss ? 'boss' : 'unit', u.profileImage, target.rarity);
      updateStats(u.userName, u.type, 0, true);
    }
    updateStats(u.userName, u.type, dmg);

    const teamColor = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
    accumulateDamage(target.id, dmg, tData.position, teamColor, simNow);

    // Lead Shooting
    let txP = tData.position[0], tzP = tData.position[2];
    const tVeh = vehiclePool[tIdx];
    if (tVeh?.velocity.squaredLength() > 0.05) {
      const dist = Math.sqrt((buffers.px[i] - txP) ** 2 + (buffers.pz[i] - tzP) ** 2);
      const tHit = dist / BASIC_BULLET_SPEED;
      txP += tVeh.velocity.x * tHit; tzP += tVeh.velocity.z * tHit;
    }

    const fwdX = (txP - uData.position[0]) / (Math.sqrt((txP - uData.position[0]) ** 2 + (tzP - uData.position[2]) ** 2) || 1);
    const fwdZ = (tzP - uData.position[2]) / (Math.sqrt((txP - uData.position[0]) ** 2 + (tzP - uData.position[2]) ** 2) || 1);
    const pool = spells.mmSpellsRef.current!;
    const s = pool[spells.mmSpellPtr.current];
    s.fromX = uData.position[0] + fwdX * 2.5; s.fromY = uData.position[1] + 1.8; s.fromZ = uData.position[2] + fwdZ * 2.5;
    s.toX = txP; s.toY = tData.position[1] + 1.2; s.toZ = tzP;
    s.targetId = target.id; (s as any).targetPoolIdx = tIdx;
    s.startTime = simNow; s.color = teamColor; s.active = true; s.progress = 0;
    s.isBullet = true; s.isMeteor = false; (s as any).isRolling = false; (s as any).isTeleport = false;
    s.isShield = false; s.rarity = u.rarity || 'common';
    (s as any).bulletSpeed = BASIC_BULLET_SPEED; (s as any)._tIdx = undefined;
    spells.mmSpellPtr.current = (spells.mmSpellPtr.current + 1) % pool.length;
    return true;
  },

  executeSkill(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, grid, simNow } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];

    const targets = grid.queryRadius(buffers.px[i], buffers.pz[i], 30);
    let best: any = null; let minDSq = Infinity;
    for (let t = 0; t < targets.length; t++) {
      const tar = targets[t];
      const dx = buffers.px[i] - tar.position[0];
      const dz = buffers.pz[i] - tar.position[2];
      const dSq = dx * dx + dz * dz;
      if (tar.type !== u.type && !tar.isDying && dSq < minDSq) { minDSq = dSq; best = tar; }
    }
    if (!best) return false;

    uData.lastSkillTime = simNow;
    uData.isBuffed = true; u.isBuffed = true;
    u.targetId = best.id; uData.targetId = best.id;
    (uData as any).sniperCount = 0; (uData as any).lastSniperTime = 0;
    (uData as any).buffEndTime = simNow + 8000;
    (uData as any).sniperTargetId = best.id; (uData as any).sniperTargetPoolIdx = best.poolIdx;
    return true;
  },
};
