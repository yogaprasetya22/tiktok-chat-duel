// ============================================================
// DEATH SYSTEM
// ============================================================
// Handles:
// - Primary death detection (HP ≤ 0)
// - YUKA vehicle removal
// - Corpse despawn timer
// - Pool slot recycling
// ============================================================

import { ISystem } from '@/src/core/ecs/ISystem';
import { SimulationContext } from '@/src/core/ecs/types';
import { CORPSE_DESPAWN_MS } from '@/src/core/logic/combat/constants';

export const DeathSystem: ISystem = {
  update(ctx: SimulationContext): void {
    const { simNow, unitPool, unitDataPool, vehiclePool, buffers, unitIndex, activeIndices } = ctx;
    const { vh: _vh, py: _py, vActive: _vActive } = buffers;
    const uPool = unitPool;
    const uiPool = unitDataPool;
    const vPool = vehiclePool;

    for (let k = 0; k < activeIndices.length; k++) {
      const i = activeIndices[k];
      const u = uPool[i];
      const uData = uiPool[i];
      const v = vPool[i];

      if (!u.isActive) continue;

      if (_vh[i] <= 0) {
        // ── Initiate dying ──────────────────────────────────────────────────
        if (!u.isDying) {
          u.isDying = true;
          u.deathTime = simNow;
          uData.isDying = true;
          v.maxSpeed = 0;
          v.velocity.set(0, 0, 0);
          v.steering.behaviors.length = 0;
          if ((v as any).manager === ctx) {
            // entityManager.remove(v) is called externally via orchestrator
          }
        }

        // ── Despawn after corpse timer ──────────────────────────────────────
        if (simNow - (u.deathTime || 0) > CORPSE_DESPAWN_MS) {
          uData.position[1] = -100;
          _py[i] = -100;
          _vActive[i] = 0;
          u.isActive = false;
          uData.isActive = false;
          unitIndex.delete(u.id);
        }
      }
    }
  },
};
