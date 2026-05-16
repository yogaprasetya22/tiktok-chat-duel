// ============================================================
// ECS CORE — Shared Context (Zero-Allocation Data Contract)
// ============================================================
// All systems receive a single SimulationContext object containing
// pre-resolved references to TypedArrays and pools.
// No new objects are created inside the simulation loop.
// ============================================================

import type * as YUKA from 'yuka';
import type { ActiveUnit, UnitRarity, UnitRuntimeData } from '@/src/core/domain/unit.types';
import { SpatialHashGrid } from '../logic/combat/spatialGrid';

// ── TypedArray ECS component slices (bitecs-compatible, zero-GC) ─────────────
export interface ECSBuffers {
  px: Float32Array;   // position X
  py: Float32Array;   // position Y
  pz: Float32Array;   // position Z
  vh: Float32Array;   // current HP
  vmh: Float32Array;  // max HP
  vActive: Uint8Array; // 0=inactive, 1=active
  vType: Uint8Array;   // 0=player, 1=enemy
}

// ── Spell Pool Pointers (pre-resolved for each system) ────────────────────────
export interface SpellPools {
  spellsRef: React.RefObject<any[]>;
  mmSpellsRef: React.RefObject<any[]>;
  fighterSpellsRef: React.RefObject<any[]>;
  tankSpellsRef: React.RefObject<any[]>;
  assassinSpellsRef: React.RefObject<any[]>;
  mageSpellPtr: React.MutableRefObject<number>;
  mmSpellPtr: React.MutableRefObject<number>;
  fighterSpellPtr: React.MutableRefObject<number>;
  tankSpellPtr: React.MutableRefObject<number>;
  assassinSpellPtr: React.MutableRefObject<number>;
}

// ── Shared simulation context — read-only snapshot per tick ──────────────────
export interface SimulationContext {
  // Time
  simNow: number;
  simDelta: number;
  frameCount: number;

  // Pools (direct array references — zero copy)
  unitPool: ActiveUnit[];
  unitDataPool: UnitRuntimeData[];
  vehiclePool: YUKA.Vehicle[];

  // TypedArray slices
  buffers: ECSBuffers;

  // Spatial index
  grid: SpatialHashGrid;

  // Unit index (id → ActiveUnit)
  unitIndex: Map<string, ActiveUnit>;

  // Active indices (compacted; never iterate all 300 slots)
  activeIndices: number[];

  // Spell pools
  spells: SpellPools;

  // Global multipliers (pre-computed from store + weather)
  feverSpeedMult: number;
  feverCooldownMult: number;
  weatherMults: Record<string, any>;

  // Game config
  towerConfig: {
    player: { color: string };
    enemy: { color: string };
    baseDistance: number;
  };

  // Player character position (from PlayerInput ECS — zero lag)
  playerCharPos: Float32Array | null;

  // Settings snapshot
  globalSpeedMult: number;
  globalDamageMult: number;

  // Callbacks (bound once at hook init — no closure allocation per frame)
  accumulateDamage: (
    targetId: string | undefined,
    value: number,
    position: number[],
    color: string,
    now: number,
  ) => void;
  addKillEvent: (
    killer: string,
    victim: string,
    victimType: 'unit' | 'boss' | 'base',
    profileImage?: string,
    rarity?: UnitRarity,
  ) => void;
  updateStats: (
    userName: string,
    type: 'player' | 'enemy',
    dmg: number,
    isKill?: boolean,
  ) => void;
}
