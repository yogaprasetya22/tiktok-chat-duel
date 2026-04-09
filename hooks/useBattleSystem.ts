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
    DamageText,
    MapObstacle,
    KillEvent,
    BattleStats,
    SimulationSettings,
    UnitRuntimeData,
} from "./battle/types";

import {
    PLAYER_BASE_Z,
    ENEMY_BASE_Z,
    LANE_OFFSETS,
    INITIAL_SETTINGS,
    MAGE_PROJECTILE_TIME_MS,
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
    const [damageTexts, setDamageTexts] = useState<DamageText[]>([]);
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

    const statsRef = useRef<BattleStats>({
        damageDealt: {},
        playerDamage: {},
        enemyDamage: {},
        playerKills: {},
        enemyKills: {},
        unitsSpawned: {},
        playerHits: {},
        enemyHits: {},
    });

    const replayBufferRef = useRef<any[]>([]);
    const [updateTick, setUpdateTick] = useState(0);
    const lastLogTimeRef = useRef<number>(0);
    const frameParityRef = useRef<number>(0);

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
        attackerId: string; // NEW: Track for victory pause
    }[]>([]);
    
    // Performance: Store every attack transaction for deeper data analysis
    const frameEventsRef = useRef<any[]>([]);

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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const addDamageText = useCallback(
        (_value: number, _position: [number, number, number], _color: string = "#FF0000") => {
            // Disabled for performance — use damageQueueRef instead
        },
        [],
    );

    const flushDamageBuffer = useCallback((now: number) => {
        damageBufferRef.current.forEach((data, targetId) => {
            if (now - data.lastHit > 150) {
                damageQueueRef.current.push({
                    value: data.total,
                    position: data.position,
                    isCrit: data.total > 150,
                    color: data.color,
                    timestamp: now,
                });
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
        setDamageTexts([]);

            statsRef.current = {
                damageDealt: {},
                playerDamage: {},
                enemyDamage: {},
                playerKills: {},
                enemyKills: {},
                unitsSpawned: {},
                playerHits: {},
                enemyHits: {},
            };
    }, [towerConfig.baseHp, entityManager]);

    const lastStateUpdate = useRef<number>(0);

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
            useStore.getState().addKillEvent({
                id: Math.random().toString(36).substring(7),
                killer,
                victim,
                victimType,
                timestamp: Date.now(),
            });
        },
        [],
    );

    const perfRef = useRef({ drawCalls: 0, triangles: 0, drift: 0 });
    const syncPerformance = useCallback(
        (data: { drawCalls: number; triangles: number; drift: number }) => {
            perfRef.current = data;
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
            forcedClass?: "fighter" | "tank" | "mage",
        ) => {
            const userName = _userName.trim().substring(0, 16);
            const isTestingBot =
                userName === towerConfigRef.current.player.name ||
                userName === towerConfigRef.current.enemy.name;
            if (!isBoss && !isTestingBot && (useStore.getState().gameMode !== 'TRAINING') && (statsRef.current.unitsSpawned[userName] || 0) >= 3)
                return;


            // No setState needed, we rely completely on unitsRef in engine
            const teamUnits = unitsRef.current.filter((u) => u && u.type === type && !u.isDying);
            if (!isBoss && teamUnits.length >= towerConfigRef.current.maxUnits) return;

                statsRef.current.unitsSpawned[userName] = (statsRef.current.unitsSpawned[userName] || 0) + 1;

                let stats = getUnitStats(level, towerConfigRef.current.unitConfig, settingsRef.current);
                if (isBoss) stats = applyBossModifiers(stats);

                const rand = Math.random();
                const unitClass = forcedClass || (rand < 0.4 ? "fighter" : (rand < 0.7 ? "tank" : "mage"));
                const laneOffset = isBoss ? 0 : pickRandom(LANE_OFFSETS);

                // Class specific adjustments
                if (unitClass === "tank") {
                    stats.hp *= 5.0;      // Even tankier
                    stats.maxHp *= 5.0;
                    stats.speed *= 0.6;   // Adjusted from 0.45
                    stats.attack *= 1.2;
                    stats.range *= 0.75;  // Very close melee
                } else if (unitClass === "mage") {
                    stats.hp *= 0.4;      // Glass cannon
                    stats.maxHp *= 0.4;
                    stats.attack *= 3.0;
                    stats.range *= 5.0;   // Reduced from 10.0 to prevent "diem bae"
                }

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
                unitDataRef.current.set(unitId, {
                    hp: isDummy ? 999999 : stats.hp,
                    maxHp: isDummy ? 999999 : stats.maxHp,
                    isBoss,
                    status: isDummy ? "idle" : "marching",
                    position: spawnPos,
                    rotation: [0, type === 'player' ? Math.PI : 0, 0],
                    userName,
                    type,
                    level,
                    laneOffset,
                    lastAttackTime: 0,
                    isAttackingBase: false,
                    animationOffset: Math.random() * 10,
                    lastDamageTime: 0,
                    victoryPauseUntil: 0,
                    jitterOffset: Math.random() * Math.PI * 2,
                    unitClass,
                });

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
                };

                unitsRef.current.push(newUnit);
                unitIndexRef.current.set(unitId, newUnit); // Fix #5: register in O(1) index
                
                // Keep team count logic purely engine-based (removed React DOM update)
        },
        [entityManager],
    );

    // ----------------------------------------------------------------
    // SIMULATION LOOP (The Heart — runs every frame via useFrame)
    // ----------------------------------------------------------------

    const updateSimulation = useCallback((delta: number) => {
        if (gameStateRef.current !== "PLAYING") return;

        const now = Date.now();
        const settings = settingsRef.current;
        
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

        // Dynamic Time Scale: Adjust simDelta based on settings
        const simDelta = Math.min(0.05, delta) * settings.timeScale;
        simulationTimeRef.current += simDelta * 1000; // Increment sim clock in ms
        const simNow = simulationTimeRef.current;

        entityManager.update(simDelta);
        flushDamageBuffer(now);

        // --- Process Delayed Hits (Mage Projectiles) ---
        if (pendingDamageRef.current.length > 0) {
            const hits = pendingDamageRef.current;
            for (let i = hits.length - 1; i >= 0; i--) {
                const h = hits[i];
                if (simNow >= h.hitTime) {
                    const target = unitIndexRef.current.get(h.targetId);
                    if (target && target.hp > 0 && !target.isDying) {
                        const tData = unitDataRef.current.get(target.id);
                        if (tData) {
                            target.hp -= h.damage;
                            tData.hp = target.hp;
                            tData.lastDamageTime = now;
                            accumulateDamage(target.id, h.damage, tData.position, h.color);
                            
                            frameEventsRef.current.push({
                                a: h.attackerName,
                                c: h.attackerClass,
                                tgt: target.userName,
                                dmg: Math.round(h.damage),
                                kill: target.hp <= 0 ? 1 : 0
                            });

                            if (target.hp <= 0) {
                                // delayed mage kill tracking
                                if (h.attackerClass === 'mage') {
                                    const attackerType = h.color === towerConfig.player.color ? 'player' : 'enemy';
                                    if (attackerType === 'player') {
                                        statsRef.current.playerKills[h.attackerName] = (statsRef.current.playerKills[h.attackerName] || 0) + 1;
                                        statsRef.current.playerDamage[h.attackerName] = (statsRef.current.playerDamage[h.attackerName] || 0) + h.damage;
                                    } else {
                                        statsRef.current.enemyKills[h.attackerName] = (statsRef.current.enemyKills[h.attackerName] || 0) + 1;
                                        statsRef.current.enemyDamage[h.attackerName] = (statsRef.current.enemyDamage[h.attackerName] || 0) + h.damage;
                                    }
                                }
                                addKillEvent(h.attackerName, target.userName, target.isBoss ? "boss" : "unit");
                            } else {
                                // Update damage maps even if not a kill
                                const attackerType = h.color === towerConfig.player.color ? 'player' : 'enemy';
                                if (attackerType === 'player') {
                                    statsRef.current.playerDamage[h.attackerName] = (statsRef.current.playerDamage[h.attackerName] || 0) + h.damage;
                                } else {
                                    statsRef.current.enemyDamage[h.attackerName] = (statsRef.current.enemyDamage[h.attackerName] || 0) + h.damage;
                                }
                            }

                        }
                    }
                    hits.splice(i, 1);
                }
            }
        }

        // --- Optimized Performance Diagnostics ---
        const simulationUnits = unitsRef.current;
        const totalUnitsCount = simulationUnits.length;
        const pCount = simulationUnits.filter(u => u && u.type === "player" && !u.isDying).length;
        const eCount = totalUnitsCount - pCount;

        // --- Replay Snapshot (Professional Analytical Structure) ---
        if (now - lastLogTimeRef.current > 200) {
            const snapshot = {
                t: now,
                simTime: Math.round(simNow),
                fps: Math.round(1 / (delta || 0.016)),
                meta: {
                    pCount, 
                    eCount, 
                    total: totalUnitsCount,
                    drawCalls: perfRef.current.drawCalls,
                    tri: Math.round(perfRef.current.triangles / 1000),
                },
                // Structured Unit Data (Map for O(1) analysis)
                units: simulationUnits.filter(u => !!u && !u.isDying).reduce((acc: any, u) => {
                    const data = unitDataRef.current.get(u.id);
                    if (data) {
                        acc[u.id] = {
                            hp: Math.round(data.hp),
                            pos: [parseFloat(data.position[0].toFixed(2)), parseFloat(data.position[2].toFixed(2))],
                            rot: parseFloat(data.rotation[1].toFixed(2)),
                            state: data.status,
                            class: data.unitClass,
                            team: data.type === 'player' ? 'player' : 'enemy',
                            target: u.targetId || null
                        };
                    }
                    return acc;
                }, {}),
                events: [...frameEventsRef.current]
            };
            
            replayBufferRef.current.push(snapshot);
            frameEventsRef.current.length = 0;

            if (replayBufferRef.current.length > 1500) replayBufferRef.current.shift();
            lastLogTimeRef.current = now;
            setUpdateTick((prev) => prev + 1);
        }

        if (now % 2000 < 50) {
            setDamageTexts((dTexts) =>
                dTexts.length === 0 ? dTexts : dTexts.filter((t) => now - t.timestamp < 1000),
            );
        }

        const pUnits = pUnitsPoolRef.current;
        const eUnits = eUnitsPoolRef.current;
        pUnits.length = 0; eUnits.length = 0;

        for (let i = 0; i < simulationUnits.length; i++) {
            const u = simulationUnits[i];
            if (u && u.id && !u.isDying) {
                if (u.type === "player") pUnits.push(u);
                else eUnits.push(u);
            }
        }

        frameParityRef.current = (frameParityRef.current + 1) % 4;

        // ---- PASS 1: AI Movement & Combat ----
        for (let i = 0; i < simulationUnits.length; i++) {
            const u = simulationUnits[i];
            if (!u || u.isDying) continue;
            const uData = unitDataRef.current.get(u.id);
            if (!uData) continue;

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

            const isThrottled = i % 2 !== frameParityRef.current % 2 && !u.isBoss;
            let currentTarget: ActiveUnit | null = null;
            let isAttackingTarget = false;

            // --- DECENTRALIZED AI FALLBACK ---
            // Decision-making (target searching) is now handled by Army Components.
            // This hook only handles the physical consequences of those decisions.
            const distToBaseSq = Math.pow(uData.position[2] - (u.type === "player" ? ENEMY_BASE_Z : PLAYER_BASE_Z), 2);
            const attackRangeSq = u.range * u.range;
            const canReachBase = distToBaseSq < attackRangeSq;
            uData.isAttackingBase = false;


            // Commit Combat State
            const currentTarget_lookup = u.targetId ? unitIndexRef.current.get(u.targetId) : null;
            currentTarget = currentTarget_lookup || null;
            
            // DECISION: Attack Unit (Highest Priority) or Base (Fallback)
            if (currentTarget) {
                // Do not assume we are actively attacking until we verify distance!
                uData.isAttackingBase = false;
            } else if (canReachBase) {
                // FALLBACK TO BASE
                isAttackingTarget = false; // We use isAttackingTarget = true for UNITS only in downstream lookups
                uData.isAttackingBase = true;
                uData.status = "attacking";
                
                // --- COMMIT BASE DAMAGE ---
                const baseAttackCooldown = u.isBoss ? settingsRef.current.globalAttackCooldown * 0.7 : settingsRef.current.globalAttackCooldown;
                if (simNow - uData.lastAttackTime > baseAttackCooldown) {
                    const effectiveAttack = u.attack * settingsRef.current.globalDamageMultiplier;
                    const { damage } = calcDamage(effectiveAttack, settingsRef.current.critChance, towerConfigRef.current.criticalMultiplier ?? 2.0);
                    if (u.type === "player") {
                        enemyBaseHpRef.current = Math.max(0, enemyBaseHpRef.current - damage);
                        if (enemyBaseHpRef.current === 0 && gameStateRef.current === "PLAYING") addKillEvent(u.userName, towerConfigRef.current.enemy.name, "base");
                        useStore.getState().setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
                        accumulateDamage("enemy-base", damage, [0, 5, ENEMY_BASE_Z], towerConfigRef.current.player.color);
                    } else {
                        playerBaseHpRef.current = Math.max(0, playerBaseHpRef.current - damage);
                        if (playerBaseHpRef.current === 0 && gameStateRef.current === "PLAYING") addKillEvent(u.userName, towerConfigRef.current.player.name, "base");
                        useStore.getState().setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
                        accumulateDamage("player-base", damage, [0, 5, PLAYER_BASE_Z], towerConfigRef.current.enemy.color);
                    }
                    uData.lastAttackTime = simNow;
                    statsRef.current.damageDealt[u.userName] = (statsRef.current.damageDealt[u.userName] || 0) + damage;
                    frameEventsRef.current.push({ a: u.userName, c: u.unitClass, tgt: "base", dmg: Math.round(damage) });
                }
            }

            // Target validation
            if (currentTarget && (currentTarget.hp <= 0 || currentTarget.isDying)) {
                u.targetId = undefined;
                currentTarget = null;
                isAttackingTarget = false;
            }

            // Unit attack engagement
            if (currentTarget) {
                const tData = unitDataRef.current.get(currentTarget.id);
                if (tData) {
                    const dSq = (uData.position[0] - tData.position[0]) ** 2 + (uData.position[2] - tData.position[2]) ** 2;
                    const dynamicRangeSq = (u.range + (u.id.charCodeAt(0) % 5) * 0.1) ** 2;
                    if (dSq < dynamicRangeSq || uData.status === 'attacking') {
                        // Trust Army component's engagement decision if its within a reasonable tolerance
                        // or if the distance check passes
                        uData.status = "attacking"; uData.isAttackingBase = false; isAttackingTarget = true;
                        const classMultiplier = u.unitClass === 'mage' ? 2.0 : 1.0;
                        const unitAttackCooldown = (u.isBoss ? settingsRef.current.globalAttackCooldown * 0.7 : settingsRef.current.globalAttackCooldown) * classMultiplier;
                        if (simNow - uData.lastAttackTime > unitAttackCooldown) {
                            // Apply global damage multiplier
                            const effectiveAttack = u.attack * settingsRef.current.globalDamageMultiplier;
                            const { damage: finalDmg } = calcDamage(
                                effectiveAttack,
                                settingsRef.current.critChance,
                                towerConfigRef.current.criticalMultiplier ?? 2.0,
                            );

                            const teamColor = u.type === "player" ? towerConfig.player.color : towerConfig.enemy.color;

                            if (u.unitClass === 'mage') {
                                // Combat Sync: Logic for delayed hit (Hit Delay)
                                // FIXED: Use simulationTimeRef for perfect sync with visuals
                                pendingDamageRef.current.push({
                                    targetId: currentTarget.id,
                                    damage: finalDmg,
                                    hitTime: simNow + MAGE_PROJECTILE_TIME_MS, 
                                    position: [...tData.position] as [number, number, number],
                                    color: teamColor,
                                    attackerName: u.userName,
                                    attackerClass: u.unitClass,
                                    attackerId: u.id // NEW: Track for victory pause
                                });

                                // SPATIAL FX: Direct sync with MageSpellEffect via Ref
                                const availableSlot = spellsRef.current.find(s => !s.active);
                                if (availableSlot) {
                                    availableSlot.active = true;
                                    availableSlot.progress = 0; // Explicit reset
                                    availableSlot.fromX = uData.position[0];

                                    availableSlot.fromY = 1.0;
                                    availableSlot.fromZ = uData.position[2];
                                    availableSlot.toX = tData.position[0];
                                    availableSlot.toY = 1.0;
                                    availableSlot.toZ = tData.position[2];
                                    availableSlot.startTime = simNow;
                                    availableSlot.color = teamColor;
                                    availableSlot.targetId = currentTarget.id;
                                }

                            } else {

                                // Melee units hit instantly
                                currentTarget.hp -= finalDmg;
                                tData.hp = currentTarget.hp;
                                tData.lastDamageTime = now;
                                accumulateDamage(currentTarget.id, finalDmg, tData.position, teamColor);
                                
                                frameEventsRef.current.push({
                                    a: u.userName,
                                    c: u.unitClass,
                                    tgt: currentTarget.userName,
                                    dmg: Math.round(finalDmg),
                                    kill: currentTarget.hp <= 0 ? 1 : 0
                                });

                                if (currentTarget.hp <= 0) {
                                    // Melee units clear target immediately on kill
                                    u.targetId = undefined;
                                    uData.victoryPauseUntil = now + settingsRef.current.victoryPauseMs;
                                    uData.status = "idle";
                                    
                                    // Melee kill tracking
                                    if (u.type === 'player') {
                                        statsRef.current.playerKills[u.userName] = (statsRef.current.playerKills[u.userName] || 0) + 1;
                                    } else {
                                        statsRef.current.enemyKills[u.userName] = (statsRef.current.enemyKills[u.userName] || 0) + 1;
                                    }
                                    
                                    addKillEvent(u.userName, currentTarget.userName, currentTarget.isBoss ? "boss" : "unit");
                                }
                            }
                            uData.lastAttackTime = simNow;
                            statsRef.current.damageDealt[u.userName] = (statsRef.current.damageDealt[u.userName] || 0) + finalDmg;
                            
                            // SYNC: Update the team-specific damage maps for analytics
                            if (u.type === 'player') {
                                statsRef.current.playerDamage[u.userName] = (statsRef.current.playerDamage[u.userName] || 0) + finalDmg;
                            } else {
                                statsRef.current.enemyDamage[u.userName] = (statsRef.current.enemyDamage[u.userName] || 0) + finalDmg;
                            }
                        }

                    }
                }
            }

            // Engine fallback (marching) is now handled by Army components

            // --- DECENTRALIZED STEERING & POSITION SYNC ---
            const vehicle = vehicles.current.get(u.id);
            if (vehicle) {
                // The actual steering (Seek targets, Kiting, Speed) is now handled 
                // by individual army components. The engine purely facilitates 
                // spatial indexing and rotation calculations.

                const limitEdgeZ = (towerConfigRef.current.baseDistance || 24) - 2;
                if (vehicle.position.z < -limitEdgeZ) vehicle.position.z = -limitEdgeZ;
                if (vehicle.position.z > limitEdgeZ) vehicle.position.z = limitEdgeZ;

                // Armies now handle their own stopping logic (velocity/speed)



                uData.position[0] = vehicle.position.x;
                uData.position[2] = vehicle.position.z;

                // NOTE: Rotation is now completely decentralized and handled in FighterArmy/TankArmy/MageArmy.
            }
        }


        // ---- PASS 2: Social Dynamics / Spatial Partitioning (Optimized) ----
        if (frameParityRef.current % 2 === 0) {
            const GRID_SIZE = 4; // Slightly larger grid for better batching

            const buckets = bucketsMapRef.current;
            buckets.clear();

            for (let i = 0; i < totalUnitsCount; i++) {
                const u = simulationUnits[i];
                if (!u || u.isDying) continue;
                const uData = unitDataRef.current.get(u.id);
                if (!uData) continue;
                
                // 2D Spatial Hashing (Z-axis primary)
                const bIdx = Math.floor(uData.position[2] / GRID_SIZE);
                let bucket = buckets.get(bIdx);
                if (!bucket) { bucket = []; buckets.set(bIdx, bucket); }
                bucket.push(i);
            }

            buckets.forEach((indices, bIdx) => {
                // Check current and neighboring buckets
                const neighborIndicesNext = buckets.get(bIdx + 1);
                
                for (let i = 0; i < indices.length; i++) {
                    const idxA = indices[i];
                    const uA = simulationUnits[idxA];
                    const uDataA = unitDataRef.current.get(uA.id)!;
                    
                    // Self-bucket collision
                    for (let j = i + 1; j < indices.length; j++) {
                        solveSocialDynamics(uA, uDataA, simulationUnits[indices[j]]);
                    }
                    
                    // Neighbor bucket collision
                    if (neighborIndicesNext) {
                        for (let j = 0; j < neighborIndicesNext.length; j++) {
                            solveSocialDynamics(uA, uDataA, simulationUnits[neighborIndicesNext[j]]);
                        }
                    }
                }
            });
        }

        function solveSocialDynamics(uA: any, uDataA: any, uB: any) {
            if (uB.isDying || uA.type !== uB.type) return;
            const uDataB = unitDataRef.current.get(uB.id)!;
            let dx = uDataA.position[0] - uDataB.position[0];
            let dz = uDataA.position[2] - uDataB.position[2];
            let distSq = dx * dx + dz * dz;

            // If exactly overlapping, nudge them apart randomly to prevent clustering
            if (distSq < 0.0001) {
                dx = (Math.random() - 0.5) * 0.1;
                dz = (Math.random() - 0.5) * 0.1;
                distSq = dx * dx + dz * dz;
            }
            
            const currentSeparationRadius = settingsRef.current.separationRadius;
            const comfortZone = (uA.isBoss ? 2.5 : currentSeparationRadius) + (uB.isBoss ? 2.5 : currentSeparationRadius);
            
            if (distSq < comfortZone * comfortZone) {
                const dist = Math.sqrt(distSq) || 0.001;
                const overlap = comfortZone - dist;
                
                // STABILITY: Attacking units act as solid pillars (weight 0.0) unless they are kiting
                const weightA = (uDataA.status === 'attacking' && !uDataA.isKiting) ? 0.0 : 1.0;
                const weightB = (uDataB.status === 'attacking' && !uDataB.isKiting) ? 0.0 : 1.0;
                
                const totalWeight = weightA + weightB;
                if (totalWeight > 0) {
                    // SMOOTHING: Increase separation radius but lower the force curve to prevent violent bouncing
                    const pushStrength = settingsRef.current.separationStrength * (1.0 - dist / comfortZone) * 0.5;
                    const nx = dx / dist; const nz = dz / dist;
                    const force = overlap * pushStrength;
                    
                    const forceA = force * (weightA / totalWeight);
                    const forceB = force * (weightB / totalWeight);


                    uDataA.position[0] += nx * forceA; uDataA.position[2] += nz * forceA;
                    uDataB.position[0] -= nx * forceB; uDataB.position[2] -= nz * forceB;
                }
                const vA = vehicles.current.get(uA.id);
                const vB = vehicles.current.get(uB.id);
                if (vA) { vA.position.x = uDataA.position[0]; vA.position.z = uDataA.position[2]; }
                if (vB) { vB.position.x = uDataB.position[0]; vB.position.z = uDataB.position[2]; }
            }
        }

        // ---- PASS 3: Cleanup (Throttled) ----
        if (now - lastStateUpdate.current > 500) {
            lastStateUpdate.current = now;
            const prevCount = totalUnitsCount;
            unitsRef.current = unitsRef.current.filter((u) => {
                if (u && u.hp <= 0 && !u.isDying) {
                    u.isDying = true; u.deathTime = Date.now();
                    setTimeout(() => {
                        if (!u?.id) return;
                        const v = vehicles.current.get(u.id);
                        if (v) entityManager.remove(v);
                        vehicles.current.delete(u.id);
                        unitDataRef.current.delete(u.id);
                        unitIndexRef.current.delete(u.id); // Fix #5: remove from O(1) index
                        unitsRef.current = unitsRef.current.filter((unit) => unit && unit.id !== u.id);
                    }, 1500);
                }
                return true;
            });
            
            let _pC = 0, _eC = 0;
            for(let i=0; i<unitsRef.current.length; i++) {
                const u = unitsRef.current[i];
                if (u && !u.isDying) { if (u.type === "player") _pC++; else _eC++; }
            }
            useStore.getState().setArmyCounts(_pC, _eC);
        }

        // Live stats sync (every 30 frames)
        if (frameParityRef.current % 30 === 0) {
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
    }, [addKillEvent, entityManager, towerConfig.unitConfig, damageTexts.length, flushDamageBuffer]);

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

    // ----------------------------------------------------------------
    // PUBLIC API
    // ----------------------------------------------------------------

    return {
        damageTexts,
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
        syncPerformance,
        spellsRef: spellsRef,
        stats: statsRef.current,


        replayStats: [...replayBufferRef.current],
        downloadReplay: () => {
            const manifest = {
                title: "Supreme Battle Replay",
                timestamp: new Date().toISOString(),
                schema: {
                    unit: { h: "hp", p: "[x,z]", r: "rotation", s: "status", c: "class", t: "type (0:ply, 1:enm)" },
                    event: { a: "attacker", c: "class", tgt: "target", dmg: "damage", kill: "is_kill" }
                },
                data: replayBufferRef.current
            };
            const data = JSON.stringify(manifest, null, 2);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `battle_analysis_${Date.now()}.json`;
            a.click();
        },
        triggerAirstrike,
        updateSimulation,
        damageQueue: damageQueueRef,
        settingsRef,
        simTimeRef: simulationTimeRef,
    };
};
