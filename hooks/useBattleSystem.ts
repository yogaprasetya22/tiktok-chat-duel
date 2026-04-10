// ============================================================
// BATTLE SYSTEM - MAIN HOOK (Controller)
// ============================================================
// Orchestrates the simulation loop and exposes the public API.
// For tuning: edit constants.ts
// For types:  edit battle/types.ts
// For math:   edit battle/battleUtils.ts
// ============================================================

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import * as YUKA from "yuka";
import * as THREE from "three";
import { useStore } from "./useStore";

// --- Sub-module imports ---
export type {
    UnitStats,
    TeamConfig,
    TowerConfig,
    DamageText,
    ActiveUnit,
    MapObstacle,
    KillEvent,
    BattleStats,
    UnitRuntimeData,
    DamageQueueEntry,
    SimulationSettings,
} from "./battle/types";

import type {
    ActiveUnit,
    TowerConfig,
    MapObstacle,
    KillEvent,
    BattleStats,
    SimulationSettings,
    UnitRuntimeData,
} from "./battle/types";

import { 
    LANE_OFFSETS, 
    INITIAL_SETTINGS, 
    MAGE_PROJECTILE_TIME_MS,
    ENEMY_BASE_Z,
    PLAYER_BASE_Z,
    CLASS_CONFIG,
    WEATHER_CONFIG,
    CORPSE_DESPAWN_MS,
    ASSASSIN_BLINK_DISTANCE,
    ASSASSIN_BLINK_COOLDOWN,
    ASSASSIN_INVUL_MS
} from "./battle/constants";

import {
    getUnitStats,
    applyBossModifiers,
    calcDamage,
    pickRandom,
    SKIN_COLORS,
    OUTFIT_COLORS,
} from "./battle/battleUtils";

// ----------------------------------------------------------------

