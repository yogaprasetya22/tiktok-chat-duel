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
} from "./battle/types";

import {
    PLAYER_BASE_Z,
    ENEMY_BASE_Z,
    LANE_OFFSETS,
    INITIAL_SETTINGS,
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
    const unitDataRef = useRef<
        Map<
            string,
            {
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
            }
        >
    >(new Map());

    const unitsRef = useRef<ActiveUnit[]>([]);
    const obstacleEntities = useRef<YUKA.GameEntity[]>([]);

    // Fix #5: O(1) unit lookup by ID — replaces Array.find() in hot simulation loop
    const unitIndexRef = useRef<Map<string, ActiveUnit>>(new Map());

    // Performance: Pre-allocated pools (zero-allocation loop)
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
            userName: string = "Guest",
            type: "player" | "enemy" = "player",
            isBoss: boolean = false,
        ) => {
            const isTestingBot =
                userName === towerConfigRef.current.player.name ||
                userName === towerConfigRef.current.enemy.name;
            if (!isBoss && !isTestingBot && (statsRef.current.unitsSpawned[userName] || 0) >= 3)
                return;

            // No setState needed, we rely completely on unitsRef in engine
            const teamUnits = unitsRef.current.filter((u) => u && u.type === type && !u.isDying);
            if (!isBoss && teamUnits.length >= towerConfigRef.current.maxUnits) return;

                statsRef.current.unitsSpawned[userName] = (statsRef.current.unitsSpawned[userName] || 0) + 1;

                let stats = getUnitStats(level, towerConfigRef.current.unitConfig, settingsRef.current);
                if (isBoss) stats = applyBossModifiers(stats);

                const speedVariation = 0.8 + Math.random() * 0.4;
                const actualSpeed = stats.speed * speedVariation;

                const unitId = `${type}-${Math.random().toString(36).substring(2, 9)}`;
                const laneOffset = isBoss ? 0 : pickRandom(LANE_OFFSETS);

                const jitterX = (Math.random() - 0.5) * 8.0;
                const jitterZ = (Math.random() - 0.5) * 8.0;
                const spawnPos = [
                    laneOffset + jitterX,
                    -0.4,
                    (type === "player" ? 22 : -22) + jitterZ,
                ] as [number, number, number];

                const vehicle = new YUKA.Vehicle();
                vehicle.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);
                vehicle.maxSpeed = actualSpeed;
                vehicle.updateOrientation = false;
                // Dynamic Scaling: Influenced by level, isBoss, and GLOBAL unitScale setting
                const globalUnitScale = settingsRef.current.unitScale;
                const baseScale = isBoss ? 4.5 : (1.5 + (level || 1) * 0.1);
                const finalScale = baseScale * globalUnitScale;
                vehicle.boundingRadius = (isBoss ? 3.5 : 1.4) * finalScale;

                const obstacleAvoidance = new YUKA.ObstacleAvoidanceBehavior(obstacleEntities.current);
                obstacleAvoidance.weight = 3.0;
                vehicle.steering.add(obstacleAvoidance);

                const seek = new YUKA.SeekBehavior(
                    new YUKA.Vector3(laneOffset, -0.4, type === "player" ? ENEMY_BASE_Z : PLAYER_BASE_Z),
                );
                seek.weight = 1.2;
                vehicle.steering.add(seek);

                const separation = new YUKA.SeparationBehavior();
                separation.weight = 1.5;
                vehicle.steering.add(separation);

                vehicle.maxForce = 150;
                vehicle.velocity.set(0, 0, 0);

                entityManager.add(vehicle);
                vehicles.current.set(unitId, vehicle);
                unitDataRef.current.set(unitId, {
                    hp: stats.hp,
                    maxHp: stats.maxHp,
                    isBoss,
                    status: "marching",
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
                    animationOffset: Math.random() * 10,
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

        // --- Optimized Performance Diagnostics ---
        const simulationUnits = unitsRef.current;
        const totalUnitsCount = simulationUnits.length;
        const pCount = simulationUnits.filter(u => u && u.type === "player" && !u.isDying).length;
        const eCount = totalUnitsCount - pCount;

        // --- Replay Snapshot (Optimized Data Structure) ---
        if (now - lastLogTimeRef.current > 200) {
            replayBufferRef.current.push({
                t: now,
                fps: Math.round(1 / (delta || 0.016)),
                stats: {
                    p: pCount, 
                    e: eCount, 
                    tot: totalUnitsCount,
                    vfx: damageTexts.length,
                    drawCalls: perfRef.current.drawCalls,
                    tri: Math.round(perfRef.current.triangles / 1000),
                    drift: perfRef.current.drift.toFixed(1),
                    mem: (performance as any).memory ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) : 0
                },
                // Compact unit data for memory efficiency
                u: simulationUnits.filter(u => !!u && !u.isDying).map((u) => {
                    const data = unitDataRef.current.get(u.id);
                    return [
                        u.id.substring(u.id.indexOf('-')+1), // Short ID
                        u.type === 'player' ? 0 : 1,         // Binary type
                        Math.round((data?.position[0] || 0) * 10) / 10,
                        Math.round((data?.position[2] || 0) * 10) / 10,
                        Math.round((data?.rotation[1] || 0) * 100) / 100,
                        u.status === 'marching' ? 0 : (u.status === 'attacking' ? 1 : 2),
                        Math.round(u.hp)
                    ];
                }),
            });

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

            if (u.hp <= 0) { u.isDying = true; u.deathTime = now; continue; }

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

            const distToBaseSq = Math.pow(uData.position[2] - (u.type === "player" ? ENEMY_BASE_Z : PLAYER_BASE_Z), 2);
            const attackRangeSq = u.range * u.range;

            // Base attack logic
            if (distToBaseSq < attackRangeSq) {
                uData.status = "attacking"; uData.isAttackingBase = true; isAttackingTarget = true;
                // Fix: dynamic base attack cooldown based on globalAttackCooldown bound to SimTime
                const baseAttackCooldown = u.isBoss ? settingsRef.current.globalAttackCooldown * 0.7 : settingsRef.current.globalAttackCooldown;
                if (simNow - uData.lastAttackTime > baseAttackCooldown) {
                    // Apply global damage multiplier to base attack
                    const effectiveAttack = u.attack * settingsRef.current.globalDamageMultiplier;
                    const { damage } = calcDamage(
                        effectiveAttack,
                        settingsRef.current.critChance,
                        towerConfigRef.current.criticalMultiplier ?? 2.0,
                    );
                    if (u.type === "player") {
                        enemyBaseHpRef.current = Math.max(0, enemyBaseHpRef.current - damage);
                        if (enemyBaseHpRef.current === 0 && gameStateRef.current === "PLAYING")
                            addKillEvent(u.userName, towerConfigRef.current.enemy.name, "base");
                        useStore.getState().setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
                        accumulateDamage("enemy-base", damage, [0, 5, ENEMY_BASE_Z], towerConfigRef.current.player.color);
                    } else {
                        playerBaseHpRef.current = Math.max(0, playerBaseHpRef.current - damage);
                        if (playerBaseHpRef.current === 0 && gameStateRef.current === "PLAYING")
                            addKillEvent(u.userName, towerConfigRef.current.player.name, "base");
                        useStore.getState().setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
                        accumulateDamage("player-base", damage, [0, 5, PLAYER_BASE_Z], towerConfigRef.current.enemy.color);
                    }
                    uData.lastAttackTime = simNow; // Update using sim time
                    statsRef.current.damageDealt[u.userName] = (statsRef.current.damageDealt[u.userName] || 0) + damage;
                }
            }

            // Target selection with sensor-based perception + lane discipline
            const isAttacking = uData.status === "attacking";
            const shouldSearch = !isThrottled && (!isAttacking || (i + frameParityRef.current) % 30 === 0);

            if (shouldSearch) {
                const targets = u.type === "player" ? eUnits : pUnits;
                let maxTargetScore = -Infinity; let bestTarget = null;

                for (let j = 0; j < targets.length; j++) {
                    const target = targets[j];
                    const tData = unitDataRef.current.get(target.id);
                    if (!tData || target.hp <= 0) continue;

                    const dx = uData.position[0] - tData.position[0];
                    const dz = uData.position[2] - tData.position[2];
                    const dSq = dx * dx + dz * dz;

                    // Sensor perception: ignore far enemies (unless Boss)
                    if (dSq > settingsRef.current.perceptionRadiusSq && !target.isBoss) continue;

                    let score = 5000 / (dSq + 1);
                    const myBaseZ = u.type === 'player' ? PLAYER_BASE_Z : ENEMY_BASE_Z;
                    const targetDistToBase = Math.abs(tData.position[2] - myBaseZ);

                    // Frontline Discipline: penalise cross-lane targeting
                    score -= Math.abs(uData.laneOffset - tData.position[0]) * settingsRef.current.lanePenalty;

                    if (targetDistToBase < 12) score += settingsRef.current.baseProximityBonus * (1 - targetDistToBase / 12);
                    if (tData.isAttackingBase && Math.abs(uData.laneOffset) < settingsRef.current.baseDefenseThreshold)
                        score += settingsRef.current.baseAttackResponseBonus;
                    if (target.isBoss) score += settingsRef.current.bossPriorityBonus;
                    score += settingsRef.current.lowHpBonus * (1 - target.hp / (target.maxHp || 1));

                    if (score > maxTargetScore) { maxTargetScore = score; bestTarget = target; }
                }
                u.targetId = bestTarget?.id;
            }

            // Fix #5: O(1) map lookup instead of O(n) Array.find()
            const currentTarget_lookup = u.targetId ? unitIndexRef.current.get(u.targetId) : null;
            currentTarget = currentTarget_lookup || null;
            if (currentTarget && (currentTarget.hp <= 0 || currentTarget.isDying)) {
                currentTarget = null; u.targetId = undefined;
            }

            // Combat attack
            if (currentTarget) {
                const tData = unitDataRef.current.get(currentTarget.id);
                if (tData) {
                    const dSq = (uData.position[0] - tData.position[0]) ** 2 + (uData.position[2] - tData.position[2]) ** 2;
                    const dynamicRangeSq = (u.range + (u.id.charCodeAt(0) % 5) * 0.1) ** 2;
                    if (dSq < dynamicRangeSq) {
                        uData.status = "attacking"; uData.isAttackingBase = false; isAttackingTarget = true;
                        // Fix: dynamic attack speed logic bound to Simulation Time
                        const unitAttackCooldown = u.isBoss ? settingsRef.current.globalAttackCooldown * 0.7 : settingsRef.current.globalAttackCooldown;
                        if (simNow - uData.lastAttackTime > unitAttackCooldown) {
                            // Apply global damage multiplier to base attack
                            const effectiveAttack = u.attack * settingsRef.current.globalDamageMultiplier;
                            const { damage: finalDmg } = calcDamage(
                                effectiveAttack,
                                settingsRef.current.critChance,
                                towerConfigRef.current.criticalMultiplier ?? 2.0,
                            );
                            currentTarget.hp -= finalDmg;
                            tData.hp = currentTarget.hp;
                            tData.lastDamageTime = now;
                            accumulateDamage(currentTarget.id, finalDmg, tData.position, u.type === "player" ? towerConfig.player.color : towerConfig.enemy.color);
                            uData.lastAttackTime = simNow;
                            statsRef.current.damageDealt[u.userName] = (statsRef.current.damageDealt[u.userName] || 0) + finalDmg;

                            if (currentTarget.hp <= 0) {
                                uData.victoryPauseUntil = now + settingsRef.current.victoryPauseMs;
                                uData.status = "idle";
                                addKillEvent(u.userName, currentTarget.userName, currentTarget.isBoss ? "boss" : "unit");
                            }
                        }
                    }
                }
            }

            if (!isAttackingTarget) uData.status = "marching";

            // Steering: Seek target rim or march in lane
            const vehicle = vehicles.current.get(u.id);
            if (vehicle) {
                const seek = vehicle.steering.behaviors.find((b) => b instanceof YUKA.SeekBehavior) as YUKA.SeekBehavior;
                if (seek && !isThrottled) {
                    if (currentTarget) {
                        const tData = unitDataRef.current.get(currentTarget.id);
                        if (tData) {
                            const dx = uData.position[0] - tData.position[0];
                            const dz = uData.position[2] - tData.position[2];
                            const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
                            const currentEncirclementRadius = settingsRef.current.encirclementRadius;
                            const currentEncirclementJitter = settingsRef.current.encirclementJitter;
                            const variableRadius = currentEncirclementRadius + (Math.sin(uData.jitterOffset) * currentEncirclementJitter);
                            seek.target.set(
                                tData.position[0] + (dx / dist) * variableRadius,
                                -0.4,
                                tData.position[2] + (dz / dist) * variableRadius,
                            );
                        }
                    } else {
                        const swagger = Math.sin(now * 0.001 + uData.jitterOffset) * settingsRef.current.laneSwaggerAmp;
                        const laneTargetX = uData.laneOffset + swagger;
                        const currentX = vehicle.position.x;
                        const targetZ = u.type === "player" ? ENEMY_BASE_Z : PLAYER_BASE_Z;
                        const spring = Math.abs(currentX - laneTargetX) > settingsRef.current.laneDriftThreshold ? settingsRef.current.laneSpringFar : settingsRef.current.laneSpringNear;
                        seek.target.set(laneTargetX + (currentX - laneTargetX) * (1 - spring), -0.4, targetZ);
                    }
                }
                // Dynamic Social Dynamics
                const separation = vehicle.steering.behaviors.find((b) => b instanceof YUKA.SeparationBehavior) as any;
                if (separation) {
                    separation.radius = settingsRef.current.separationRadius;
                    separation.weight = settingsRef.current.separationStrength * 15; // Scale strength to meaningful weights
                }

                // Dynamic Speed Sync: Recalculate maxSpeed if global settings changed
                const baseActualSpeed = u.speed;
                const targetMaxSpeed = uData.status === "attacking" ? 0 : (baseActualSpeed * settingsRef.current.globalSpeedMultiplier);
                if (vehicle.maxSpeed !== targetMaxSpeed) {
                    vehicle.maxSpeed = targetMaxSpeed;
                }
                
                if (uData.status === "attacking") vehicle.velocity.set(0, 0, 0);
                uData.position[0] = vehicle.position.x;
                uData.position[2] = vehicle.position.z;

                const velSq = vehicle.velocity.x ** 2 + vehicle.velocity.z ** 2;
                if (uData.status === 'marching' && velSq > 0.01) {
                    uData.rotation[1] = Math.atan2(vehicle.velocity.x, vehicle.velocity.z);
                } else if (uData.status === 'attacking') {
                    if (uData.isAttackingBase) {
                        const baseZ = u.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
                        const targetRot = Math.atan2(0 - uData.position[0], baseZ - uData.position[2]);
                        uData.rotation[1] = THREE.MathUtils.lerp(uData.rotation[1], targetRot, settingsRef.current.rotationSmoothing);
                    } else if (currentTarget) {
                        const tData = unitDataRef.current.get(currentTarget.id);
                        if (tData) {
                            const targetRot = Math.atan2(tData.position[0] - uData.position[0], tData.position[2] - uData.position[2]);
                            uData.rotation[1] = THREE.MathUtils.lerp(uData.rotation[1], targetRot, settingsRef.current.rotationSmoothing);
                        }
                    }
                } else {
                    const idleRot = u.type === 'player' ? 0 : Math.PI;
                    uData.rotation[1] = THREE.MathUtils.lerp(uData.rotation[1], idleRot, settingsRef.current.rotationSmoothing * 0.5);
                }
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
            const dx = uDataA.position[0] - uDataB.position[0];
            const dz = uDataA.position[2] - uDataB.position[2];
            const distSq = dx * dx + dz * dz;
            
            const currentSeparationRadius = settingsRef.current.separationRadius;
            const comfortZone = (uA.isBoss ? 2.5 : currentSeparationRadius) + (uB.isBoss ? 2.5 : currentSeparationRadius);
            
            if (distSq < comfortZone * comfortZone) {
                const dist = Math.sqrt(distSq) || 0.001;
                const overlap = comfortZone - dist;
                const pushStrength = settingsRef.current.separationStrength * (1.0 - dist / comfortZone);
                const nx = dx / dist; const nz = dz / dist;
                const force = overlap * pushStrength;
                uDataA.position[0] += nx * force; uDataA.position[2] += nz * force;
                uDataB.position[0] -= nx * force; uDataB.position[2] -= nz * force;
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
        updateSettingsRef: (newSettings: any) => { settingsRef.current = { ...settingsRef.current, ...newSettings }; },
        syncPerformance,
        stats: statsRef.current,
        replayStats: [...replayBufferRef.current],
        downloadReplay: () => {
            const data = JSON.stringify(replayBufferRef.current);
            const blob = new Blob([data], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `battle_replay_${Date.now()}.json`;
            a.click();
        },
        triggerAirstrike,
        updateSimulation,
        damageQueue: damageQueueRef,
        settingsRef,
    };
};
