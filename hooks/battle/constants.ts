import { SimulationSettings, ClassConfig } from "./types";

// ============================================================
// BATTLE SYSTEM - WORLD & AI CONSTANTS
// ============================================================

// --- STATIC WORLD BOUNDARIES (Never Change) ---
export let PLAYER_BASE_Z = 24;
export let ENEMY_BASE_Z = -22;
export let LANE_OFFSETS = [-15, -7.5, 0, 7.5, 15];

export let CLASS_CONFIG: ClassConfig = {
    fighter: {
        hp: 5.5,
        hp_regen: 0.18,
        atk: 2.2,
        physical_defense: 50,
        magic_defense: 40,
        physical_pen: 12,
        magic_pen: 0,
        lifesteal: 0.25,
        spell_vamp: 0.1,
        move_speed_mult: 1.05,
        attack_speed_mult: 1.1,
        crit_chance: 0.15,
        crit_damage: 2.0,
        range: 1.2,
        tenacity: 0.2,
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
        hp: 10.0,
        hp_regen: 0.35,
        atk: 1.3,
        physical_defense: 95,
        magic_defense: 80,
        physical_pen: 0,
        magic_pen: 0,
        lifesteal: 0.0,
        spell_vamp: 0.0,
        move_speed_mult: 0.95,
        attack_speed_mult: 0.8,
        crit_chance: 0.05,
        crit_damage: 1.5,
        range: 1.0,
        tenacity: 0.5,
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
        hp: 3.5,
        hp_regen: 0.08,
        atk: 3.5,
        physical_defense: 25,
        magic_defense: 35,
        physical_pen: 0,
        magic_pen: 35,
        lifesteal: 0.0,
        spell_vamp: 0.25,
        move_speed_mult: 1.0,
        attack_speed_mult: 0.6,
        crit_chance: 0.05,
        crit_damage: 1.5,
        range: 6.5,
        tenacity: 0.0,
        cooldown_reduction: 0.3,
        ai_behavior: {
            separation: 2.5,
            encirclement: 1.5,
            swagger: 0.4,
            perception_radius: 85 * 85,
            chase_range: 8.0,
        },
    },
    marksman: {
        hp: 2.8,
        hp_regen: 0.05,
        atk: 2.2,
        physical_defense: 20,
        magic_defense: 20,
        physical_pen: 20,
        magic_pen: 0,
        lifesteal: 0.2,
        spell_vamp: 0.0,
        move_speed_mult: 1.05,
        attack_speed_mult: 1.6,
        crit_chance: 0.35,
        crit_damage: 2.5,
        range: 8.5,
        tenacity: 0.0,
        cooldown_reduction: 0.1,
        ai_behavior: {
            separation: 2.8,
            encirclement: 1.0,
            swagger: 0.3,
            perception_radius: 90 * 90,
            chase_range: 12.0,
        },
    },
    assassin: {
        hp: 3.8,
        hp_regen: 0.12,
        atk: 4.2,
        physical_defense: 30,
        magic_defense: 30,
        physical_pen: 35,
        magic_pen: 0,
        lifesteal: 2.15,
        spell_vamp: 1.2,
        move_speed_mult: 1.25,
        attack_speed_mult: 1.25,
        crit_chance: 0.3,
        crit_damage: 2.5,
        range: 1.2,
        tenacity: 0.1,
        cooldown_reduction: 0.2,
        ai_behavior: {
            separation: 1.2,
            encirclement: 2.2,
            swagger: 1.0,
            perception_radius: 120, // Assassin searches very far for squishies
            chase_range: 150,
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

    // Performance & Diagnostics
    potatoMode: false,
    telemetry: {
        engineMs: 0,
        unitCount: 0,
        vfxCount: 0,
        bucketCount: 0,
        bottleneck: "OPTIMAL"
    }
};

// --- MAGE PROJECTILE SYNC ---
export const MAGE_PROJECTILE_TIME_MS = 350;
export const CORPSE_DESPAWN_MS = 5000; // Time in ms before a corpse is removed from the field
export const ASSASSIN_BLINK_DISTANCE = 18.0; // Increased range for "far" feel
export const ASSASSIN_BLINK_COOLDOWN = 6000;
export const ASSASSIN_INVUL_MS = 800;
export const NAME_POOL_SIZE = 90;

// --- LOD IMPOSTOR SYSTEM ---
// Units beyond this distance² from camera are rendered as flat billboard impostors
// instead of full 3D animated models (1-2 draw calls vs hundreds)
export const LOD_IMPOSTOR_DIST_SQ = 48 * 48;
export const LOD_IMPOSTOR_MAX = 1000;           // Max billboard instances (player+enemy combined)
export const LOD_IMPOSTOR_SCALE = 1.8;          // Visual scale of impostor billboards
export const LOD_IMPOSTOR_BOSS_SCALE = 5.0;     // Boss impostor scale

// --- WEATHER SYSTEM CONFIG ---
export const WEATHER_CONFIG = {
    CLEAR: { name: "Cerah", color: "#facc15", boostText: "Normal" },
    RAIN: {
        name: "Hujan",
        color: "#60a5fa",
        boostText: "Mage: +Atk Speed, MM: -Atk Speed",
        multipliers: {
            mage: { attack_speed_mult: 1.3 },
            marksman: { attack_speed_mult: 0.75 },
            globalSpeedMultiplier: 0.9,
        },
    },
    STORM: {
        name: "Badai Angin",
        color: "#94a3b8",
        boostText: "Assassin: +Speed, MM: -Speed",
        multipliers: {
            assassin: { move_speed_mult: 1.35 },
            marksman: { move_speed_mult: 0.7 },
            globalAttackCooldown: 1.15,
        },
    },
    THUNDER: {
        name: "Hujan Petir",
        color: "#a855f7",
        boostText: "Mage: ++Damage, Fighter: +Atk",
        multipliers: {
            mage: { atk: 1.3, attack_speed_mult: 1.2 },
            fighter: { atk: 1.2 },
            tank: { physical_defense: 1.2 },
            globalDamageMultiplier: 1.15,
        },
    },
};
