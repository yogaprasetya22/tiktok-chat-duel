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
    speed: 3.2 * config.speedMultiplier * settings.globalSpeedMultiplier,
    range: 3.0 * settings.unitScale,
    tenacity: 0,
    cooldownReduction: 0,
    critDamage: 2.0,
    critChance: 0,
    level,
});

export const applyBossModifiers = (stats: UnitStats): UnitStats => ({
    ...stats,
    hp: stats.hp * 10,
    maxHp: stats.maxHp * 10,
    attack: stats.attack * 5,
    speed: stats.speed * 0.5,
    range: stats.range * 1.5,
});

/**
 * Calculates final damage with defense and penetration logic.
 */
export const calcDamage = (
    attacker: UnitStats,
    target: UnitStats,
    isMagic: boolean = false
): { damage: number; isCrit: boolean } => {
    const isCrit = Math.random() < attacker.critChance;
    const critMult = isCrit ? attacker.critDamage : 1.0;
    
    const baseDamage = attacker.attack * critMult;
    
    // Defense calculation: dmg = base * (100 / (100 + effectiveDefense))
    const defense = isMagic ? target.magicDefense : target.physicalDefense;
    const pen = isMagic ? attacker.magicPen : attacker.physicalPen;
    const effectiveDefense = Math.max(0, defense - pen);
    
    const damage = Math.floor(baseDamage * (100 / (100 + effectiveDefense)));
    
    return {
        damage: Math.max(1, damage),
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
