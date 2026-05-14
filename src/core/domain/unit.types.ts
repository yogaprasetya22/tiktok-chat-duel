// ============================================================
// BATTLE SYSTEM - TYPE DEFINITIONS
// ============================================================
// All interfaces and types for the battle simulation system.
// This module has NO side effects and NO React dependencies.
// ============================================================

export type UnitRarity = "common" | "elite" | "epic" | "legendary";
export type ClassKey = "fighter" | "tank" | "mage" | "marksman" | "assassin";

export const WORLD_UNIT_POOL_SIZE = 300;

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
    skill_cooldown?: number;
    skill_range?: number;
    skill_duration?: number;
    ai_behavior: {
        separation: number;
        encirclement: number;
        swagger: number;
        perception_radius: number;
        chase_range: number;
    };
}

export type ClassConfig = Record<ClassKey, ClassStatusStats>;

export interface GiftBinding {
    keyword: string;
    formationId: string;
}

export interface TeamConfig {
    name: string;
    color: string;
    active: boolean;
    commentKeyword: string;
    commentType: "contains" | "exact";
    giftKeyword?: string;
    giftMultiplier?: number;
    giftBindings?: GiftBinding[];
    score?: number;
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
    criticalHitChance?: number;
    criticalMultiplier?: number;
}

export interface ActiveUnit extends UnitStats {
    id: string;
    type: "player" | "enemy";
    unitClass: ClassKey;
    userName: string;
    position?: [number, number, number];
    status: "idling" | "marching" | "attacking";
    targetId?: string;
    lastAttackTime: number;
    isDying?: boolean;
    deathTime?: number;
    isBoss: boolean;
    isShield?: boolean;
    animationOffset: number;
    attackCooldown: number;
    critChance: number;
    lastBlinkTime?: number;
    lastThinkTime?: number;
    isActive: boolean;
    pendingCrit?: boolean;
    isCriticalReady?: boolean;
    untargetableUntil?: number;
    isArmorBroken?: boolean;
    poolIdx: number;
    isBuffed: boolean;
    rarity?: UnitRarity;
    spawnTime?: number;
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
    unitClass: ClassKey;
    
    separationRadius: number;
    encirclementRadius: number;
    laneSwaggerAmp: number;
    perceptionRadiusSq: number;
    chaseRange: number;
    dSq?: number;
    pendingCrit?: boolean;
    lastEffectTime?: number;
    profileImage?: string;
    isShield?: boolean;
    poolIdx: number;
    isBuffed: boolean;
    isRolling?: boolean;
    spawnTime?: number;
    rarity?: UnitRarity;
    lastSkillTime?: number;
}

export interface SimulationSettings {
    globalHpMultiplier: number;
    globalSpeedMultiplier: number;
    globalDamageMultiplier: number;
    globalAttackCooldown: number;
    critChance: number;
    perceptionRadiusSq: number;
    separationRadius: number;
    separationStrength: number;
    encirclementRadius: number;
    encirclementJitter: number;
    rotationSmoothing: number;
    laneSwaggerAmp: number;
    victoryPauseMs: number;
    lanePenalty: number;
    baseProximityBonus: number;
    baseDefenseThreshold: number;
    baseAttackResponseBonus: number;
    bossPriorityBonus: number;
    lowHpBonus: number;
    laneSpringFar: number;
    laneSpringNear: number;
    laneDriftThreshold: number;
    timeScale: number;
    unitScale: number;
    vfxIntensity: number;
    maxUnits: number;
    treeCount?: number;
    treeScale?: number;
    fogNear?: number;
    fogFar?: number;
    fov?: number;
    mouseSensitivity?: number;
    vfxQuality?: 'LOW' | 'MEDIUM' | 'HIGH';
    treeDensity?: number;
    potatoMode: boolean;
    telemetry: {
        engineMs: number;
        unitCount: number;
        vfxCount: number;
        bucketCount: number;
        bottleneck: string;
    };
}