export const useBattleSystem = () => {
    const [mapObstacles, setMapObstacles] = useState<MapObstacle[]>([]);
    const [debug, setDebug] = useState(true);

    // References for UI state to avoid closure issues in setInterval
    const playerBaseHpRef = useRef(1000);
    const enemyBaseHpRef = useRef(1000);
    const gameStateRef = useRef<"SETUP" | "PLAYING" | "WON" | "LOST">("SETUP");

    // Performance Bridge: Sync Zustand settings to a Ref for 60fps access without re-renders
    const liveSettings = useStore((s) => s.settings);
    const settingsRef = useRef<SimulationSettings>(INITIAL_SETTINGS);
    useEffect(() => {
        settingsRef.current = liveSettings;
    }, [liveSettings]);
    const liveWeather = useStore((s) => s.weather);
    const weatherRef = useRef<keyof typeof WEATHER_CONFIG>("CLEAR");
    useEffect(() => {
        weatherRef.current = liveWeather;
    }, [liveWeather]);

    const statsRef = useRef<BattleStats>({
        damageDealt: {},
        playerDamage: {},
        enemyDamage: {},
        playerKills: {},
        enemyKills: {},
        unitsSpawned: {},
        playerHits: {},
        enemyHits: {},
        classStats: {
            fighter: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
            tank: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
            mage: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
            marksman: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
            assassin: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
        },
        teamSummary: {
            player: { totalDamage: 0, totalKills: 0, unitsLost: 0 },
            enemy: { totalDamage: 0, totalKills: 0, unitsLost: 0 },
        }
    });

    const entityManager = useMemo(() => new YUKA.EntityManager(), []);
    const vehicles = useRef<Map<string, YUKA.Vehicle>>(new Map());

    // Runtime data store — keyed by unit ID, holds position/rotation/status
    const unitDataRef = useRef<Map<string, UnitRuntimeData>>(new Map());

    const unitsRef = useRef<ActiveUnit[]>([]);
    const obstacleEntities = useRef<YUKA.GameEntity[]>([]);

    // Fix #5: O(1) unit lookup by ID — replaces Array.find() in hot simulation loop
    const unitIndexRef = useRef<Map<string, ActiveUnit>>(new Map());

    // Performance: Pre-allocated pools (zero-allocation loop)
    const spellsRef = useRef<any[]>(
        Array.from({ length: 300 }, () => ({
            fromX: 0, fromY: 1, fromZ: 0,
            toX: 0,   toY: 1,   toZ: 0,
            progress: 0, startTime: 0, active: false,
        }))
    );

    const pUnitsPoolRef = useRef<ActiveUnit[]>([]);
    const eUnitsPoolRef = useRef<ActiveUnit[]>([]);
    const simulationTimeRef = useRef<number>(0); // Accumulated sim time for cooldowns
    const bucketsMapRef = useRef<Map<number, number[]>>(new Map());
    const lastReactSyncRef = useRef<number>(0);
    const lastHpMultiplierRef = useRef<number>(INITIAL_SETTINGS.globalHpMultiplier);

    // Performance: Analytics history for debugging (Downloadable)
    const perfHistoryRef = useRef<{ t: number, e: number, u: number, v: number, f: number }[]>([]);

    // Dynamic HP Scaling is now handled in PASS 0 of updateSimulation for maximum responsiveness
    const updateSettingsRef = useCallback((key: keyof SimulationSettings, value: any) => {
        (settingsRef.current as any)[key] = value;
    }, []);

    // Performance: Damage event queue (consumed by DamageHUDBatcher)
    const damageQueueRef = useRef<{
        value: number;
        position: [number, number, number];
        isCrit: boolean;
        color: string;
        timestamp: number;
    }[]>([]);
    
    const pendingDamageRef = useRef<{
        targetId: string;
        damage: number;
        hitTime: number;
        position: [number, number, number];
        color: string;
        attackerName: string;
        attackerClass: string;
        attackerId: string;
    }[]>([]);
    
    const [towerConfig, setTowerConfig] = useState<TowerConfig>({
        player: {
            name: "Pihak A",
            color: "#0066FF",
            active: true,
            commentKeyword: "indo",
            commentType: "contains",
            giftKeyword: "rose",
        },
        enemy: {
            name: "Pihak B",
            color: "#FF0033",
            active: true,
            commentKeyword: "malay",
            commentType: "contains",
            giftKeyword: "coffee",
        },
        baseHp: 1000,
        baseDistance: 24,
        maxUnits: 20,
        unitConfig: {
            hpMultiplier: 1.0,
            speedMultiplier: 1.0,
            attackMultiplier: 1.0,
        },
    });

    const towerConfigRef = useRef(towerConfig);
    useEffect(() => { towerConfigRef.current = towerConfig; }, [towerConfig]);

    // ----------------------------------------------------------------
    // DAMAGE AGGREGATION SYSTEM
    // ----------------------------------------------------------------

    const damageBufferRef = useRef<
        Map<string, { total: number; position: [number, number, number]; lastHit: number; color: string }>
    >(new Map());

    const flushDamageBuffer = useCallback((now: number) => {
        damageBufferRef.current.forEach((data, targetId) => {
            if (now - data.lastHit > 150) {
                // CAP: Don't let the queue explode!
                if (damageQueueRef.current.length < 500) {
                    damageQueueRef.current.push({
                        value: data.total,
                        position: data.position,
                        isCrit: data.total > 150,
                        color: data.color,
                        timestamp: now,
                    });
                }
                damageBufferRef.current.delete(targetId);
            }
        });
    }, []);

    const accumulateDamage = (
        targetId: string,
        value: number,
        position: number[],
        color: string,
    ) => {
        // Leaderboard tracking
        const attacker = unitsRef.current.find(u =>
            u && !u.isDying && u.id &&
            Math.abs((unitDataRef.current.get(u.id)?.position[2] || 0) - position[2]) < 6
        );
        if (attacker?.userName) {
            if (attacker.type === "player")
                statsRef.current.playerDamage[attacker.userName] = (statsRef.current.playerDamage[attacker.userName] || 0) + value;
            else
                statsRef.current.enemyDamage[attacker.userName] = (statsRef.current.enemyDamage[attacker.userName] || 0) + value;
        }

        const existing = damageBufferRef.current.get(targetId);
        if (existing) {
            existing.total += value;
            existing.position = [...position] as [number, number, number];
            existing.lastHit = Date.now();
        } else {
            damageBufferRef.current.set(targetId, {
                total: value,
                position: [...position] as [number, number, number],
                lastHit: Date.now(),
                color,
            });
        }
    };

    // ----------------------------------------------------------------
    // OBSTACLE SYNC
    // ----------------------------------------------------------------

    useEffect(() => {
        obstacleEntities.current.forEach((obs) => entityManager.remove(obs));
        obstacleEntities.current = [];
        mapObstacles.forEach((obs) => {
            const entity = new YUKA.GameEntity();
            entity.position.set(obs.x, -0.4, obs.z);
            entity.boundingRadius = obs.r;
            entityManager.add(entity);
            obstacleEntities.current.push(entity);
        });
    }, [mapObstacles, entityManager]);

    // ----------------------------------------------------------------
    // BATTLE CONTROLS
    // ----------------------------------------------------------------

    const resetBattle = useCallback(() => {
        useStore.getState().resetStore(towerConfigRef.current);
        useStore.getState().setLiveStats({
            damageDealt: {}, playerDamage: {}, enemyDamage: {},
            playerKills: {}, enemyKills: {}
        });
        
        vehicles.current.forEach((v) => entityManager.remove(v));
        vehicles.current.clear();
        unitDataRef.current.clear();
        unitIndexRef.current.clear(); // Fix #5: clear index on reset

        playerBaseHpRef.current = towerConfig.baseHp;
        enemyBaseHpRef.current = towerConfig.baseHp;
        gameStateRef.current = "PLAYING";

        useStore.getState().resetStore(towerConfig);
        unitsRef.current = [];

            statsRef.current = {
                damageDealt: {},
                playerDamage: {},
                enemyDamage: {},
                playerKills: {},
                enemyKills: {},
                unitsSpawned: {},
                playerHits: {},
                enemyHits: {},
                classStats: {
                    fighter: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
                    tank: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
                    mage: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
                    marksman: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
                    assassin: { damageDealt: 0, damageTaken: 0, kills: 0, unitsSpawned: 0, healing: 0 },
                },
                teamSummary: {
                    player: { totalDamage: 0, totalKills: 0, unitsLost: 0 },
                    enemy: { totalDamage: 0, totalKills: 0, unitsLost: 0 },
                }
            };
    }, [towerConfig.baseHp, entityManager]);

    const lastStateUpdate = useRef<number>(0);

    // ---- PERF: Throttled Zustand Bridge ----
    // Buffer base HP updates — only sync to React every 100ms instead of every hit
    const lastBaseHpSyncRef = useRef<number>(0);
    const baseHpDirtyRef = useRef(false);

    const markBaseHpDirty = () => { baseHpDirtyRef.current = true; };
    const flushBaseHpIfNeeded = (now: number) => {
        if (baseHpDirtyRef.current && now - lastBaseHpSyncRef.current > 100) {
            useStore.getState().setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
            lastBaseHpSyncRef.current = now;
            baseHpDirtyRef.current = false;
        }
    };

    // Buffer kill events — accumulate and flush every 150ms
    const killEventBufferRef = useRef<KillEvent[]>([]);
    const lastKillFlushRef = useRef<number>(0);

    const flushKillEvents = (now: number) => {
        if (killEventBufferRef.current.length > 0 && now - lastKillFlushRef.current > 150) {
            const store = useStore.getState();
            const events = killEventBufferRef.current;
            // Batch-add all buffered kills in a single setState
            useStore.setState((state) => ({
                killEvents: [...state.killEvents, ...events].slice(-5)
            }));
            killEventBufferRef.current = [];
            lastKillFlushRef.current = now;
        }
    };

    const triggerAirstrike = useCallback((side: "player" | "enemy") => {
        const targets = unitsRef.current.filter(u => u && u.type !== side && !u.isDying);
        targets.forEach(u => {
            if (u?.id) {
                const entry = unitDataRef.current.get(u.id);
                if (entry) entry.hp -= 30;
            }
        });
    }, []);

    const addKillEvent = useCallback(
        (killer: string, victim: string, victimType: KillEvent["victimType"]) => {
            // Buffer instead of immediate Zustand set
            killEventBufferRef.current.push({
                id: Math.random().toString(36).substring(7),
                killer,
                victim,
                victimType,
                timestamp: Date.now(),
            });
        },
        [],
    );

    // ----------------------------------------------------------------
    // UNIT SPAWNING
    // ----------------------------------------------------------------

    const spawnUnit = useCallback(
        (
            level: number = 1,
            _userName: string = "Guest",
            type: "player" | "enemy" = "player",
            isBoss: boolean = false,
            forcedClass?: "fighter" | "tank" | "mage" | "marksman" | "assassin",
        ) => {
            const userName = _userName.trim().substring(0, 16);
            const isTestingBot =
                userName === towerConfigRef.current.player.name ||
                userName === towerConfigRef.current.enemy.name;
            const userActiveUnits = unitsRef.current.filter(u => u && u.userName === userName && !u.isDying).length;
            if (!isBoss && !isTestingBot && (useStore.getState().gameMode !== 'TRAINING') && userActiveUnits >= 3)
                return;


            // No setState needed, we rely completely on unitsRef in engine
            const teamUnits = unitsRef.current.filter((u) => u && u.type === type && !u.isDying);
            if (!isBoss && teamUnits.length >= towerConfigRef.current.maxUnits) return;

                statsRef.current.unitsSpawned[userName] = (statsRef.current.unitsSpawned[userName] || 0) + 1;

                let stats = getUnitStats(level, towerConfigRef.current.unitConfig, settingsRef.current);
                if (isBoss) stats = applyBossModifiers(stats);

                const rand = Math.random();
                const unitClass = forcedClass || (
                    rand < 0.35 ? "fighter" : 
                    rand < 0.55 ? "tank" : 
                    rand < 0.75 ? "mage" : 
                    rand < 0.90 ? "marksman" : "assassin"
                );
                const laneOffset = isBoss ? 0 : pickRandom(LANE_OFFSETS);

                const c = CLASS_CONFIG[unitClass];
                
                // Map new CLASS_CONFIG stats (snake_case to camelCase)
                stats.hp *= c.hp;
                stats.maxHp *= c.hp;
                stats.hpRegen = c.hp_regen;
                stats.attack *= c.atk;
                stats.physicalDefense = c.physical_defense;
                stats.magicDefense = c.magic_defense;
                stats.physicalPen = c.physical_pen;
                stats.magicPen = c.magic_pen;
                stats.lifesteal = c.lifesteal;
                stats.spellVamp = c.spell_vamp;
                stats.speed *= c.move_speed_mult;
                stats.range = c.range; 
                stats.tenacity = c.tenacity;
                stats.cooldownReduction = c.cooldown_reduction;
                stats.critDamage = c.crit_damage;
                stats.critChance = c.crit_chance;

                // Calculate attack cooldown (attack_speed_mult: higher = faster)
                const baseCooldown = settingsRef.current.globalAttackCooldown;
                const unitAttackCooldown = baseCooldown / (c.attack_speed_mult || 1.0);

                const speedVariation = 0.8 + Math.random() * 0.4;
                const actualSpeed = stats.speed * speedVariation;

                const unitId = `${type}-${Math.random().toString(36).substring(2, 9)}`;
                const distance = towerConfigRef.current.baseDistance || 24;
                const jitterX = (Math.random() - 0.5) * 8.0;
                const jitterZ = (Math.random() - 0.5) * 8.0;
                const spawnZ = type === "player" ? distance - 2 : -(distance) + 2;
                const spawnPos = [
                    laneOffset + jitterX,
                    -0.4,
                    spawnZ + jitterZ,
                ] as [number, number, number];

                const isDummy = type === "enemy" && userName === "Training";

                const vehicle = new YUKA.Vehicle();
                vehicle.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);
                vehicle.maxSpeed = actualSpeed; 
                vehicle.updateOrientation = false;

                vehicle.maxForce = 350; 
                vehicle.velocity.set(0, 0, 0);

                const globalUnitScale = settingsRef.current.unitScale;
                const baseScale = isBoss ? 4.5 : (isDummy ? 3.0 : (1.5 + (level || 1) * 0.1));
                const finalScale = baseScale * globalUnitScale;
                vehicle.boundingRadius = (isBoss ? 4.0 : 1.6) * finalScale;

                const obstacleAvoidance = new YUKA.ObstacleAvoidanceBehavior(obstacleEntities.current);
                obstacleAvoidance.weight = 3.0;
                vehicle.steering.add(obstacleAvoidance);

                const distance2 = towerConfigRef.current.baseDistance || 24;
                const targetBaseZ = type === "player" ? -distance2 : distance2;
                const seek = new YUKA.SeekBehavior(
                    new YUKA.Vector3(laneOffset, -0.4, targetBaseZ),
                );
                seek.weight = 1.0;
                vehicle.steering.add(seek);


                const separation = new YUKA.SeparationBehavior();
                separation.weight = 2.0; 
                vehicle.steering.add(separation);


                entityManager.add(vehicle);
                vehicles.current.set(unitId, vehicle);

                const newUnit: ActiveUnit = {
                    id: unitId,
                    type,
                    userName,
                    ...stats,
                    speed: actualSpeed,
                    status: "marching",
                    lastAttackTime: 0,
                    isBoss,
                    animationOffset: Math.random() * 100,
                    unitClass,
                    attackCooldown: unitAttackCooldown,
                    critChance: c.crit_chance,
                };

                const runtimeData: UnitRuntimeData = {
                    id: unitId,
                    type,
                    hp: stats.hp,
                    maxHp: stats.maxHp,
                    isBoss,
                    status: "marching",
                    position: spawnPos,
                    rotation: [0, type === "player" ? Math.PI : 0, 0],
                    userName,
                    level,
                    isDummy,
                    jitterOffset: Math.random() * Math.PI * 2,
                    unitClass,
                    separationRadius: c.ai_behavior.separation,
                    encirclementRadius: c.ai_behavior.encirclement,
                    laneSwaggerAmp: c.ai_behavior.swagger,
                    perceptionRadiusSq: c.ai_behavior.perception_radius,
                    chaseRange: c.ai_behavior.chase_range,
                    laneOffset,
                    lastAttackTime: 0,
                    animationOffset: Math.random() * 100,
                    lastDamageTime: 0,
                    lastBlinkTime: 0,
                    isCriticalReady: false,
                    untargetableUntil: 0,
                    victoryPauseUntil: 0,
                };
                unitDataRef.current.set(unitId, runtimeData);

                unitsRef.current.push(newUnit);
                unitIndexRef.current.set(unitId, newUnit); // Fix #5: register in O(1) index
        },
        [entityManager],
    );

    // ----------------------------------------------------------------
    // SIMULATION LOOP (The Heart — runs every frame via useFrame)
    // ----------------------------------------------------------------

    const updateSimulation = useCallback((delta: number) => {
        const perfStart = performance.now();
        const settings = settingsRef.current;
        const simDelta = delta * (settings.timeScale || 1.0);
        simulationTimeRef.current += simDelta * 1000;
        const simNow = simulationTimeRef.current;
        const now = Date.now();
        
        if (gameStateRef.current !== "PLAYING") return;

        // ---- PASS 0: Reactive HP Scaling (Direct Ref Check) ----
        const currentHpMult = settings.globalHpMultiplier;
        if (Math.abs(currentHpMult - lastHpMultiplierRef.current) > 0.001) {
            const ratio = currentHpMult / lastHpMultiplierRef.current;
            unitsRef.current.forEach(u => {
                if (u) {
                    u.maxHp *= ratio; u.hp *= ratio;
                    const data = unitDataRef.current.get(u.id);
                    if (data) { data.maxHp *= ratio; data.hp *= ratio; }
                }
            });
            lastHpMultiplierRef.current = currentHpMult;
        }

        // ---- PASS 0.5: HP Regeneration ----
        unitsRef.current.forEach(u => {
            if (u && u.hp > 0 && !u.isDying && u.hpRegen > 0) {
                const regenAmount = u.hpRegen * delta * settings.timeScale;
                u.hp = Math.min(u.maxHp, u.hp + regenAmount);
                const data = unitDataRef.current.get(u.id);
                if (data) data.hp = u.hp;
            }
        });

        // Dynamic Time Scale: Adjust simDelta based on settings to avoid giant jumps on low FPS
        const physicsDelta = Math.min(0.05, delta) * (settings.timeScale || 1.0);
        entityManager.update(physicsDelta);
        flushDamageBuffer(now);

        // --- Process Delayed Hits (Mage Projectiles) ---
        if (pendingDamageRef.current.length > 0) {
            const hits = pendingDamageRef.current;
            for (let i = hits.length - 1; i >= 0; i--) {
                const h = hits[i];
                if (simNow >= h.hitTime) {
                    const isBase = h.targetId === 'player-base' || h.targetId === 'enemy-base';
                    
                    if (isBase) {
                        const damage = h.damage;
                        if (h.targetId === 'enemy-base') {
                            enemyBaseHpRef.current = Math.max(0, enemyBaseHpRef.current - damage);
                        } else {
                            playerBaseHpRef.current = Math.max(0, playerBaseHpRef.current - damage);
                        }
                        markBaseHpDirty(); // Buffered — syncs every 100ms
                        accumulateDamage(h.targetId, damage, h.position, h.color);
                    } else {
                        const target = unitIndexRef.current.get(h.targetId);
                        if (target && target.hp > 0 && !target.isDying) {
                            const tData = unitDataRef.current.get(h.targetId);
                            if (tData) {
                                // Check if target is untargetable (Assassin Vanish)
                                if (tData.untargetableUntil > simNow) return; 

                                target.hp -= h.damage;
                                tData.hp = target.hp;
                                tData.lastDamageTime = now;
                            
                            // Analytics: Class & Team Tracking
                            const attackerClass = h.attackerClass || 'fighter';
                            const victimClass = target.unitClass || 'fighter';
                            const stats = statsRef.current;
                            
                            if (stats.classStats[attackerClass]) stats.classStats[attackerClass].damageDealt += h.damage;
                            if (stats.classStats[victimClass]) stats.classStats[victimClass].damageTaken += h.damage;
                            
                            if (h.attackerName) {
                                if (h.attackerId.startsWith('p')) { // Check attacker team
                                    stats.teamSummary.player.totalDamage += h.damage;
                                } else {
                                    stats.teamSummary.enemy.totalDamage += h.damage;
                                }
                            }

                                // Lifesteal/SpellVamp for delayed hits (Ranged)
                                const attacker = unitIndexRef.current.get(h.attackerId);
                                if (attacker) {
                                    const isMage = h.attackerClass === 'mage';
                                    const healMult = isMage ? attacker.spellVamp : attacker.lifesteal;
                                    
                                    if (healMult > 0) {
                                        attacker.hp = Math.min(attacker.maxHp, attacker.hp + h.damage * healMult);
                                        const aData = unitDataRef.current.get(h.attackerId);
                                        if (aData) aData.hp = attacker.hp;
                                    }
                                }

                                accumulateDamage(target.id, h.damage, tData.position, h.color);
                                
                                if (target.hp <= 0) {
                                    addKillEvent(h.attackerName, target.userName, target.isBoss ? "boss" : "unit");
                                    // Analytics: Death tracking
                                    const stats = statsRef.current;
                                    if (h.attackerName) {
                                        if (h.attackerId.startsWith('p')) {
                                            stats.playerKills[h.attackerName] = (stats.playerKills[h.attackerName] || 0) + 1;
                                            stats.teamSummary.player.totalKills += 1;
                                            stats.teamSummary.enemy.unitsLost += 1;
                                        } else {
                                            stats.enemyKills[h.attackerName] = (stats.enemyKills[h.attackerName] || 0) + 1;
                                            stats.teamSummary.enemy.totalKills += 1;
                                            stats.teamSummary.player.unitsLost += 1;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    hits.splice(i, 1);
                }
            }
        }

        // ---- PASS 0: Corpse Cleanup ----
        if (now - lastReactSyncRef.current > 1500) {
            for (let i = unitsRef.current.length - 1; i >= 0; i--) {
                const u = unitsRef.current[i];
                if (u && u.isDying && u.deathTime && now - u.deathTime > CORPSE_DESPAWN_MS) {
                    const v = vehicles.current.get(u.id);
                    if (v) entityManager.remove(v);
                    vehicles.current.delete(u.id);
                    unitDataRef.current.delete(u.id);
                    unitIndexRef.current.delete(u.id);
                    unitsRef.current.splice(i, 1);
                }
            }
            lastReactSyncRef.current = now;
        }

        const pUnits = pUnitsPoolRef.current;
        const eUnits = eUnitsPoolRef.current;
        pUnits.length = 0; eUnits.length = 0;

        for (let i = 0; i < unitsRef.current.length; i++) {
            const u = unitsRef.current[i];
            if (u && u.id && !u.isDying) {
                if (u.type === "player") pUnits.push(u);
                else eUnits.push(u);
            }
        }

        // ---- PASS 1: AI Movement & Combat ----
        for (let i = 0; i < unitsRef.current.length; i++) {
            const u = unitsRef.current[i];
            if (!u || u.isDying) continue;
            const uData = unitDataRef.current.get(u.id);
            if (!uData) continue;

            // ---- PASS 1: Weather Multipliers ----
            const weather = weatherRef.current;
            const wConfig = WEATHER_CONFIG[weather];
            const wMults = (wConfig as any).multipliers || {};
            const classMults = wMults[u.unitClass] || {};
            
            // Speed Multiplier
            const weatherSpeedMult = (classMults.move_speed_mult || 1.0) * (wMults.globalSpeedMultiplier || 1.0);
            
            // Attack Speed Multiplier
            const weatherAtkSpeedMult = classMults.attack_speed_mult || 1.0;
            
            // Damage Multiplier
            const weatherDmgMult = (classMults.atk || 1.0) * (wMults.globalDamageMultiplier || 1.0);
            
            // Cooldown Multiplier
            const weatherCooldownMult = wMults.globalAttackCooldown || 1.0;

            if (u.hp <= 0) { 
                u.isDying = true; 
                u.deathTime = now; 
                uData.isDying = true;
                const v = vehicles.current.get(u.id);
                if (v) { v.maxSpeed = 0; v.velocity.set(0, 0, 0); }
                continue; 
            }

            // Human Behavior: Victory Pause after kill
            if (now < uData.victoryPauseUntil) {
                uData.status = "idle";
                const v = vehicles.current.get(u.id);
                if (v) { v.maxSpeed = 0; v.velocity.set(0, 0, 0); }
                continue;
            }

            let currentTarget: ActiveUnit | null = null;

            // --- DECENTRALIZED AI FALLBACK ---
            const distToBaseSq = Math.pow(uData.position[2] - (u.type === "player" ? ENEMY_BASE_Z : PLAYER_BASE_Z), 2);
            const attackRangeSq = u.range * u.range;
            const canReachBase = distToBaseSq < attackRangeSq;
            uData.isAttackingBase = false;


            // Commit Combat State
            const currentTarget_lookup = u.targetId ? unitIndexRef.current.get(u.targetId) : null;
            currentTarget = currentTarget_lookup || null;
            
            // DECISION: Attack Unit (Highest Priority) or Base (Fallback)
            if (currentTarget) {
                uData.isAttackingBase = false;
            } else if (canReachBase) {
                uData.isAttackingBase = true;
                uData.status = "attacking";
                
                // --- COMMIT BASE DAMAGE ---
                const weatherAdjCooldown = settingsRef.current.globalAttackCooldown * weatherCooldownMult;
                const baseAttackCooldown = (u.isBoss ? weatherAdjCooldown * 0.7 : weatherAdjCooldown) / weatherAtkSpeedMult;
                if (simNow - uData.lastAttackTime > baseAttackCooldown) {
                    const dummyTargetStats = { physicalDefense: 0, magicDefense: 0 } as any;
                    const { damage: rawDamage } = calcDamage(u, dummyTargetStats, u.unitClass === 'mage');
                    const damage = rawDamage * weatherDmgMult;
                    if (u.type === "player") {
                        enemyBaseHpRef.current = Math.max(0, enemyBaseHpRef.current - damage);
                        if (enemyBaseHpRef.current === 0 && gameStateRef.current === "PLAYING") addKillEvent(u.userName, towerConfigRef.current.enemy.name, "base");
                        markBaseHpDirty(); // Buffered — syncs every 100ms
                        accumulateDamage("enemy-base", damage, [0, 5, ENEMY_BASE_Z], towerConfigRef.current.player.color);
                    } else {
                        playerBaseHpRef.current = Math.max(0, playerBaseHpRef.current - damage);
                        if (playerBaseHpRef.current === 0 && gameStateRef.current === "PLAYING") addKillEvent(u.userName, towerConfigRef.current.player.name, "base");
                        markBaseHpDirty(); // Buffered — syncs every 100ms
                        accumulateDamage("player-base", damage, [0, 5, PLAYER_BASE_Z], towerConfigRef.current.enemy.color);
                    }
                    uData.lastAttackTime = simNow;
                    statsRef.current.damageDealt[u.userName] = (statsRef.current.damageDealt[u.userName] || 0) + damage;
                }
            }

            // Target validation
            if (currentTarget && (currentTarget.hp <= 0 || currentTarget.isDying)) {
                u.targetId = undefined;
                currentTarget = null;
            }

            // Unit attack engagement
            if (currentTarget) {
                const tData = unitDataRef.current.get(currentTarget.id);
                if (tData) {
                    const dSq = (uData.position[0] - tData.position[0]) ** 2 + (uData.position[2] - tData.position[2]) ** 2;
                    const dynamicRangeSq = (u.range + (u.id.charCodeAt(0) % 5) * 0.1) ** 2;

                    // --- ASSASSIN TELEPORT LOGIC ---
                    if (u.unitClass === 'assassin' && (simNow - uData.lastBlinkTime > ASSASSIN_BLINK_COOLDOWN)) {
                        if (dSq < ASSASSIN_BLINK_DISTANCE * ASSASSIN_BLINK_DISTANCE && dSq > 2.0 * 2.0) {
                            const v = vehicles.current.get(u.id);
                            if (v) {
                                const dx = tData.position[0] - uData.position[0];
                                const dz = tData.position[2] - uData.position[2];
                                const dist = Math.sqrt(dx * dx + dz * dz);
                                const nx = dx / dist; const nz = dz / dist;
                                
                                const blinkX = tData.position[0] - nx * 0.7;
                                const blinkZ = tData.position[2] - nz * 0.7;
                                
                                v.position.set(blinkX, -0.4, blinkZ);
                                uData.position = [blinkX, -0.4, blinkZ];
                                uData.lastBlinkTime = simNow;
                                uData.isCriticalReady = true;
                                uData.untargetableUntil = simNow + ASSASSIN_INVUL_MS;
                                uData.status = "attacking";
                            }
                        }
                    }

                    if (dSq < dynamicRangeSq || uData.status === 'attacking') {
                        uData.status = "attacking"; uData.isAttackingBase = false;
                        
                        const weatherAdjCooldown = u.attackCooldown * weatherCooldownMult;
                        const finalAtkCooldown = weatherAdjCooldown / weatherAtkSpeedMult;
                        
                        if (simNow - uData.lastAttackTime > finalAtkCooldown) {
                            const teamColor = u.type === "player" ? towerConfig.player.color : towerConfig.enemy.color;
                            let finalDmg = 0;

                            if (u.unitClass === 'mage' || u.unitClass === 'marksman') {
                                const { damage: rawDmg } = calcDamage(u, currentTarget, u.unitClass === 'mage');
                                finalDmg = rawDmg * weatherDmgMult;
                                const travelTime = u.unitClass === 'mage' ? MAGE_PROJECTILE_TIME_MS : 200;
                                
                                pendingDamageRef.current.push({
                                    targetId: currentTarget.id,
                                    damage: finalDmg,
                                    hitTime: simNow + travelTime, 
                                    position: [...tData.position] as [number, number, number],
                                    color: teamColor,
                                    attackerName: u.userName,
                                    attackerClass: u.unitClass,
                                    attackerId: u.id
                                });
                                
                                const availableSlot = spellsRef.current.find(s => !s.active);
                                if (availableSlot) {
                                    availableSlot.active = true;
                                    availableSlot.progress = 0;
                                    availableSlot.fromX = uData.position[0];
                                    availableSlot.fromY = 1.6;
                                    availableSlot.fromZ = uData.position[2];
                                    availableSlot.toX = tData.position[0];
                                    availableSlot.toY = 1.0;
                                    availableSlot.toZ = tData.position[2];
                                    availableSlot.startTime = simNow;
                                    availableSlot.color = u.unitClass === 'marksman' ? '#ffcc00' : teamColor;
                                    availableSlot.targetId = currentTarget.id;
                                    (availableSlot as any).isBullet = u.unitClass === 'marksman';
                                }
                            } else {
                                // MELEE HIT
                                if (tData.untargetableUntil > simNow) {
                                    uData.lastAttackTime = simNow;
                                    return;
                                }

                                let { damage: rawDmg } = calcDamage(u, currentTarget, false);
                                
                                if (uData.isCriticalReady) {
                                    rawDmg = u.attack * u.critDamage * 1.5;
                                    uData.isCriticalReady = false;
                                }
                                
                                finalDmg = rawDmg * weatherDmgMult;
                                currentTarget.hp -= finalDmg;
                                tData.hp = currentTarget.hp;
                                tData.lastDamageTime = now;

                                const healMult = u.lifesteal + (u.spellVamp * 0.5); 
                                if (healMult > 0) {
                                    u.hp = Math.min(u.maxHp, u.hp + finalDmg * healMult);
                                    uData.hp = u.hp;
                                }

                                accumulateDamage(currentTarget.id, finalDmg, tData.position, teamColor);

                                if (currentTarget.hp <= 0) {
                                    u.targetId = undefined;
                                    uData.victoryPauseUntil = now + settingsRef.current.victoryPauseMs;
                                    uData.status = "idle";
                                    addKillEvent(u.userName, currentTarget.userName, currentTarget.isBoss ? "boss" : "unit");

                                    // Analytics: Death tracking
                                    const stats = statsRef.current;
                                    if (stats.classStats[u.unitClass]) stats.classStats[u.unitClass].kills += 1;
                                    if (u.type === 'player') {
                                        stats.playerKills[u.userName] = (stats.playerKills[u.userName] || 0) + 1;
                                        stats.teamSummary.player.totalKills += 1;
                                        stats.teamSummary.enemy.unitsLost += 1;
                                    } else {
                                        stats.enemyKills[u.userName] = (stats.enemyKills[u.userName] || 0) + 1;
                                        stats.teamSummary.enemy.totalKills += 1;
                                        stats.teamSummary.player.unitsLost += 1;
                                    }
                                }
                            }
                            
                            uData.lastAttackTime = simNow;
                            statsRef.current.damageDealt[u.userName] = (statsRef.current.damageDealt[u.userName] || 0) + finalDmg;
                            if (u.type === 'player') {
                                statsRef.current.playerDamage[u.userName] = (statsRef.current.playerDamage[u.userName] || 0) + finalDmg;
                            } else {
                                statsRef.current.enemyDamage[u.userName] = (statsRef.current.enemyDamage[u.userName] || 0) + finalDmg;
                            }
                        }
                    }
                }
            }

            const vehicle = vehicles.current.get(u.id);
            if (vehicle) {
                const limitEdgeZ = (towerConfigRef.current.baseDistance || 24) - 2;
                if (vehicle.position.z < -limitEdgeZ) vehicle.position.z = -limitEdgeZ;
                if (vehicle.position.z > limitEdgeZ) vehicle.position.z = limitEdgeZ;

                uData.position[0] = vehicle.position.x;
                uData.position[2] = vehicle.position.z;
            }
        }


        // ---- PASS 2: Social Dynamics / Spatial Partitioning (Optimized) ----
        const GRID_SIZE = 4;
        const buckets = bucketsMapRef.current;
        buckets.clear();

        for (let i = 0; i < unitsRef.current.length; i++) {
            const u = unitsRef.current[i];
            if (!u || u.isDying) continue;
            const uData = unitDataRef.current.get(u.id);
            if (!uData) continue;
            
            const bIdx = Math.floor(uData.position[2] / GRID_SIZE);
            let bucket = buckets.get(bIdx);
            if (!bucket) { bucket = []; buckets.set(bIdx, bucket); }
            bucket.push(i);
        }

        buckets.forEach((indices, bIdx) => {
            const neighborIndicesNext = buckets.get(bIdx + 1);
            
            for (let i = 0; i < indices.length; i++) {
                const idxA = indices[i];
                const uA = unitsRef.current[idxA];
                const uDataA = unitDataRef.current.get(uA.id)!;
                
                for (let j = i + 1; j < indices.length; j++) {
                    solveSocialDynamics(uA, uDataA, unitsRef.current[indices[j]]);
                }
                
                if (neighborIndicesNext) {
                    for (let j = 0; j < neighborIndicesNext.length; j++) {
                        solveSocialDynamics(uA, uDataA, unitsRef.current[neighborIndicesNext[j]]);
                    }
                }
            }
        });

        function solveSocialDynamics(uA: any, uDataA: any, uB: any) {
            if (uB.isDying || uA.type !== uB.type) return;
            const uDataB = unitDataRef.current.get(uB.id)!;
            let dx = uDataA.position[0] - uDataB.position[0];
            let dz = uDataA.position[2] - uDataB.position[2];
            let distSq = dx * dx + dz * dz;

            if (distSq < 0.0001) {
                dx = (Math.random() - 0.5) * 0.1;
                dz = (Math.random() - 0.5) * 0.1;
                distSq = dx * dx + dz * dz;
            }
            
            const comfortZone = (uDataA.separationRadius || 1.1) + (uDataB.separationRadius || 1.1);
            
            if (distSq < comfortZone * comfortZone) {
                const dist = Math.sqrt(distSq) || 0.001;
                const overlap = comfortZone - dist;
                const weightA = (uDataA.status === 'attacking' && !uDataA.isKiting) ? 0.0 : 1.0;
                const weightB = (uDataB.status === 'attacking' && !uDataB.isKiting) ? 0.0 : 1.0;
                
                const totalWeight = weightA + weightB;
                if (totalWeight > 0) {
                    const pushStrength = settingsRef.current.separationStrength * (1.0 - dist / comfortZone) * 0.5;
                    const nx = dx / dist; const nz = dz / dist;
                    const force = overlap * pushStrength;
                    
                    const forceA = force * (weightA / totalWeight);
                    const forceB = force * (weightB / totalWeight);

                    uDataA.position[0] += nx * forceA; uDataA.position[2] += nz * forceA;
                    uDataB.position[0] -= nx * forceB; uDataB.position[2] -= nz * forceB;

                    const vA = vehicles.current.get(uA.id);
                    const vB = vehicles.current.get(uB.id);
                    if (vA) { vA.position.x = uDataA.position[0]; vA.position.z = uDataA.position[2]; }
                    if (vB) { vB.position.x = uDataB.position[0]; vB.position.z = uDataB.position[2]; }
                }
            }
        }

        // ---- PASS 3: Flush All Buffered Zustand Updates ----
        flushBaseHpIfNeeded(now);
        flushKillEvents(now);

        // Stats sync (500ms throttle — already optimal)
        if (now - lastStateUpdate.current > 500) {
            lastStateUpdate.current = now;
            
            let _pC = 0, _eC = 0;
            for(let i=0; i<unitsRef.current.length; i++) {
                const u = unitsRef.current[i];
                if (u && !u.isDying && u.hp > 0) { if (u.type === "player") _pC++; else _eC++; }
            }
            
            useStore.getState().setArmyCounts(_pC, _eC);
            useStore.getState().setLiveStats({
                damageDealt: { ...statsRef.current.damageDealt },
                playerDamage: { ...statsRef.current.playerDamage },
                enemyDamage: { ...statsRef.current.enemyDamage },
                playerKills: { ...statsRef.current.playerKills },
                enemyKills: { ...statsRef.current.enemyKills },
            });
        }

        // Win/Loss check
        if (gameStateRef.current === "PLAYING") {
            if (playerBaseHpRef.current <= 0) { gameStateRef.current = "LOST"; useStore.getState().setGameState("LOST"); }
            else if (enemyBaseHpRef.current <= 0) { gameStateRef.current = "WON"; useStore.getState().setGameState("WON"); }
        }

        // TELEMETRY RECORDING
        const perfEnd = performance.now();
        const frameEngineMs = parseFloat((perfEnd - perfStart).toFixed(2));
        
        if (settings.telemetry) {
            settings.telemetry.engineMs = frameEngineMs;
            settings.telemetry.unitCount = unitsRef.current.length;
            settings.telemetry.vfxCount = damageQueueRef.current.length;
            settings.telemetry.bucketCount = bucketsMapRef.current.size;
        }

        // SMART TELEMETRY RECORDING - Focus on "The Why" (Lag Analysis Focused)
        const currentFps = Math.round(1 / delta);
        const isStruggling = currentFps < 45 || frameEngineMs > 4.0;
        
        if (perfHistoryRef.current.length < 10000) {
            // Intelligent Sampling: Record more frequently during lag spikes, less during smooth play
            const sampleRate = isStruggling ? 0.4 : 0.05; 
            
            if (Math.random() < sampleRate) {
                perfHistoryRef.current.push({
                    timestamp: new Date().toISOString().split('T')[1].split('Z')[0], // readable time
                    fps: currentFps,
                    cpu_ms: frameEngineMs,
                    unit_count: unitsRef.current.length,
                    vfx_count: damageQueueRef.current.length,
                    bottleneck: frameEngineMs > 6 ? "CPU/LOGIC" : (currentFps < 35 ? "GPU/RENDER" : "OPTIMAL"),
                    env: weatherRef.current
                } as any);
            }
        }
    }, [addKillEvent, entityManager, towerConfig.unitConfig, flushDamageBuffer]);

    // ----------------------------------------------------------------
    // MVP / STATS
    // ----------------------------------------------------------------

    const getMVPData = useCallback(() => {
        const sort = (rec: Record<string, number>) =>
            Object.entries(rec).sort(([, a], [, b]) => (b as number) - (a as number))[0];
        const dDealer = sort(statsRef.current.damageDealt);
        const tSpawner = sort(statsRef.current.unitsSpawned);
        const pTopHitter = sort(statsRef.current.playerHits);
        const eTopHitter = sort(statsRef.current.enemyHits);
        return {
            topDamage: dDealer ? { username: dDealer[0], value: dDealer[1] } : null,
            topSpawner: tSpawner ? { username: tSpawner[0], value: tSpawner[1] } : null,
            playerTopHit: pTopHitter ? { username: pTopHitter[0], value: pTopHitter[1] } : null,
            enemyTopHit: eTopHitter ? { username: eTopHitter[0], value: eTopHitter[1] } : null,
        };
    }, []);

    const clearVFXCache = useCallback(() => {
        damageQueueRef.current = [];
        damageBufferRef.current.clear();
        perfHistoryRef.current = [];
        pendingDamageRef.current = [];
    }, []);

    const downloadPerfLogs = useCallback(() => {
        const history = perfHistoryRef.current;
        const lowFpsPoints = (history as any[]).filter(p => p.fps < 40).length;
        const cpuSpikes = (history as any[]).filter(p => p.cpu_ms > 5).length;

        const data = {
            summary: {
                report_time: new Date().toISOString(),
                total_samples: history.length,
                low_fps_incidents: lowFpsPoints,
                cpu_spike_incidents: cpuSpikes,
                primary_suspect: lowFpsPoints > cpuSpikes ? "GPU/RENDERING (Too many objects)" : "CPU (Logic/AI complexity)",
                advice: lowFpsPoints > cpuSpikes ? "Turn on Potato Mode or reduce Unit Scale" : "Reduce Max Units or simplify AI behavior"
            },
            metadata: {
                towerConfig: towerConfigRef.current,
                settings: settingsRef.current
            },
            data_points: history
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lag-analysis-focused-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }, []);

    // ----------------------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------------------

    return {
        towerConfig,
        setTowerConfig,
        spawnUnit,
        resetBattle,
        getMVPData,
        setMapObstacles,
        mapObstacles,
        debug,
        setDebug,
        unitRegistry: unitDataRef,
        vehicles: vehicles,
        unitIndex: unitIndexRef,
        updateSettingsRef: (newSettings: any) => { settingsRef.current = { ...settingsRef.current, ...newSettings }; },
        spellsRef: spellsRef,
        stats: statsRef.current,
        triggerAirstrike,
        updateSimulation,
        damageQueue: damageQueueRef,
        settingsRef,
        simTimeRef: simulationTimeRef,
        downloadPerfLogs,
        clearVFXCache,
    };
};
