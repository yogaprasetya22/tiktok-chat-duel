// ============================================================
// TANK COMBAT MODULE (Strategy Pattern)
// ============================================================
// Primary: Heavy melee strike
// Skill:   Fortress Guard — damage shield for 3.5s
// ============================================================

import { IClassCombatModule } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { calculateProcessedDamage, applySustain } from '@/src/core/logic/battle/combatProcessor';

export const TankCombatModule: IClassCombatModule = {
  unitClass: 'tank',

  executeAttack(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, unitIndex, simNow, towerConfig, accumulateDamage, addKillEvent, updateStats, spells } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];
    if (!u.targetId || u.targetId === 'player-character') return false;

    const target = unitIndex.get(u.targetId);
    if (!target || target.isDying || !target.isActive) return false;
    const tIdx = target.poolIdx;
    const tData = unitDataPool[tIdx];
    if (!tData) return false;

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

    // VFX: shield bash
    const pool = spells.fighterSpellsRef.current!;
    const s = pool[spells.fighterSpellPtr.current];
    s.x = tData.position[0]; s.y = 1.2; s.z = tData.position[2];
    s.targetX = tData.position[0]; s.targetZ = tData.position[2]; s.rotation = 0;
    s.startTime = simNow; s.color = teamColor; s.active = true; s.progress = 0;
    (s as any).isCyclone = false; (s as any)._tIdx = undefined;
    spells.fighterSpellPtr.current = (spells.fighterSpellPtr.current + 1) % pool.length;
    return true;
  },

  executeSkill(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, simNow, spells } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];
    if (u.hp >= u.maxHp * 0.6) return false; // Only activate when damaged

    uData.lastSkillTime = simNow;
    u.isShield = true; uData.isShield = true;
    (uData as any).shieldEndTime = simNow + 3500;

    const pool = spells.tankSpellsRef.current!;
    const s = pool[spells.tankSpellPtr.current];
    s.active = true; s.x = buffers.px[i]; s.z = buffers.pz[i];
    s.startTime = simNow; s.rarity = u.rarity; (s as any).isShield = true;
    spells.tankSpellPtr.current = (spells.tankSpellPtr.current + 1) % pool.length;
    return true;
  },
};
