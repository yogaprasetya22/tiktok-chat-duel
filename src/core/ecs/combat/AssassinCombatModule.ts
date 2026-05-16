// ============================================================
// ASSASSIN COMBAT MODULE (Strategy Pattern)
// ============================================================
// Primary: Burst melee (crit-enabled after Shadow Step)
// Skill:   Shadow Step — teleport to squishy enemy (Mage / MM)
// Passive: Blink (every 4s toward soft target within melee range)
// ============================================================

import { IClassCombatModule } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { calculateProcessedDamage, applySustain } from '@/src/core/logic/battle/combatProcessor';

const BLINK_COOLDOWN = 4000;

export const AssassinCombatModule: IClassCombatModule = {
  unitClass: 'assassin',

  executeAttack(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, unitIndex, vehiclePool, simNow, towerConfig, accumulateDamage, addKillEvent, updateStats, spells } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];
    if (!u.targetId || u.targetId === 'player-character') return false;

    const target = unitIndex.get(u.targetId);
    if (!target || target.isDying || !target.isActive) return false;
    const tIdx = target.poolIdx;
    const tData = unitDataPool[tIdx];
    if (!tData) return false;

    // ── Passive: Blink toward soft target ────────────────────────────────────
    const lastBlink = uData.lastBlinkTime || 0;
    if (simNow - lastBlink > BLINK_COOLDOWN) {
      if (tData.isActive && tData.id === u.targetId &&
        (tData.unitClass === 'mage' || tData.unitClass === 'marksman')) {
        const ddx = buffers.px[i] - tData.position[0];
        const ddz = buffers.pz[i] - tData.position[2];
        const dSq = ddx * ddx + ddz * ddz;
        if (dSq < 36 && dSq > 4) {
          const fwd = u.type === 'player' ? -1.8 : 1.8;
          const bx = tData.position[0]; const bz = tData.position[2] + fwd;
          const v = vehiclePool[i];
          v.position.set(bx, 0, bz);
          buffers.px[i] = bx; buffers.pz[i] = bz;
          uData.position[0] = bx; uData.position[2] = bz;
          uData.lastBlinkTime = simNow; uData.pendingCrit = true; uData.status = 'attacking';

          // Blink VFX
          const pool = spells.assassinSpellsRef.current!;
          const s = pool[spells.assassinSpellPtr.current];
          s.x = bx; s.y = 1.3; s.z = bz;
          s.startTime = simNow; s.color = '#ff00ff';
          s.active = true; s.progress = 0;
          spells.assassinSpellPtr.current = (spells.assassinSpellPtr.current + 1) % pool.length;
        }
      }
    }

    // Primary melee attack
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

    // Slash VFX
    const pool = spells.assassinSpellsRef.current!;
    const s = pool[spells.assassinSpellPtr.current];
    s.x = tData.position[0]; s.y = 1.3; s.z = tData.position[2];
    s.startTime = simNow; s.color = teamColor; s.active = true; s.progress = 0;
    s.rarity = u.rarity || 'common';
    spells.assassinSpellPtr.current = (spells.assassinSpellPtr.current + 1) % pool.length;
    return true;
  },

  executeSkill(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, vehiclePool, grid, simNow, spells } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];

    const targets = grid.queryRadius(buffers.px[i], buffers.pz[i], 40);
    let best: any = null; let minHp = Infinity;
    for (let t = 0; t < targets.length; t++) {
      const tar = targets[t];
      if (tar.type !== u.type &&
        (tar.unitClass === 'mage' || tar.unitClass === 'marksman') && !tar.isDying) {
        if (tar.hp < minHp) { minHp = tar.hp; best = tar; }
      }
    }
    if (!best) return false;

    uData.lastSkillTime = simNow;

    // Teleport VFX
    const pool = spells.assassinSpellsRef.current!;
    const s = pool[spells.assassinSpellPtr.current];
    s.active = true; s.x = buffers.px[i]; s.y = 0.5; s.z = buffers.pz[i];
    s.startTime = simNow; s.rarity = u.rarity; (s as any).isTeleport = true;
    spells.assassinSpellPtr.current = (spells.assassinSpellPtr.current + 1) % pool.length;

    const tx = best.position[0] + (Math.random() - 0.5) * 0.5;
    const tz = best.position[2] + (u.type === 'player' ? 1.5 : -1.5);
    const v = vehiclePool[i];
    v.position.set(tx, -0.4, tz);
    buffers.px[i] = tx; buffers.pz[i] = tz;
    uData.position[0] = tx; uData.position[2] = tz;
    u.targetId = best.id; uData.targetId = best.id;
    (uData as any).isRolling = true; (uData as any).rollEndTime = simNow + 400;
    return true;
  },
};
