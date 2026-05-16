// ============================================================
// DAMAGE RESOLUTION SYSTEM
// ============================================================
// Handles:
// - Attack-range checks (unit vs unit, unit vs player character)
// - Dispatches to Class Combat Module via executeAttack()
// - Spell impact processing (Mage meteors)
// - Tactical effects: Medical Supply, Orbital Lightning
// ============================================================

import { ISystem } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { IClassCombatModule } from '@/src/core/ecs/ISystem';
import { CLASS_CONFIG } from '@/src/core/logic/combat/constants';

const PLAYER_CHAR_TARGET = 'player-character';

// ── Class module registry (populated by BattleOrchestrator at init) ──────────
const _classModules = new Map<string, IClassCombatModule>();

export function registerCombatModule(module: IClassCombatModule): void {
  _classModules.set(module.unitClass, module);
}

export const DamageResolutionSystem: ISystem = {
  update(ctx: SimulationContext): void {
    const {
      simNow, unitPool, unitDataPool, vehiclePool, buffers,
      unitIndex, activeIndices, playerCharPos, towerConfig,
      feverCooldownMult, accumulateDamage,
    } = ctx;

    const { px: _px, pz: _pz, vh: _vh, vmh: _vmh } = buffers;
    const uPool = unitPool;
    const uiPool = unitDataPool;
    const vPool = vehiclePool;

    for (let k = 0; k < activeIndices.length; k++) {
      const i = activeIndices[k];
      const u = uPool[i];
      const uData = uiPool[i];
      const v = vPool[i];

      if (!u.isActive || u.isDying || _vh[i] <= 0) continue;

      const isPlayerCharTarget = u.targetId === PLAYER_CHAR_TARGET;
      const cfg = CLASS_CONFIG[u.unitClass];
      const skillRange = uData.isBuffed ? u.range * 1.5 : u.range;
      const rangeSq = skillRange * skillRange;

      // ── Buff/status expiry ────────────────────────────────────────────────
      if (uData.isBuffed && simNow > ((uData as any).buffEndTime || 0)) {
        uData.isBuffed = false; u.isBuffed = false;
      }
      if ((uData as any).isRolling && simNow > ((uData as any).rollEndTime || 0)) {
        (uData as any).isRolling = false;
      }
      if (uData.isShield && simNow > ((uData as any).shieldEndTime || 0)) {
        uData.isShield = false; u.isShield = false;
      }

      // ── Skill cooldown check: delegate to class module ────────────────────
      {
        const cooldown = ((cfg as any).skill_cooldown || 1000) * (1 - u.cooldownReduction);
        if (simNow - (uData.lastSkillTime || 0) >= cooldown && !u.isDying) {
          const mod = _classModules.get(u.unitClass);
          if (mod) mod.executeSkill(i, ctx);
        }
      }

      // ── Marksman Sniper Burst (buffed state) ──────────────────────────────
      if (uData.isBuffed && u.unitClass === 'marksman' && !u.isDying) {
        uData.status = 'attacking';
        const mod = _classModules.get('marksman');
        if (mod) mod.executeAttack(i, ctx);
        continue;
      }

      // ── Unit vs Player Character ──────────────────────────────────────────
      if (isPlayerCharTarget && playerCharPos) {
        const pcDx = _px[i] - playerCharPos[0];
        const pcDz = _pz[i] - playerCharPos[2];
        const pcInRange = (pcDx * pcDx + pcDz * pcDz) < rangeSq * 1.15;

        if (pcInRange) {
          uData.status = 'attacking';
          v.maxSpeed = 0;
          const currentCooldown = (u.attackCooldown * 0.7) * feverCooldownMult;
          const isFirstStrike = !uData.lastAttackTime;
          if (isFirstStrike || simNow - (uData.lastAttackTime || 0) > currentCooldown) {
            const dmg = u.attack * 0.5;
            // Player character damage is tracked in BattleOrchestrator via callback
            ctx.accumulateDamage(
              PLAYER_CHAR_TARGET,
              dmg,
              [playerCharPos[0], playerCharPos[1] + 1.5, playerCharPos[2]],
              towerConfig.enemy.color,
              simNow,
            );
            uData.lastAttackTime = simNow;

            // VFX: delegate to class module
            const mod = _classModules.get(u.unitClass);
            if (mod) mod.executeAttack(i, ctx);
          }
        } else {
          uData.status = 'chasing';
        }
        continue;
      }

      // ── Unit vs Unit ──────────────────────────────────────────────────────
      if (!u.targetId) continue;
      const currentTarget = unitIndex.get(u.targetId);
      if (!currentTarget || !currentTarget.isActive || currentTarget.isDying) {
        u.targetId = undefined;
        uData.targetId = undefined;
        continue;
      }

      const tIdx = currentTarget.poolIdx;
      const tData = uiPool[tIdx];
      if (!tData) continue;

      const dxT = _px[i] - tData.position[0];
      const dzT = _pz[i] - tData.position[2];
      const dSq = dxT * dxT + dzT * dzT;

      if (dSq < rangeSq) {
        uData.status = 'attacking';
        v.maxSpeed = (uData as any).isRolling ? u.speed * 4.0 : 0;

        const currentCooldown = u.attackCooldown * feverCooldownMult;
        if (simNow - (uData.lastAttackTime || 0) > currentCooldown) {
          const mod = _classModules.get(u.unitClass);
          if (mod) mod.executeAttack(i, ctx);
          uData.lastAttackTime = simNow;
        }
      } else {
        if (uData.status !== 'chasing') uData.status = 'chasing';
      }
    }

    // ── Mage Meteor Impact Resolution (delayed AoE) ───────────────────────────
    const sPool = ctx.spells.spellsRef.current!;
    for (let si = 0; si < sPool.length; si++) {
      const s = sPool[si];
      if (!s.active || !s.isMeteor) continue;
      const age = simNow - s.startTime;
      if (age >= 800) {
        s.active = false;
        const aoeRadius = 3.0;
        const aoeTargets = ctx.grid.queryRadius(s.toX, s.toZ, aoeRadius);
        const attackPower = (s as any).attackPower || 100;
        const dmg = attackPower * ((s as any).iceDmgMult || 5.5);
        const ownerType = (s as any).ownerType;

        for (let ti = 0; ti < aoeTargets.length; ti++) {
          const target = aoeTargets[ti];
          if (target.type === ownerType || target.isDying || !target.isActive) continue;
          const tIdx = target.poolIdx;
          if (tIdx < 0) continue;
          const tUnit = unitIndex.get(target.id);
          if (tUnit?.isShield) {
            accumulateDamage(target.id, 0, target.position, '#FFFFFF', simNow);
          } else {
            const { vh: _vh2 } = buffers;
            _vh2[tIdx] -= dmg;
            const td = uiPool[tIdx];
            if (td && tUnit) {
              td.hp = _vh2[tIdx]; td.isAggroed = true; tUnit.hp = _vh2[tIdx];
              accumulateDamage(
                target.id, dmg, target.position,
                ownerType === 'player' ? ctx.towerConfig.player.color : ctx.towerConfig.enemy.color,
                simNow,
              );
            }
          }
        }
      }
    }
  },
};
