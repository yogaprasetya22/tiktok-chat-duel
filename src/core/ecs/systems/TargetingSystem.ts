// ============================================================
// TARGETING SYSTEM
// ============================================================
// Responsible for assigning u.targetId to each active unit.
// - Enemy: prefers player-character, then weakest/nearest enemy
// - Player unit: finds nearest enemy unit
// - Implements de-aggro: clears targetId when player moves too far
// - Zero allocation: uses SpatialGrid query (returns pooled array)
// ============================================================

import { ISystem } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { CLASS_CONFIG } from '@/src/core/logic/combat/constants';

const PLAYER_CHAR_TARGET = 'player-character';
const DEAGGRO_DIST_SQ = 45 * 45;

export const TargetingSystem: ISystem = {
  update(ctx: SimulationContext): void {
    const {
      simNow, unitPool, unitDataPool, buffers, grid,
      activeIndices, playerCharPos,
    } = ctx;

    const { px: _px, pz: _pz, vh: _vh } = buffers;
    const uPool = unitPool;
    const uiPool = unitDataPool;

    for (let k = 0; k < activeIndices.length; k++) {
      const i = activeIndices[k];
      const u = uPool[i];
      const uData = uiPool[i];

      if (!u.isActive || u.isDying || _vh[i] <= 0) continue;

      const isEnemy = u.type === 'enemy';
      const isAggroed = uData.isAggroed;
      const thinkThrottle = u.unitClass === 'assassin' ? 60 : u.unitClass === 'fighter' ? 120 : 180;
      const phaseOffset = i % 24;
      const frameCheck = isAggroed
        ? true
        : (Math.floor(simNow / 16) + phaseOffset) % 24 === 0;

      if (!frameCheck && simNow - (u.lastThinkTime || 0) < (isAggroed ? 16 : thinkThrottle)) {
        continue;
      }
      u.lastThinkTime = simNow;

      // ── DE-AGGRO: Enemy that was chasing player, check range ─────────────
      if (isEnemy && uData.isAggroed && u.targetId === PLAYER_CHAR_TARGET && playerCharPos) {
        const dx = _px[i] - playerCharPos[0];
        const dz = _pz[i] - playerCharPos[2];
        if (dx * dx + dz * dz > DEAGGRO_DIST_SQ) {
          uData.isAggroed = false;
          u.targetId = undefined;
          uData.targetId = undefined;
          uData.status = 'idling';
          uData.patrolTarget = undefined;
          uData.patrolWaitUntil = simNow + 2000;
          continue;
        }
      }

      // ── ENEMY: Player-character is high priority ──────────────────────────
      if (isEnemy && playerCharPos) {
        const dx = _px[i] - playerCharPos[0];
        const dz = _pz[i] - playerCharPos[2];
        const dSq = dx * dx + dz * dz;
        const cfg = CLASS_CONFIG[u.unitClass];
        const perceptionSq = cfg.ai_behavior.perception_radius;
        
        // If already aggroed on player, stay on player unless very far
        const isAlreadyOnPlayer = u.targetId === PLAYER_CHAR_TARGET;
        const searchRange = isAlreadyOnPlayer ? perceptionSq * 1.5 : perceptionSq;

        if (dSq < searchRange) {
          if (!isAlreadyOnPlayer) {
            u.targetId = PLAYER_CHAR_TARGET;
            uData.targetId = PLAYER_CHAR_TARGET;
            uData.isAggroed = true;
          }
          continue; 
        } else if (isAlreadyOnPlayer) {
          // Lost player, clear target to re-scan units
          u.targetId = undefined;
          uData.targetId = undefined;
        }
      }

      // ── SPATIAL SCAN: Find best unit target ───────────────────────────────
      const searchR = u.unitClass === 'marksman' || u.unitClass === 'mage' ? 30 : 20;
      const neighbors = grid.queryRadius(_px[i], _pz[i], searchR);

      let bestScore = -1;
      let bestTargetId: string | undefined = undefined;

      for (let n = 0; n < neighbors.length; n++) {
        const p = neighbors[n];
        if (p.type === u.type || p.isDying || !p.isActive) continue;
        if (!isAggroed && p.targetId !== u.id) continue;

        const dx = _px[i] - p.position[0];
        const dz = _pz[i] - p.position[2];
        const dSq = dx * dx + dz * dz;

        // Scoring: closer = better, boss/fighter premium
        let weight = 1.0;
        if (p.unitClass === 'fighter') weight = 3.0;
        if (p.isBoss) weight = 2.0;
        if (p.targetId === PLAYER_CHAR_TARGET) weight *= 30.0;

        const score = weight / (dSq + 0.1);
        if (score > bestScore) {
          bestScore = score;
          bestTargetId = p.id;
        }
      }

      if (bestTargetId !== undefined) {
        u.targetId = bestTargetId;
        uData.targetId = bestTargetId;
        uData.status = 'chasing';
      } else if (isEnemy) {
        // No target found — return to patrol
        u.targetId = undefined;
        uData.targetId = undefined;
        uData.status = 'idling';
      }
    }
  },
};
