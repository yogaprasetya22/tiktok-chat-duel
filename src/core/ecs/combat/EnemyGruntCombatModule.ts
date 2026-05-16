// ============================================================
// ENEMY COMBAT MODULE (Strategy Pattern)
// ============================================================
// Primary: Basic melee attack (Monster bite/punch)
// Skill: Ground smash or roar
// ============================================================

import { IClassCombatModule } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { calculateProcessedDamage } from '@/src/core/logic/battle/combatProcessor';
import { CLASS_CONFIG } from '@/src/core/logic/combat/constants';

export const EnemyGruntCombatModule: IClassCombatModule = {
  unitClass: 'enemy_grunt',

  executeAttack(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, unitIndex, simNow, towerConfig, accumulateDamage, addKillEvent, updateStats } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];
    if (!u.targetId) return false;

    // Special case for hitting player character
    if (u.targetId === 'player-character') {
      // Logic for hitting player is handled by DamageResolutionSystem's hardcoded check
      // But we can trigger an attack animation or log here if we wanted
      return true;
    }

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

    buffers.vh[tIdx] -= dmg;
    tData.hp = buffers.vh[tIdx];
    tData.isAggroed = true;
    target.hp = buffers.vh[tIdx];

    if (buffers.vh[tIdx] <= 0) {
      addKillEvent(u.userName, target.userName, target.isBoss ? 'boss' : 'unit', u.profileImage, target.rarity);
      updateStats(u.userName, u.type, 0, true);
    }
    updateStats(u.userName, u.type, dmg);

    const teamColor = towerConfig.enemy.color;
    accumulateDamage(target.id, dmg, tData.position, teamColor, simNow);

    return true;
  },

  executeSkill(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, grid, simNow, towerConfig, accumulateDamage, addKillEvent, updateStats } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];
    const cfg = CLASS_CONFIG['enemy_grunt'];

    const targets = grid.queryRadius(buffers.px[i], buffers.pz[i], cfg.skill_range || 4.5);
    let hit = false;

    for (let t = 0; t < targets.length; t++) {
      const tar = targets[t];
      if (tar.type === u.type || tar.isDying || !tar.isActive || tar.hp <= 0) continue;
      const tIdx = tar.poolIdx;
      const tData = unitDataPool[tIdx];
      if (!tData) continue;

      const dmg = u.attack * 1.2; // Small AoE smash
      buffers.vh[tIdx] -= dmg;
      tData.hp = buffers.vh[tIdx];
      tData.isAggroed = true;
      tar.hp = buffers.vh[tIdx];

      accumulateDamage(tar.id, dmg, tData.position, towerConfig.enemy.color, simNow);
      if (buffers.vh[tIdx] <= 0) {
        addKillEvent(u.userName, tar.userName, tar.isBoss ? 'boss' : 'unit', u.profileImage, tar.rarity);
        updateStats(u.userName, u.type, 0, true);
      }
      updateStats(u.userName, u.type, dmg);
      hit = true;
    }

    if (hit) {
      uData.lastSkillTime = simNow;
      // Optional: Emit a ground smash effect
    }
    return hit;
  }
};
