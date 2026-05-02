// ============================================================
// BATTLE SYSTEM - PURE UTILITY FUNCTIONS
// ============================================================
// These are stateless, side-effect-free helper functions.
// No React, No YUKA, No Three.js dependencies.
// ============================================================

import type { TowerConfig, UnitStats, SimulationSettings } from "@/src/core/domain/unit.types";

/**
 * Calculates base unit stats for a given level and config multipliers.
 * Called once per unit at spawn time.
 */
export const getUnitStats = (
    level: number,
    config: TowerConfig["unitConfig"],
    settings: SimulationSettings, 
): UnitStats => ({
    hp: Math.floor(100 * Math.pow(2.2, level - 1) * config.hpMultiplier * settings.globalHpMultiplier),
    maxHp: Math.floor(100 * Math.pow(2.2, level - 1) * config.hpMultiplier * settings.globalHpMultiplier),
    hpRegen: 0,
    attack: Math.floor(25 * Math.pow(1.8, level - 1) * config.attackMultiplier * settings.globalDamageMultiplier),
    physicalDefense: 0,
    magicDefense: 0,
    physicalPen: 0,
    magicPen: 0,
    lifesteal: 0,
    spellVamp: 0,
    speed: 5.5 * config.speedMultiplier * settings.globalSpeedMultiplier,
    range: 3.0 * settings.unitScale,
    tenacity: 0,
    cooldownReduction: 0,
    critDamage: 2.0,
    critChance: 0,
    level,
});





/** Returns a random element from an array */
export const pickRandom = <T>(arr: T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];

/** Returns a random element from an array based on weights */
export const pickWeightedRandom = <T>(items: T[], weights: number[]): T => {
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let random = Math.random() * totalWeight;
    for (let i = 0; i < items.length; i++) {
        if (random < weights[i]) return items[i];
        random -= weights[i];
    }
    return items[items.length - 1];
};





/**
 * Interpolates between two angles in radians, taking the shortest path around the circle.
 * Prevents "360-degree spins" when crossing the PI/-PI boundary.
 */
export const lerpAngle = (start: number, end: number, t: number): number => {
    let diff = end - start;
    while (diff < -Math.PI) diff += Math.PI * 2;
    while (diff > Math.PI) diff -= Math.PI * 2;
    return start + diff * t;
};
