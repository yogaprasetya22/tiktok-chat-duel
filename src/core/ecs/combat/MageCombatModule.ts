// ============================================================
// MAGE COMBAT MODULE (Strategy Pattern)
// ============================================================
// Primary: Single target magic bolt + AoE chain (up to 4 targets)
// Skill:   Meteor Rain — launches multiple arcing projectiles
// ============================================================

import { IClassCombatModule } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { calculateProcessedDamage, applySustain } from '@/src/core/logic/battle/combatProcessor';
import { CLASS_CONFIG } from '@/src/core/logic/combat/constants';

const AOE_BOUNCE_RADIUS = 3.5;
const MAX_BOUNCE_TARGETS = 4;

export const MageCombatModule: IClassCombatModule = {
  unitClass: 'mage',

  executeAttack(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, unitIndex, grid, simNow, towerConfig, accumulateDamage, addKillEvent, updateStats, spells } = ctx;
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

    const teamColor = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
    const launchY = uData.position[1] + 1.8;

    // Primary target
    buffers.vh[tIdx] -= dmg;
    tData.hp = buffers.vh[tIdx]; tData.isAggroed = true; target.hp = buffers.vh[tIdx];
    if (buffers.vh[tIdx] <= 0) {
      addKillEvent(u.userName, target.userName, target.isBoss ? 'boss' : 'unit', u.profileImage, target.rarity);
      updateStats(u.userName, u.type, 0, true);
    }
    updateStats(u.userName, u.type, dmg);
    accumulateDamage(target.id, dmg, tData.position, teamColor, simNow);

    // Launch primary spell projectile
    const pool = spells.spellsRef.current!;
    const s = pool[spells.mageSpellPtr.current];
    s.fromX = uData.position[0]; s.fromY = launchY; s.fromZ = uData.position[2];
    s.toX = tData.position[0]; s.toY = tData.position[1] + 1.0; s.toZ = tData.position[2];
    s.targetId = target.id; s.startTime = simNow; s.color = teamColor;
    s.active = true; s.progress = 0; s.rarity = u.rarity || 'common';
    s.isMeteor = false; s.isBullet = false; (s as any)._tIdx = undefined;
    spells.mageSpellPtr.current = (spells.mageSpellPtr.current + 1) % pool.length;

    // AoE Bounce: hit nearby enemies
    const aoeNearby = grid.queryRadius(tData.position[0], tData.position[2], AOE_BOUNCE_RADIUS);
    let hits = 0;
    for (let j = 0; j < aoeNearby.length && hits < MAX_BOUNCE_TARGETS; j++) {
      const p = aoeNearby[j];
      if (p.id === target.id || p.type === u.type || p.isDying || !p.isActive) continue;
      const pIdx = p.poolIdx;
      const pData = unitDataPool[pIdx];
      const pUnit = unitIndex.get(p.id);
      if (!pData || !pUnit) continue;
      if (pUnit.isShield) {
        accumulateDamage(p.id, 0, p.position, '#FFFFFF', simNow);
      } else {
        buffers.vh[pIdx] -= dmg;
        pData.hp = buffers.vh[pIdx];
        if (buffers.vh[pIdx] <= 0) {
          addKillEvent(u.userName, p.userName, p.isBoss ? 'boss' : 'unit', u.profileImage, p.rarity);
          updateStats(u.userName, u.type, 0, true);
        }
        updateStats(u.userName, u.type, dmg);
        accumulateDamage(p.id, dmg, p.position, teamColor, simNow);

        // Chain spell VFX
        const cs = pool[spells.mageSpellPtr.current];
        cs.fromX = uData.position[0]; cs.fromY = launchY; cs.fromZ = uData.position[2];
        cs.toX = pData.position[0]; cs.toY = pData.position[1] + 1.0; cs.toZ = pData.position[2];
        cs.targetId = p.id; cs.startTime = simNow; cs.color = teamColor;
        cs.active = true; cs.progress = 0; cs.rarity = u.rarity || 'common';
        cs.isMeteor = false; cs.isBullet = false; (cs as any)._tIdx = undefined;
        spells.mageSpellPtr.current = (spells.mageSpellPtr.current + 1) % pool.length;
        hits++;
      }
    }
    return true;
  },

  executeSkill(i: number, ctx: SimulationContext): boolean {
    const { unitPool, unitDataPool, buffers, grid, simNow, towerConfig, spells } = ctx;
    const u = unitPool[i];
    const uData = unitDataPool[i];
    const cfg = CLASS_CONFIG['mage'];

    const targets = grid.queryRadius(buffers.px[i], buffers.pz[i], cfg.skill_range || 12.0);
    if (targets.length === 0) return false;

    uData.lastSkillTime = simNow;
    const teamColor = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
    const launchY = uData.position[1] + 2.2;
    const pool = spells.spellsRef.current!;

    let launched = 0;
    for (let t = 0; t < targets.length && launched < 6; t++) {
      const tar = targets[t];
      if (tar.type === u.type || tar.isDying || !tar.isActive) continue;
      const tData = unitDataPool[tar.poolIdx];
      if (!tData) continue;

      const s = pool[spells.mageSpellPtr.current];
      s.fromX = uData.position[0]; s.fromY = launchY; s.fromZ = uData.position[2];
      s.toX = tData.position[0]; s.toY = tData.position[1] + 0.5; s.toZ = tData.position[2];
      s.targetId = tar.id; s.startTime = simNow; s.color = teamColor;
      s.active = true; s.progress = 0; s.rarity = u.rarity || 'common';
      s.isMeteor = true; s.isBullet = false;
      (s as any).attackPower = u.attack; (s as any).iceDmgMult = 5.5; (s as any).ownerType = u.type;
      (s as any)._tIdx = undefined;
      spells.mageSpellPtr.current = (spells.mageSpellPtr.current + 1) % pool.length;
      launched++;
    }
    return launched > 0;
  },
};
