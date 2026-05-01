// ============================================================
export type TeamType = 'player' | 'enemy';
export type ClassKey = 'fighter' | 'tank' | 'mage' | 'marksman' | 'assassin';

export const WORLD_UNIT_POOL_SIZE = 1500;
// This module has NO side effects and NO React dependencies.
// ============================================================

export interface UnitStats {
    hp: number;
    maxHp: number;
    hpRegen: number;
    attack: number;
    physicalDefense: number;
    magicDefense: number;
    physicalPen: number;
    magicPen: number;
    lifesteal: number;
    spellVamp: number;
    speed: number;
    range: number;
    tenacity: number;
    cooldownReduction: number;
    critDamage: number;
    critChance: number;
    level?: number;
}

export interface ClassStatusStats {
    hp: number;
    hp_regen: number;
    atk: number;
    physical_defense: number;
    magic_defense: number;
    physical_pen: number;
    magic_pen: number;
    lifesteal: number;
    spell_vamp: number;
    move_speed_mult: number;
    attack_speed_mult: number;
    crit_chance: number;
    crit_damage: number;
    range: number;
    tenacity: number;
    cooldown_reduction: number;
    skill_cooldown: number;   // New: Base cooldown for active skills (ms)
    skill_range: number;      // New: Range required to trigger skill
    skill_duration: number;    // New: How long the skill effect lasts (ms)
    ai_behavior: {
        separation: number;
        encirclement: number;
        swagger: number;
        perception_radius: number;
        chase_range: number;
    };
}

export type ClassConfig = Record<"fighter" | "tank" | "mage" | "marksman" | "assassin", ClassStatusStats>;

export interface GiftBinding {
    keyword: string;
    formationId: string; // References GIFT_FORMATIONS
}

export interface TeamConfig {
    name: string;
    color: string;
    active: boolean;
    commentKeyword: string;
    commentType: "contains" | "exact";
    giftKeyword?: string; // Kept for backwards compatibility
    giftBindings: GiftBinding[];
    score?: number;
    flagUrl?: string;
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


export type UnitRarity = 'common' | 'elite' | 'epic' | 'legendary';

export interface ActiveUnit extends UnitStats {
    id: string;
    type: "player" | "enemy";
    unitClass: "fighter" | "tank" | "mage" | "marksman" | "assassin";
    userName: string;
    position?: [number, number, number];
    status: "idling" | "marching" | "attacking";
    targetId?: string;
    lastAttackTime: number;
    isDying?: boolean;
    deathTime?: number;
    isBoss: boolean;
    animationOffset: number;
    isBuffed?: boolean;
    isShield?: boolean;
    isRolling?: boolean;
    attackCooldown: number;
    critChance: number;
    lastBlinkTime?: number;
    lastThinkTime?: number;
    isActive: boolean;
    pendingCrit?: boolean;
    isCriticalReady?: boolean;
    untargetableUntil?: number;
    profileImage?: string;
    rarity?: UnitRarity;
    isTeleporting?: boolean;
    isArmorBroken?: boolean;
    poolIdx: number;
    dSq?: number;
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
    profileImage?: string;
    rarity?: UnitRarity;
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
    profileImages: Record<string, string>;
    
    // Detailed Analytics
    classStats: Record<string, {
        damageDealt: number;
        damageTaken: number;
        kills: number;
        unitsSpawned: number;
        healing: number;
    }>;
    teamSummary: {
        player: { totalDamage: number; totalKills: number; unitsLost: number };
        enemy: { totalDamage: number; totalKills: number; unitsLost: number };
    };
}

/** Internal runtime data for each unit, stored in unitDataRef */
export interface UnitRuntimeData {
    id: string;
    isActive: boolean;
    hp: number;
    maxHp: number;
    status: string;
    position: [number, number, number];
    rotation: [number, number, number];
    userName: string;
    type: 'player' | 'enemy';
    level: number;
    isBoss: boolean;
    isDummy: boolean;
    laneOffset: number;
    lastAttackTime: number;
    isAttackingBase?: boolean;
    targetId?: string;
    range?: number;
    speed?: number;
    animationOffset: number;
    lastDamageTime: number;
    lastBlinkTime: number;
    isCriticalReady: boolean;
    untargetableUntil: number;
    victoryPauseUntil: number;
    jitterOffset: number;
    isDying?: boolean;
    isKiting?: boolean;
    unitClass: "fighter" | "tank" | "mage" | "marksman" | "assassin";
    
    // Class Behavior Overrides
    separationRadius: number;
    encirclementRadius: number;
    laneSwaggerAmp: number;
    perceptionRadiusSq: number;
    chaseRange: number;
    dSq?: number;
    pendingCrit?: boolean;
    lastEffectTime?: number;
    lastSkillTime?: number; // New: tracking skill cooldown
    isBuffed?: boolean;     // New: state for Eagle Eye
    isRolling?: boolean;    // New: state for Tactical Roll
    isShield?: boolean;      // New: state for Tank Shield
    isTeleporting?: boolean; // New: state for Assassin Teleport
    isArmorBroken?: boolean; // New: state for Armor Break (Fighter skill)
    profileImage?: string;
    rarity?: UnitRarity;
    spawnTime: number;
    poolIdx: number;
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
    maxUnits: number;

    // Performance & Diagnostics
    potatoMode: boolean;
    telemetry: {
        engineMs: number;
        unitCount: number;
        vfxCount: number;
        bucketCount: number;
        bottleneck: string;
    };
}

