import { SimulationSettings } from "./types";

// ============================================================
// BATTLE SYSTEM - WORLD & AI CONSTANTS
// ============================================================

// --- STATIC WORLD BOUNDARIES (Never Change) ---
export let PLAYER_BASE_Z = 24;
export let ENEMY_BASE_Z = -22;
export let LANE_OFFSETS = [-15, -7.5, 0, 7.5, 15];

// --- DYNAMIC SIMULATION SETTINGS ---
export let INITIAL_SETTINGS: SimulationSettings = {
    // Military & Stats
    globalHpMultiplier: 1.0,
    globalSpeedMultiplier: 1.0,
    globalDamageMultiplier: 1.0,
    globalAttackCooldown: 800,
    critChance: 0.15,

    // Perception
    perceptionRadiusSq: 18 * 18,

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
    unitScale: 1.0,
    vfxIntensity: 1.0,
};
