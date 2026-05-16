// ============================================================
// SYSTEM INTERFACE — Open-Closed Principle Contract
// ============================================================
// Every ECS System is a pure function: (ctx) => void.
// Systems NEVER allocate. They mutate ctx.buffers / pools in-place.
// ============================================================

import type { SimulationContext } from './types';

/**
 * A single, isolated simulation system.
 * Runs sequentially each tick inside BattleOrchestrator.
 */
export interface ISystem {
  /** Called once per simulation tick. Must be pure (no new allocations). */
  update(ctx: SimulationContext): void;
}

/**
 * Factory to create a class-specific combat system (Strategy Pattern).
 * Each ClassCombatModule handles its own skill logic and VFX emission.
 */
export interface IClassCombatModule {
  readonly unitClass: string;

  /**
   * Execute primary attack and skill logic for this class.
   * Returns true if damage was dealt this tick.
   */
  executeAttack(
    idx: number,
    ctx: SimulationContext,
  ): boolean;

  /**
   * Execute active skill (cooldown-gated).
   * Returns true if the skill was triggered.
   */
  executeSkill(
    idx: number,
    ctx: SimulationContext,
  ): boolean;
}
