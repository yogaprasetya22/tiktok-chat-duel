// ============================================================
// MOVEMENT SYSTEM
// ============================================================
// Responsible for:
// - Patrol AI (idle state, random waypoint, stuck timeout)
// - Chase state (seek toward target or player character)
// - Velocity damping + terrain elevation snapping
// - Rotation smoothing
// Zero allocation: all scratch vectors are module-level constants.
// ============================================================

import { ISystem } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { getTerrainElevation } from '@/src/core/utils/terrainHeight';
import { getGroundHeight } from '@/src/core/utils/globalRaycaster';

const PLAYER_CHAR_TARGET = 'player-character';

// ── Scratch constants (module-level, never GC'd) ──────────────────────────────
const PATROL_RADIUS_MIN = 4;
const PATROL_RADIUS_MAX = 24;
const PATROL_ARRIVE_DIST_SQ = 2.5; // Closer arrival
const PATROL_TIMEOUT_MS = 6000;    // Faster timeout if stuck
const PATROL_WAIT_MIN = 3000;     // Longer idle
const PATROL_WAIT_RAND = 4000;
const WORLD_BOUNDARY = 45;
const ROT_SMOOTH = 0.12;
const VELOCITY_DAMPING = 0.9;

// Mage kiting distance squared (7m radius)
const MAGE_KITE_DIST_SQ = 49;
// Marksman orbit max range squared (80m)
const MM_ORBIT_RANGE_SQ = 80 * 80;

