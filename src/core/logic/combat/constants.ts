import { SimulationSettings, ClassConfig } from "@/src/core/domain/unit.types";

// ============================================================
// BATTLE SYSTEM - WORLD & AI CONSTANTS
// ============================================================

// --- STATIC WORLD BOUNDARIES (Never Change) ---
export let PLAYER_BASE_Z = 36;
export let ENEMY_BASE_Z = -36;
export let LANE_OFFSETS = [-15, -7.5, 0, 7.5, 15];

export const SEAL_M_ENEMIES = [
    "Baabaa", "Moo Moo", "Piya", "Cankura", "Woody Wordy", 
    "Silly Me", "Bear", "Pumpky", "Joe the Kick", "Mariel",
    "Gariel", "Tiphareth", "Gehabert", "Sina", "Balie"
];

export let CLASS_CONFIG: ClassConfig = {
    fighter: { // Warrior
        hp: 8.5,
        hp_regen: 0.22,
        atk: 2.8,
        physical_defense: 65,
        magic_defense: 45,
        physical_pen: 15,
        magic_pen: 0,
        lifesteal: 0.15,
        spell_vamp: 0.05,
        move_speed_mult: 1.1,
        attack_speed_mult: 1.2,
        crit_chance: 0.2,
        crit_damage: 2.2,
        range: 3.5,
        tenacity: 0.25,
        cooldown_reduction: 0.1,
        skill_cooldown: 6000,
        skill_range: 5.0,
        skill_duration: 2500,
        ai_behavior: {
            separation: 1.0,
            encirclement: 1.2,
            swagger: 0.2,
            perception_radius: 60 * 60,
            chase_range: 10.0,
        },
    },
    tank: { // Knight
        hp: 12.5,
        hp_regen: 0.45,
        atk: 1.5,
        physical_defense: 110,
        magic_defense: 95,
        physical_pen: 0,
        magic_pen: 0,
        lifesteal: 0.0,
        spell_vamp: 0.0,
        move_speed_mult: 1.0,
        attack_speed_mult: 0.85,
        crit_chance: 0.05,
        crit_damage: 1.5,
        range: 3.0,
        tenacity: 0.6,
        cooldown_reduction: 0.2,
        skill_cooldown: 25000,
        skill_range: 0.0,
        skill_duration: 4000,
        ai_behavior: {
            separation: 1.5,
            encirclement: 1.0,
            swagger: 0.1,
            perception_radius: 50 * 50,
            chase_range: 6.0,
        },
    },
    mage: { // Wizard
        hp: 3.8,
        hp_regen: 0.1,
        atk: 5.2,
        physical_defense: 15,
        magic_defense: 45,
        physical_pen: 0,
        magic_pen: 45,
        lifesteal: 0.0,
        spell_vamp: 0.35,
        move_speed_mult: 0.9,
        attack_speed_mult: 0.45,
        crit_chance: 0.1,
        crit_damage: 2.0,
        range: 11.5,
        tenacity: 0.0,
        cooldown_reduction: 0.15,
        skill_cooldown: 7500,
        skill_range: 15.0,
        skill_duration: 3000,
        ai_behavior: {
            separation: 2.5,
            encirclement: 1.5,
            swagger: 0.4,
            perception_radius: 85 * 85,
            chase_range: 18.0,
        },
    },
    marksman: { // Archer
        hp: 3.2,
        hp_regen: 0.08,
        atk: 2.8,
        physical_defense: 25,
        magic_defense: 25,
        physical_pen: 25,
        magic_pen: 0,
        lifesteal: 0.25,
        spell_vamp: 0.0,
        move_speed_mult: 1.05,
        attack_speed_mult: 1.6,
        crit_chance: 0.45,
        crit_damage: 2.8,
        range: 8.5,
        tenacity: 0.0,
        cooldown_reduction: 0.1,
        skill_cooldown: 22000,
        skill_range: 14.0,
        skill_duration: 4500,
        ai_behavior: {
            separation: 2.8,
            encirclement: 1.0,
            swagger: 0.3,
            perception_radius: 90 * 90,
            chase_range: 12.0,
        },
    },
    assassin: { // Ninja/Clown
        hp: 4.5,
        hp_regen: 0.15,
        atk: 5.5,
        physical_defense: 70,
        magic_defense: 70,
        physical_pen: 45,
        magic_pen: 0,
        lifesteal: 2.5,
        spell_vamp: 1.5,
        move_speed_mult: 1.4,
        attack_speed_mult: 1.4,
        crit_chance: 0.4,
        crit_damage: 4.0,
        range: 2.5,
        tenacity: 0.15,
        cooldown_reduction: 0.25,
        skill_cooldown: 1200,
        skill_range: 20.0,
        skill_duration: 800,
        ai_behavior: {
            separation: 1.2,
            encirclement: 2.2,
            swagger: 1.0,
            perception_radius: 150,
            chase_range: 180,
        },
    },
};

// --- DYNAMIC SIMULATION SETTINGS ---
export let INITIAL_SETTINGS: SimulationSettings = {
    // Military & Stats
    globalHpMultiplier: 1.0,
    globalSpeedMultiplier: 1.1,
    globalDamageMultiplier: 2.4,
    globalAttackCooldown: 800,
    critChance: 0.55,

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
    maxUnits: 20,

    // Performance & Diagnostics
    potatoMode: false,
    telemetry: {
        engineMs: 0,
        unitCount: 0,
        vfxCount: 0,
        bucketCount: 0,
        bottleneck: "OPTIMAL",
    },
};

// --- MAGE PROJECTILE SYNC ---
export const MAGE_PROJECTILE_TIME_MS = 520;
export const CORPSE_DESPAWN_MS = 0; // Time in ms before a corpse is removed from the field

// --- LOD IMPOSTOR SYSTEM ---

export const LOD_IMPOSTOR_MAX = 1200;
export const LOD_IMPOSTOR_SCALE = 1.8;
export const LOD_IMPOSTOR_BOSS_SCALE = 5.0;

// --- CENTRALIZED PERFORMANCE CONFIG ---
export const ARMY_POOL_SIZE = 30; // Number of high-detail 3D models per class
export const ANIM_CULL_DIST_SQ = 450 * 450; // Distance where bone animations stop (150m)

// --- WEATHER SYSTEM CONFIG ---
export const WEATHER_CONFIG = {
    CLEAR: { name: "Cerah", color: "#facc15", boostText: "Normal" },
    RAIN: {
        name: "Hujan",
        color: "#60a5fa",
        boostText: "Mage: +Atk Speed, MM: -Atk Speed",
        multipliers: {
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
            mage: { atk: 1.3 },
            fighter: { atk: 1.2 },
            tank: { physical_defense: 1.2 },
            globalDamageMultiplier: 1.15,
        },
    },
};
