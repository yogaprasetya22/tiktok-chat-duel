// ============================================================
// BATTLE SYSTEM - PURE UTILITY FUNCTIONS
// ============================================================
// These are stateless, side-effect-free helper functions.
// No React, No YUKA, No Three.js dependencies.
// ============================================================

import type { TowerConfig, UnitStats, SimulationSettings } from "./types";

/**
 * Calculates base unit stats for a given level and config multipliers.
 * Called once per unit at spawn time.
 */
export const getUnitStats = (
    level: number,
    config: TowerConfig["unitConfig"],
    settings: SimulationSettings, // Fix: support dynamic settings in spawn
): UnitStats => ({
    hp: Math.floor(100 * Math.pow(2.2, level - 1) * config.hpMultiplier * settings.globalHpMultiplier),
    maxHp: Math.floor(100 * Math.pow(2.2, level - 1) * config.hpMultiplier * settings.globalHpMultiplier),
    attack: Math.floor(25 * Math.pow(1.8, level - 1) * config.attackMultiplier * settings.globalDamageMultiplier),
    speed: 2.2 * config.speedMultiplier * settings.globalSpeedMultiplier,
    range: 2.5 * settings.unitScale, // Range should reflect physical size
    level,
});

/**
 * Applies boss multipliers to a unit's stats in-place.
 * Call this after getUnitStats() if isBoss === true.
 */
export const applyBossModifiers = (stats: UnitStats): UnitStats => ({
    ...stats,
    hp: stats.hp * 10,
    maxHp: stats.maxHp * 10,
    attack: stats.attack * 5,
    speed: stats.speed * 0.5,
    range: stats.range * 1.5,
});

/**
 * Calculates final damage with optional critical hit.
 */
export const calcDamage = (
    baseAttack: number,
    critChance: number,
    critMultiplier: number,
): { damage: number; isCrit: boolean } => {
    const isCrit = Math.random() < critChance;
    return {
        damage: isCrit ? Math.floor(baseAttack * critMultiplier) : baseAttack,
        isCrit,
    };
};

/** Returns a random element from an array */
export const pickRandom = <T>(arr: T[]): T =>
    arr[Math.floor(Math.random() * arr.length)];

/** Clamp a value between min and max */
export const clamp = (val: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, val));

/** Default skin and outfit color palettes */
export const SKIN_COLORS = [
    "#FFDBAC",
    "#F1C27D",
    "#E0AC69",
    "#8D5524",
    "#C68642",
];

export const OUTFIT_COLORS = [
    "#2ecc71",
    "#3498db",
    "#9b59b6",
    "#f1c40f",
    "#e67e22",
    "#e74c3c",
    "#ecf0f1",
    "#95a5a6",
];