export const MovementSystem: ISystem = {
  update(ctx: SimulationContext): void {
    const {
      simNow, simDelta, unitPool, unitDataPool, vehiclePool,
      buffers, unitIndex, activeIndices, playerCharPos,
      weatherMults, feverSpeedMult, globalSpeedMult, towerConfig,
    } = ctx;

    const { px: _px, py: _py, pz: _pz, vh: _vh } = buffers;
    const uPool = unitPool;
    const uiPool = unitDataPool;
    const vPool = vehiclePool;

    for (let k = 0; k < activeIndices.length; k++) {
      const i = activeIndices[k];
      const u = uPool[i];
      const uData = uiPool[i];
      const v = vPool[i];

      if (!u.isActive || u.isDying || _vh[i] <= 0) continue;

      const isPatrolling = u.type === 'enemy' && !u.targetId;
      const isPlayerCharTarget = u.targetId === PLAYER_CHAR_TARGET;

      // ── Patrol State ─────────────────────────────────────────────────────
      if (isPatrolling && !(uData.isBuffed && u.unitClass === 'marksman')) {
        const seek = (v.steering.behaviors[0] as any);
        if (!seek?.target) { /* no seek behavior — skip movement */ continue; }

        // ── Idle wait phase ───────────────────────────────────────────────
        if (uData.patrolWaitUntil && simNow < uData.patrolWaitUntil) {
          v.maxSpeed = 0;
          uData.status = 'idling';
        } else {
          if (uData.status === 'idling') uData.status = 'marching';

          // ── Pick new waypoint if none exists ───────────────────────────
          if (!uData.patrolTarget) {
            const angle = Math.random() * Math.PI * 2;
            const dist = PATROL_RADIUS_MIN + Math.random() * (PATROL_RADIUS_MAX - PATROL_RADIUS_MIN);
            const tx = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, uData.homePosition[0] + Math.cos(angle) * dist));
            const tz = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, uData.homePosition[2] + Math.sin(angle) * dist));
            uData.patrolTarget = [tx, uData.homePosition[1], tz];
            uData.patrolStartTime = simNow;
          }

          // ── Check arrival or timeout (stuck protection) ────────────────
          const dxP = _px[i] - uData.patrolTarget[0];
          const dzP = _pz[i] - uData.patrolTarget[2];
          const timeInPatrol = simNow - (uData.patrolStartTime || 0);

          if (dxP * dxP + dzP * dzP < PATROL_ARRIVE_DIST_SQ || timeInPatrol > PATROL_TIMEOUT_MS) {
            uData.patrolTarget = undefined;
            uData.patrolWaitUntil = simNow + PATROL_WAIT_MIN + Math.random() * PATROL_WAIT_RAND;
            uData.status = 'idling';
          } else {
            // Stuck detection: If velocity is too low while trying to patrol, force new target
            if (timeInPatrol > 2000 && v.velocity.squaredLength() < 0.1) {
              uData.patrolTarget = undefined;
              uData.patrolWaitUntil = simNow + 500; // Minimal pause
            } else {
              seek.target.set(uData.patrolTarget[0], 0, uData.patrolTarget[2]);
            }
          }
        }

        // ── Speed assignment for patrol ────────────────────────────────────
        const classWeatherMult = weatherMults[u.unitClass]?.move_speed_mult || 1.0;
        const baseSpeed = u.speed * globalSpeedMult * classWeatherMult * (weatherMults.globalSpeedMultiplier || 1.0);
        // Reduced patrol speed for better aesthetics
        v.maxSpeed = uData.status === 'attacking' ? 0 : baseSpeed * 0.25 * feverSpeedMult;

      } else if (uData.status !== 'attacking') {
        // ── Chase / March State ───────────────────────────────────────────
        const seek = (v.steering.behaviors[0] as any);
        if (!seek?.target) continue;

        const classWeatherMult = weatherMults[u.unitClass]?.move_speed_mult || 1.0;
        const baseSpeed = u.speed * globalSpeedMult * classWeatherMult * (weatherMults.globalSpeedMultiplier || 1.0);
        v.maxSpeed = baseSpeed * (uData.isRolling ? 4.0 : 1.0) * feverSpeedMult;

        if (uData.status === 'chasing' && u.targetId === PLAYER_CHAR_TARGET) {
          v.maxSpeed *= 1.25; // Pursuit boost toward player
        }

        if (isPlayerCharTarget && playerCharPos) {
          seek.target.set(playerCharPos[0], 0, playerCharPos[2]);
        } else if (u.targetId) {
          const targetUnit = unitIndex.get(u.targetId);
          if (targetUnit) {
            const tData = uiPool[targetUnit.poolIdx];
            if (tData && tData.isActive) {
              if (u.unitClass === 'mage') {
                // Kite: maintain distance from target
                const ddx = _px[i] - tData.position[0];
                const ddz = _pz[i] - tData.position[2];
                if (ddx * ddx + ddz * ddz < MAGE_KITE_DIST_SQ) {
                  const rDir = u.type === 'player' ? 1 : -1;
                  seek.target.set(_px[i] + ddx * 2, 0, _pz[i] + ddz * 2 + rDir * 5);
                } else {
                  seek.target.set(tData.position[0], 0, tData.position[2]);
                }
              } else if (u.unitClass === 'marksman') {
                // Orbit around target at range
                const angleHash = ((i * 2654435761) >>> 0) % 360;
                const angle = angleHash * (Math.PI / 180);
                const orbitR = uData.encirclementRadius || 1.25;
                const ddx = _px[i] - tData.position[0];
                const ddz = _pz[i] - tData.position[2];
                if (ddx * ddx + ddz * ddz < MM_ORBIT_RANGE_SQ) {
                  seek.target.set(
                    tData.position[0] + Math.cos(angle) * orbitR,
                    0,
                    tData.position[2] + Math.sin(angle) * orbitR,
                  );
                } else {
                  seek.target.set(tData.position[0], 0, tData.position[2]);
                }
              } else {
                seek.target.set(tData.position[0], 0, tData.position[2]);
              }
            }
          }
        }
      }

      // ── Attacking: freeze position ────────────────────────────────────────
      if (uData.status === 'attacking' || u.isDying || (uData.isBuffed && u.unitClass === 'marksman')) {
        v.velocity.set(0, 0, 0);
        v.maxSpeed = 0;
      }

      // ── Velocity damping ──────────────────────────────────────────────────
      v.velocity.multiplyScalar(1.0 - VELOCITY_DAMPING * simDelta);

      // ── Rotation smoothing ────────────────────────────────────────────────
      {
        const velSq = v.velocity.x ** 2 + v.velocity.z ** 2;
        let targetRot = uData.rotation[1];
        let shouldRotate = false;
        let finalSmooth = ROT_SMOOTH;

        if (uData.status === 'attacking') {
          const isPC = u.targetId === PLAYER_CHAR_TARGET;
          let tx2 = 0, tz2 = 0;
          let valid = false;

          if (isPC && playerCharPos) {
            tx2 = playerCharPos[0]; tz2 = playerCharPos[2]; valid = true;
          } else if (u.targetId) {
            const tu = unitIndex.get(u.targetId);
            if (tu) {
              const td = uiPool[tu.poolIdx];
              if (td && td.isActive) { tx2 = td.position[0]; tz2 = td.position[2]; valid = true; }
            }
          }
          if (valid) {
            targetRot = Math.atan2(tx2 - _px[i], tz2 - _pz[i]);
            shouldRotate = true;
            if (u.unitClass === 'marksman' && uData.isBuffed) finalSmooth = 1.0;
          }
        } else if (velSq > 0.05) {
          targetRot = Math.atan2(v.velocity.x, v.velocity.z);
          shouldRotate = true;
        }

        if (shouldRotate) {
          let diff = targetRot - uData.rotation[1];
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          uData.rotation[1] += diff * Math.min(finalSmooth * 2, 1.0);
        }
      }

      // ── Terrain elevation & position sync ────────────────────────────────
      const oldX = _px[i];
      const oldZ = _pz[i];
      const newX = v.position.x;
      const newZ = v.position.z;
      const dx = newX - oldX;
      const dz = newZ - oldZ;
      const moveDistSq = dx * dx + dz * dz;

      const mathElev = getTerrainElevation(
        _px[i], _pz[i], 'STORM', towerConfig.baseDistance,
      ) - 0.3;
      const targetH = getGroundHeight(_px[i], _pz[i], mathElev);

      const maxStep = v.maxSpeed * simDelta * 1.2 + 0.02;
      const maxStepSq = maxStep * maxStep;

      if (moveDistSq > maxStepSq && maxStepSq > 0) {
        const ratio = maxStep / Math.sqrt(moveDistSq);
        _px[i] = oldX + dx * ratio;
        _pz[i] = oldZ + dz * ratio;
        v.position.set(_px[i], targetH, _pz[i]);
      } else {
        _px[i] = newX;
        _pz[i] = newZ;
        v.position.y = targetH;
      }

      uData.position[0] = _px[i];
      uData.position[1] = targetH;
      uData.position[2] = _pz[i];
    }
  },
};
