import { SimulationSettings } from "./types";

// ============================================================
// BATTLE SYSTEM - WORLD & AI CONSTANTS
// ============================================================

// --- STATIC WORLD BOUNDARIES (Never Change) ---
export let PLAYER_BASE_Z = 24;
export let ENEMY_BASE_Z = -22;
export let LANE_OFFSETS = [-15, -7.5, 0, 7.5, 15];

export let CLASS_CONFIG = {
    fighter: {
        hp: 5.0,
        hp_regen: 0.15,
        atk: 2.0,
        physical_defense: 45,
        magic_defense: 35,
        physical_pen: 10,
        magic_pen: 0,
        lifesteal: 0.2,
        spell_vamp: 0.1,
        move_speed_mult: 1.05, // Kecepatan standar
        attack_speed_mult: 1.0, // Kecepatan pukul standar
        crit_chance: 0.15,
        crit_damage: 2.0,
        range: 1.2,
        tenacity: 0.15,
        cooldown_reduction: 0.1,
        ai_behavior: {
            separation: 1.0,
            encirclement: 1.2,
            swagger: 0.2,
            perception_radius: 60 * 60,
            chase_range: 10.0,
        },
    },
    tank: {
        hp: 8.5, // Tebal tapi tidak abadi
        hp_regen: 0.3,
        atk: 1.1,
        physical_defense: 85,
        magic_defense: 70,
        physical_pen: 0,
        magic_pen: 0,
        lifesteal: 0.0,
        spell_vamp: 0.0,
        move_speed_mult: 0.95, // Sedikit lambat
        attack_speed_mult: 1.2, // Pukulan agak berat
        crit_chance: 0.05,
        crit_damage: 1.5,
        range: 1.0,
        tenacity: 0.4,
        cooldown_reduction: 0.15,
        ai_behavior: {
            separation: 1.5,
            encirclement: 1.0,
            swagger: 0.1,
            perception_radius: 50 * 50,
            chase_range: 6.0,
        },
    },
    mage: {
        hp: 3.2, // Sudah tidak "setipis kertas" lagi
        hp_regen: 0.05,
        atk: 2.8, // Burst damage
        physical_defense: 20,
        magic_defense: 25,
        physical_pen: 0,
        magic_pen: 25,
        lifesteal: 0.0,
        spell_vamp: 0.2,
        move_speed_mult: 1.0,
        attack_speed_mult: 0.5, // Slow, heavy casts
        crit_chance: 0.05,
        crit_damage: 1.5,
        range: 6.0,
        tenacity: 0.0,
        cooldown_reduction: 0.2,
        ai_behavior: {
            separation: 2.0,
            encirclement: 1.5,
            swagger: 0.4,
            perception_radius: 80 * 80,
            chase_range: 8.0,
        },
    },
    marksman: {
        hp: 2.8,
        hp_regen: 0.05,
        atk: 1.6,
        physical_defense: 15,
        magic_defense: 15,
        physical_pen: 15,
        magic_pen: 0,
        lifesteal: 0.15,
        spell_vamp: 0.0,
        move_speed_mult: 1.0,
        attack_speed_mult: 0.8, // Serangan cepat
        crit_chance: 0.35,
        crit_damage: 2.3,
        range: 7.5,
        tenacity: 0.0,
        cooldown_reduction: 0.05,
        ai_behavior: {
            separation: 2.2,
            encirclement: 1.0,
            swagger: 0.3,
            perception_radius: 90 * 90,
            chase_range: 12.0,
        },
    },
    assassin: {
        hp: 3.5,
        hp_regen: 0.1,
        atk: 3.2,
        physical_defense: 25,
        magic_defense: 25,
        physical_pen: 25,
        magic_pen: 0,
        lifesteal: 0.1,
        spell_vamp: 0.15,
        move_speed_mult: 1.2, // Lincah tapi masuk akal
        attack_speed_mult: 0.9,
        crit_chance: 0.25,
        crit_damage: 2.2,
        range: 1.1,
        tenacity: 0.05,
        cooldown_reduction: 0.1,
        ai_behavior: {
            separation: 1.2,
            encirclement: 2.5,
            swagger: 0.6,
            perception_radius: 70 * 70,
            chase_range: 15.0,
        },
    },
};

// --- DYNAMIC SIMULATION SETTINGS ---
export let INITIAL_SETTINGS: SimulationSettings = {
    // Military & Stats
    globalHpMultiplier: 1.0,
    globalSpeedMultiplier: 1.0,
    globalDamageMultiplier: 1.0,
    globalAttackCooldown: 800,
    critChance: 0.15,

    // Perception
    perceptionRadiusSq: 60 * 60,

    // Social Dynamics
    separationRadius: 0.95,
    separationStrength: 0.08,

    // Combat Positioning
    encirclementRadius: 0.75,
    encirclementJitter: 0.15,

    // Animation & Feel
    rotationSmoothing: 0.12,
    laneSwaggerAmp: 0.25,
    victoryPauseMs: 650,

    // Tactical Scoring
    lanePenalty: 800,
    baseProximityBonus: 8000,
    baseDefenseThreshold: 8,
    baseAttackResponseBonus: 30000,
    bossPriorityBonus: 15000,
    lowHpBonus: 4000,

    // Steering & Recovery
    laneSpringFar: 0.7,
    laneSpringNear: 0.4,
    laneDriftThreshold: 2,

    // World & Meta
    timeScale: 1.0,
    unitScale: 0.5,
    vfxIntensity: 1.0,
};

// --- MAGE PROJECTILE SYNC ---
export const MAGE_PROJECTILE_TIME_MS = 350; // Faster travel for "rocket" feel
