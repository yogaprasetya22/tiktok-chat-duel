// ============================================================
// BATTLE SYSTEM - TYPE DEFINITIONS
// ============================================================
// All interfaces and types for the battle simulation system.
// This module has NO side effects and NO React dependencies.
// ============================================================

export interface UnitStats {
    hp: number;
    maxHp: number;
    attack: number;
    speed: number;
    range: number;
    level?: number;
}

export interface TeamConfig {
    name: string;
    color: string;
    active: boolean;
    commentKeyword: string;
    commentType: "contains" | "exact";
    giftKeyword: string;
}

export interface TowerConfig {
    player: TeamConfig;
    enemy: TeamConfig;
    baseHp: number;
    baseDistance?: number;
    maxUnits: number;
    unitConfig: {
        hpMultiplier: number;
        speedMultiplier: number;
        attackMultiplier: number;
    };
    criticalHitChance?: number; // 0.0 - 1.0
    criticalMultiplier?: number; // e.g., 2.0 for 100% extra dmg
}

export interface DamageText {
    id: string;
    value: number;
    position: [number, number, number];
    timestamp: number;
    color: string;
    isCritical?: boolean;
}

export interface ActiveUnit extends UnitStats {
    id: string;
    type: "player" | "enemy";
    unitClass: "fighter" | "tank" | "mage";
    userName: string;
    position?: [number, number, number];
    status: "idling" | "marching" | "attacking";
    targetId?: string;
    lastAttackTime: number;
    isDying?: boolean;
    deathTime?: number;
    isBoss: boolean;
    animationOffset: number;
}

export interface MapObstacle {
    x: number;
    z: number;
    r: number;
}

export interface KillEvent {
    id: string;
    killer: string;
    victim: string;
    victimType: "unit" | "boss" | "base";
    timestamp: number;
}

export interface BattleStats {
    damageDealt: Record<string, number>;
    playerDamage: Record<string, number>;
    enemyDamage: Record<string, number>;
    playerKills: Record<string, number>;
    enemyKills: Record<string, number>;
    unitsSpawned: Record<string, number>;
    playerHits: Record<string, number>;
    enemyHits: Record<string, number>;
}

/** Internal runtime data for each unit, stored in unitDataRef */
export interface UnitRuntimeData {
    hp: number;
    maxHp: number;
    status: string;
    position: [number, number, number];
    rotation: [number, number, number];
    userName: string;
    type: 'player' | 'enemy';
    level: number;
    isBoss: boolean;
    laneOffset: number;
    lastAttackTime: number;
    isAttackingBase?: boolean;
    animationOffset: number;
    lastDamageTime: number;
    victoryPauseUntil: number;
    jitterOffset: number;
    isDying?: boolean;
    isKiting?: boolean;
    unitClass: string;
}

export interface DamageQueueEntry {
    value: number;
    position: [number, number, number];
    isCrit: boolean;
    color: string;
    timestamp: number;
}

export interface SimulationSettings {
    // Military & Stats
    globalHpMultiplier: number;
    globalSpeedMultiplier: number;
    globalDamageMultiplier: number;
    globalAttackCooldown: number; // in ms
    critChance: number; // 0.0 - 1.0

    // Perception
    perceptionRadiusSq: number;

    // Social Dynamics
    separationRadius: number;
    separationStrength: number;
    
    // Combat Positioning
    encirclementRadius: number;
    encirclementJitter: number;
    
    // Animation & Feel
    rotationSmoothing: number;
    laneSwaggerAmp: number;
    victoryPauseMs: number;
    
    // Tactical Scoring
    lanePenalty: number;
    baseProximityBonus: number;
    baseDefenseThreshold: number;
    baseAttackResponseBonus: number;
    bossPriorityBonus: number;
    lowHpBonus: number;
    
    // Steering & Recovery
    laneSpringFar: number;
    laneSpringNear: number;
    laneDriftThreshold: number;

    // World & Meta
    timeScale: number; // 1.0 = normal, 0.5 = slowmo, 2.0 = fast
    unitScale: number; // Visual scale multiplier
    vfxIntensity: number;
}
