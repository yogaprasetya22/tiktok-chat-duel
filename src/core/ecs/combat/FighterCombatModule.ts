// ============================================================
// FIGHTER COMBAT MODULE (Strategy Pattern)
// ============================================================
// Primary: Melee slash (AoE via Cyclone)
// Skill:   Cyclone Slash — AoE around self, damages all nearby enemies
// ============================================================

import { IClassCombatModule } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { calculateProcessedDamage, applySustain } from '@/src/core/logic/battle/combatProcessor';
import { CLASS_CONFIG } from '@/src/core/logic/combat/constants';

export const FighterCombatModule: IClassCombatModule = {
  unitClass: 'fighter',

  executeAttack(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, unitIndex, simNow, towerConfig, accumulateDamage, addKillEvent, updateStats, spells } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];
    if (!u.targetId || u.targetId === 'player-character') return false;

    const target = unitIndex.get(u.targetId);
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

    buffers.vh[tIdx] -= dmg;
    tData.hp = buffers.vh[tIdx];
    tData.isAggroed = true;
    target.hp = buffers.vh[tIdx];

    if (buffers.vh[tIdx] <= 0) {
      addKillEvent(u.userName, target.userName, target.isBoss ? 'boss' : 'unit', u.profileImage, target.rarity);
      updateStats(u.userName, u.type, 0, true);
    }
    updateStats(u.userName, u.type, dmg);

    const teamColor = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
    accumulateDamage(target.id, dmg, tData.position, teamColor, simNow);

    // VFX: slash effect toward target
    const pool = spells.fighterSpellsRef.current!;
    const s = pool[spells.fighterSpellPtr.current];
    s.x = tData.position[0]; s.y = 1.2; s.z = tData.position[2];
    s.targetX = tData.position[0]; s.targetZ = tData.position[2];
    const dx = tData.position[0] - uData.position[0];
    const dz = tData.position[2] - uData.position[2];
    const len = Math.sqrt(dx * dx + dz * dz) || 1;
    s.rotation = Math.atan2(dx / len, dz / len);
    s.startTime = simNow; s.color = teamColor;
    s.active = true; s.progress = 0;
    (s as any).isCyclone = false; (s as any)._tIdx = undefined;
    spells.fighterSpellPtr.current = (spells.fighterSpellPtr.current + 1) % pool.length;

    return true;
  },

  executeSkill(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, grid, simNow, towerConfig, accumulateDamage, addKillEvent, updateStats, spells } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];
    const cfg = CLASS_CONFIG['fighter'];

    const targets = grid.queryRadius(buffers.px[i], buffers.pz[i], cfg.skill_range || 4.0);
    let hit = false;

    for (let t = 0; t < targets.length; t++) {
      const tar = targets[t];
      if (tar.type === u.type || tar.isDying || !tar.isActive) continue;
      const tIdx = tar.poolIdx;
      const tData = unitDataPool[tIdx];
      if (!tData) continue;

      const dmg = u.attack * 1.5;
      buffers.vh[tIdx] -= dmg;
      tData.hp = buffers.vh[tIdx];
      tData.isAggroed = true;

      const teamColor = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
      accumulateDamage(tar.id, dmg, tData.position, teamColor, simNow);
      if (buffers.vh[tIdx] <= 0) {
        addKillEvent(u.userName, tar.userName, tar.isBoss ? 'boss' : 'unit', u.profileImage, tar.rarity);
        updateStats(u.userName, u.type, 0, true);
      }
      updateStats(u.userName, u.type, dmg);
      hit = true;
    }

    if (hit) {
      uData.lastSkillTime = simNow;
      // VFX: cyclone
      const pool = spells.fighterSpellsRef.current!;
      const s = pool[spells.fighterSpellPtr.current];
      s.x = buffers.px[i]; s.y = 0.8; s.z = buffers.pz[i];
      s.targetX = buffers.px[i]; s.targetZ = buffers.pz[i];
      s.rotation = 0; s.startTime = simNow;
      s.color = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
      s.active = true; s.progress = 0;
      (s as any).isCyclone = true;
      spells.fighterSpellPtr.current = (spells.fighterSpellPtr.current + 1) % pool.length;
    }

    return hit;
  },
};
