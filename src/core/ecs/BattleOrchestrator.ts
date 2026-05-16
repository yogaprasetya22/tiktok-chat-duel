// ============================================================
// BATTLE ORCHESTRATOR
// ============================================================
// The new "Battle Loop" — replaces the monolithic updateSimulation.
// Responsibilities:
//   1. Build SimulationContext from raw refs (zero copy, pre-resolved)
//   2. Run systems sequentially: Death → Targeting → Skills/Combat → Movement
//   3. Expose a clean `tick(delta)` API to useBattleSystem hook
// ============================================================

import type * as YUKA from 'yuka';
import { battleGrid } from '@/src/core/logic/combat/spatialGrid';
import { WEATHER_CONFIG } from '@/src/core/logic/combat/constants';
import { PlayerInput } from '@/src/components/game/systems/PlayerECS';

// Systems (sequential pipeline)
import { DeathSystem } from './systems/DeathSystem';
import { TargetingSystem } from './systems/TargetingSystem';
import { DamageResolutionSystem, registerCombatModule } from './systems/DamageResolutionSystem';
import { MovementSystem } from './systems/MovementSystem';

// Class Combat Modules (Strategy Pattern)
import { FighterCombatModule } from './combat/FighterCombatModule';
import { MageCombatModule } from './combat/MageCombatModule';
import { MarksmanCombatModule } from './combat/MarksmanCombatModule';
import { TankCombatModule } from './combat/TankCombatModule';
import { AssassinCombatModule } from './combat/AssassinCombatModule';
import { EnemyGruntCombatModule } from './combat/EnemyGruntCombatModule';

import type { SimulationContext, ECSBuffers, SpellPools } from './types';
import type { ActiveUnit, UnitRuntimeData } from '@/src/core/domain/unit.types';

// ── Register all class modules once at module load (Open-Closed) ─────────────
registerCombatModule(FighterCombatModule);
registerCombatModule(MageCombatModule);
registerCombatModule(MarksmanCombatModule);
registerCombatModule(TankCombatModule);
registerCombatModule(AssassinCombatModule);
registerCombatModule(EnemyGruntCombatModule);

// ── Sequential system pipeline (ordered for frame-perfect precision) ──────────
const SYSTEMS = [
  MovementSystem,    // 1. Move units (writes current frame positions)
  DeathSystem,       // 2. Remove dead units immediately
  TargetingSystem,   // 3. Re-scan targets based on NEW positions
  DamageResolutionSystem, // 4. Apply damage and VFX to NEW positions
];

export interface OrchestratorRefs {
  unitPool: React.MutableRefObject<ActiveUnit[]>;
  unitDataPool: React.MutableRefObject<UnitRuntimeData[]>;
  vehiclePool: React.MutableRefObject<YUKA.Vehicle[]>;
  activeIndices: React.MutableRefObject<number[]>;
  unitIndex: React.MutableRefObject<Map<string, ActiveUnit>>;
  entityManager: YUKA.EntityManager;
  buffers: ECSBuffers;
  spells: SpellPools;
  towerConfigRef: React.MutableRefObject<any>;
  settingsRef: React.MutableRefObject<any>;
  simulationTimeRef: React.MutableRefObject<number>;
  physicsAccumulator: React.MutableRefObject<number>;
  frameCount: React.MutableRefObject<number>;
  accumulateDamage: SimulationContext['accumulateDamage'];
  addKillEvent: SimulationContext['addKillEvent'];
  updateStats: SimulationContext['updateStats'];
}

export function createBattleOrchestrator(refs: OrchestratorRefs) {
  const PHYSICS_STEP = 0.016;
  const MAX_STEPS = 4;

  return {
    tick(delta: number): void {
      refs.frameCount.current++;

      // ── Time ───────────────────────────────────────────────────────────────
      const state = (globalThis as any).__zustandStore?.getState?.() ?? {};
      const weather: string = state.weather ?? 'CLEAR';
      const isFeverTime: boolean = state.isFeverTime ?? false;
      const weatherCfg = (WEATHER_CONFIG as any)[weather] ?? {};
      const weatherMults = weatherCfg.multipliers ?? {};
      const feverSpeedMult = isFeverTime ? 2.0 : 1.0;
      const feverCooldownMult = isFeverTime ? 0.5 : 1.0;

      let simDelta = delta * ((refs.settingsRef.current.timeScale) || 1.0);
      if (simDelta > 0.064) simDelta = 0.064;
      refs.simulationTimeRef.current += simDelta * 1000;
      const simNow = refs.simulationTimeRef.current;

      // ── Physics step accumulation ──────────────────────────────────────────
      refs.physicsAccumulator.current += simDelta;
      let steps = 0;
      while (refs.physicsAccumulator.current >= PHYSICS_STEP && steps < MAX_STEPS) {
        refs.entityManager.update(PHYSICS_STEP);
        refs.physicsAccumulator.current -= PHYSICS_STEP;
        steps++;
      }
      if (refs.physicsAccumulator.current >= PHYSICS_STEP) {
        refs.physicsAccumulator.current %= PHYSICS_STEP;
      }

      // ── Spatial grid update (Every frame for maximum precision) ───────────
      battleGrid.update(refs.unitDataPool.current, refs.activeIndices.current);

      // ── Active index compaction (once per 30 frames) ───────────────────────
      if (refs.frameCount.current % 30 === 0) {
        const arr = refs.activeIndices.current;
        let w = 0;
        for (let r = 0; r < arr.length; r++) {
          if (refs.unitPool.current[arr[r]]?.isActive) arr[w++] = arr[r];
        }
        arr.length = w;
      }

      // ── Build SimulationContext (zero-copy: all refs) ──────────────────────
      const ctx: SimulationContext = {
        simNow,
        simDelta,
        frameCount: refs.frameCount.current,
        unitPool: refs.unitPool.current,
        unitDataPool: refs.unitDataPool.current,
        vehiclePool: refs.vehiclePool.current,
        buffers: refs.buffers,
        grid: battleGrid,
        unitIndex: refs.unitIndex.current,
        activeIndices: refs.activeIndices.current,
        spells: refs.spells,
        feverSpeedMult,
        feverCooldownMult,
        weatherMults,
        towerConfig: {
          player: { color: refs.towerConfigRef.current?.player?.color ?? '#0066FF' },
          enemy:  { color: refs.towerConfigRef.current?.enemy?.color  ?? '#FF3300' },
          baseDistance: refs.towerConfigRef.current?.baseDistance ?? 24,
        },
        playerCharPos: PlayerInput.playerPosition,
        globalSpeedMult: refs.settingsRef.current.globalSpeedMultiplier || 1.0,
        globalDamageMult: refs.settingsRef.current.globalDamageMultiplier || 1.0,
        accumulateDamage: refs.accumulateDamage,
        addKillEvent: refs.addKillEvent,
        updateStats: refs.updateStats,
      };

      // ── Run pipeline ───────────────────────────────────────────────────────
      for (let s = 0; s < SYSTEMS.length; s++) {
        SYSTEMS[s].update(ctx);
      }
    },
  };
}
