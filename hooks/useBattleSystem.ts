// ============================================================
// BATTLE SYSTEM - MAIN HOOK (Controller)
// ============================================================
// Orchestrates the simulation loop and exposes the public API.
// Optimized for Zero-Allocation & High-Performance.
// ============================================================

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import * as YUKA from "yuka";
import { useStore } from "./useStore";

import type {
    ActiveUnit,
    TowerConfig,
    MapObstacle,
    KillEvent,
    BattleStats,
    SimulationSettings,
    UnitRuntimeData,
} from "./battle/types";

export type {
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
    ENEMY_BASE_Z,
    PLAYER_BASE_Z,
    CLASS_CONFIG,
    CORPSE_DESPAWN_MS,
    MAGE_PROJECTILE_TIME_MS,
    WEATHER_CONFIG,
} from "./battle/constants";

import { getUnitStats, pickRandom } from "./battle/battleUtils";

// --- GLOBAL SCRATCH VARIABLES (Zero-Allocation Loop) ---
const WORLD_UNIT_POOL_SIZE = 250;

export const useBattleSystem = () => {
    const [mapObstacles, setMapObstacles] = useState<MapObstacle[]>([]);
    const [debug, setDebug] = useState(true);

    const playerBaseHpRef = useRef(1000);
    const enemyBaseHpRef = useRef(1000);
    const gameStateRef = useRef<"SETUP" | "PLAYING" | "WON" | "LOST">("SETUP");

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
        classStats: {
            fighter: {
                damageDealt: 0,
                damageTaken: 0,
                kills: 0,
                unitsSpawned: 0,
                healing: 0,
            },
            tank: {
                damageDealt: 0,
                damageTaken: 0,
                kills: 0,
                unitsSpawned: 0,
                healing: 0,
            },
            mage: {
                damageDealt: 0,
                damageTaken: 0,
                kills: 0,
                unitsSpawned: 0,
                healing: 0,
            },
            marksman: {
                damageDealt: 0,
                damageTaken: 0,
                kills: 0,
                unitsSpawned: 0,
                healing: 0,
            },
            assassin: {
                damageDealt: 0,
                damageTaken: 0,
                kills: 0,
                unitsSpawned: 0,
                healing: 0,
            },
        },
        teamSummary: {
            player: { totalDamage: 0, totalKills: 0, unitsLost: 0 },
            enemy: { totalDamage: 0, totalKills: 0, unitsLost: 0 },
        },
    });

    const entityManager = useMemo(() => new YUKA.EntityManager(), []);
    const unitIndexRef = useRef<Map<string, ActiveUnit>>(new Map());

    const spellsRef = useRef<any[]>(
        Array.from({ length: 300 }, () => ({
            fromX: 0,
            fromY: 1,
            fromZ: 0,
            toX: 0,
            toY: 1,
            toZ: 0,
            progress: 0,
            startTime: 0,
            active: false,
        })),
    );
    const mmSpellsRef = useRef<any[]>(
        Array.from({ length: 400 }, () => ({
            fromX: 0,
            fromY: 1,
            fromZ: 0,
            toX: 0,
            toY: 1,
            toZ: 0,
            progress: 0,
            startTime: 0,
            active: false,
        })),
    );
    const fighterSpellsRef = useRef<any[]>(
        Array.from({ length: 200 }, () => ({
            x: 0,
            y: 0,
            z: 0,
            rotation: 0,
            progress: 0,
            startTime: 0,
            active: false,
            color: "#ffffff",
        })),
    );
    const tankSpellsRef = useRef<any[]>(
        Array.from({ length: 150 }, () => ({
            x: 0,
            y: 0,
            z: 0,
            progress: 0,
            startTime: 0,
            active: false,
            color: "#ffffff",
        })),
    );
    const assassinSpellsRef = useRef<any[]>(
        Array.from({ length: 150 }, () => ({
            x: 0,
            y: 0,
            z: 0,
            progress: 0,
            startTime: 0,
            active: false,
            color: "#ffffff",
        })),
    );

    const simulationTimeRef = useRef<number>(0);
    const bucketsMapRef = useRef<Map<number, number[]>>(new Map());
    const lastStateUpdate = useRef<number>(0);

    // --- ZERO-ALLOCATION OBJECT POOL ---
    const unitPoolRef = useRef<ActiveUnit[]>([]);
    const unitDataPoolRef = useRef<UnitRuntimeData[]>([]);
    const vehiclePoolRef = useRef<YUKA.Vehicle[]>([]);

    useEffect(() => {
        const units: ActiveUnit[] = [];
        const data: UnitRuntimeData[] = [];
        const vehs: YUKA.Vehicle[] = [];
        for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
            units.push({
                isActive: false,
                hp: 0,
                maxHp: 0,
                id: `pool-${i}`,
                isDying: false,
            } as ActiveUnit);
            data.push({
                isActive: false,
                id: `pool-${i}`,
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                userName: "",
                isDying: false,
            } as UnitRuntimeData);
            const v = new YUKA.Vehicle();
            v.maxSpeed = 3.2;
            v.mass = 1;
            v.updateOrientation = false;
            vehs.push(v);
        }
        unitPoolRef.current = units;
        unitDataPoolRef.current = data;
        vehiclePoolRef.current = vehs;
    }, []);

    const damageQueueRef = useRef<
        {
            value: number;
            position: [number, number, number];
            isCrit: boolean;
            color: string;
            timestamp: number;
        }[]
    >([]);
    const damageBufferRef = useRef<
        Map<
            string,
            {
                total: number;
                position: [number, number, number];
                lastHit: number;
                color: string;
            }
        >
    >(new Map());

    const flushDamageBuffer = useCallback((now: number) => {
        damageBufferRef.current.forEach((data, targetId) => {
            if (now - data.lastHit > 150) {
                if (damageQueueRef.current.length < 500) {
                    damageQueueRef.current.push({
                        value: Math.round(data.total),
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

    const accumulateDamage = useCallback(
        (
            targetId: string,
            value: number,
            position: number[],
            color: string,
        ) => {
            const existing = damageBufferRef.current.get(targetId);
            if (existing) {
                existing.total += value;
                existing.position[0] = position[0];
                existing.position[1] = position[1];
                existing.position[2] = position[2];
                existing.lastHit = Date.now();
            } else {
                damageBufferRef.current.set(targetId, {
                    total: value,
                    position: [position[0], position[1], position[2]],
                    lastHit: Date.now(),
                    color,
                });
            }
        },
        [],
    );

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
        maxUnits: 200,
        unitConfig: {
            hpMultiplier: 1.0,
            speedMultiplier: 1.0,
            attackMultiplier: 1.0,
        },
    });
    const towerConfigRef = useRef(towerConfig);
    useEffect(() => {
        towerConfigRef.current = towerConfig;
    }, [towerConfig]);

    const addKillEvent = useCallback(
        (
            killer: string,
            victim: string,
            victimType: KillEvent["victimType"],
        ) => {
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

    const resetBattle = useCallback(() => {
        gameStateRef.current = "PLAYING";
        playerBaseHpRef.current = towerConfigRef.current.baseHp;
        enemyBaseHpRef.current = towerConfigRef.current.baseHp;
        useStore.getState().setGameState("PLAYING");
        useStore.getState().resetStore(towerConfigRef.current);

        for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
            unitPoolRef.current[i].isActive = false;
            unitDataPoolRef.current[i].isActive = false;
            entityManager.remove(vehiclePoolRef.current[i]);
        }
        unitIndexRef.current.clear();
        damageBufferRef.current.clear();
        damageQueueRef.current.length = 0;
        spellsRef.current.forEach((s) => (s.active = false));
        mmSpellsRef.current.forEach((s) => (s.active = false));
    }, [entityManager]);

    const spawnUnit = useCallback(
        (
            level: number = 1,
            userName: string = "Guest",
            type: "player" | "enemy" = "player",
            isBoss: boolean = false,
            forcedClass?: any,
        ) => {
            // --- 1. CAPACITY CHECK (Sync with UI Settings) ---
            const maxUnits =
                towerConfigRef.current.maxUnits ||
                settingsRef.current.maxUnits ||
                200;
            let currentActiveCount = 0;
            for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                if (unitPoolRef.current[i].isActive) currentActiveCount++;
            }
            if (currentActiveCount >= maxUnits) return;

            let poolIdx = -1;
            for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                if (!unitPoolRef.current[i].isActive) {
                    poolIdx = i;
                    break;
                }
            }
            if (poolIdx === -1) return;

            const name = userName.trim().substring(0, 16);
            const unitClass =
                forcedClass ||
                pickRandom(["fighter", "tank", "mage", "marksman", "assassin"]);
            const stats = getUnitStats(
                level,
                towerConfigRef.current.unitConfig,
                settingsRef.current,
            );
            const c =
                CLASS_CONFIG[unitClass as keyof typeof CLASS_CONFIG] ||
                CLASS_CONFIG.fighter;

            const u = unitPoolRef.current[poolIdx];
            const uData = unitDataPoolRef.current[poolIdx];
            const v = vehiclePoolRef.current[poolIdx];

            u.isActive = true;
            u.id = `${type}-${poolIdx}-${Date.now()}`;
            u.type = type;
            u.userName = name;
            u.unitClass = unitClass;
            u.hp = stats.hp * c.hp;
            u.maxHp = stats.maxHp * c.hp;
            u.attack = stats.attack * c.atk;
            u.range = c.range;
            u.speed =
                stats.speed * c.move_speed_mult * (0.8 + Math.random() * 0.4);
            u.isDying = false;
            u.isBoss = isBoss;
            u.hpRegen = c.hp_regen;
            u.attackCooldown =
                settingsRef.current.globalAttackCooldown /
                (c.attack_speed_mult || 1.0);

            const dist = towerConfigRef.current.baseDistance ?? 24;
            const spawnZ = type === "player" ? dist - 2 : -dist + 2;
            const laneOffset = isBoss ? 0 : pickRandom(LANE_OFFSETS);

            v.position.set(
                laneOffset + (Math.random() - 0.5) * 4,
                -0.4,
                spawnZ + (Math.random() - 0.5) * 4,
            );
            v.maxSpeed = u.speed;
            v.velocity.set(0, 0, 0);
            v.steering.behaviors.length = 0;

            const targetZ = type === "player" ? -dist : dist;
            v.steering.add(
                new YUKA.SeekBehavior(
                    new YUKA.Vector3(laneOffset, -0.4, targetZ),
                ),
            );

            // Intelligence: Add separation to prevent clumping (making units feel smarter/individual)
            const separation = new YUKA.SeparationBehavior();
            separation.weight = 1.5; // Increased weight for better spacing
            v.steering.add(separation);

            entityManager.add(v);

            uData.isActive = true;
            uData.id = u.id;
            uData.type = type;
            uData.userName = name;
            uData.hp = u.hp;
            uData.maxHp = u.maxHp;
            uData.position = [v.position.x, -0.4, v.position.z];
            uData.unitClass = unitClass;
            uData.isBoss = isBoss;
            uData.lastAttackTime = 0;
            uData.status = "marching";
            uData.isDying = false;
            uData.range = u.range;
            uData.speed = u.speed;

            unitIndexRef.current.set(u.id, u);
        },
        [entityManager],
    );

    const currentWeather = useStore((s) => s.weather);
    const freezeTimeRef = useRef(0);

    // Grid config (4x4m cells)
    const GRID_SIZE = 4;
    const GRID_PACK = 10000;
    const getGridKey = (x: number, z: number) => {
        return (
            Math.floor(x / GRID_SIZE) +
            1000 +
            (Math.floor(z / GRID_SIZE) + 1000) * GRID_PACK
        );
    };

    const updateSimulation = useCallback(
        (delta: number) => {
            const now = performance.now();

            // Handle Freeze Time (Hit-stop effect)
            if (freezeTimeRef.current > 0) {
                freezeTimeRef.current -= delta * 1000;
                return; // Early exit simulation logic
            }

            const simDelta = delta * (settingsRef.current.timeScale || 1.0);
            simulationTimeRef.current += simDelta * 1000;
            const simNow = simulationTimeRef.current;
            const settings = settingsRef.current;
            const weather = useStore.getState().weather;
            const weatherCfg = (WEATHER_CONFIG as any)[weather] || {};
            const weatherMults = weatherCfg.multipliers || {};

            // PERFORMANCE: Skip intensive loops if no units are active
            let activeCount = 0;
            for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                if (unitPoolRef.current[i].isActive) activeCount++;
            }
            if (activeCount === 0 && gameStateRef.current !== "PLAYING") return;

            // --- 2D GRID BUCKET UPDATE (Zero-Allocation) ---
            bucketsMapRef.current.clear();

            if (activeCount > 0) {
                for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                    const u = unitPoolRef.current[i];
                    if (!u.isActive || u.isDying) continue;
                    const uData = unitDataPoolRef.current[i];
                    const bucketKey = getGridKey(
                        uData.position[0],
                        uData.position[2],
                    );
                    let b = bucketsMapRef.current.get(bucketKey);
                    if (!b) {
                        b = [];
                        bucketsMapRef.current.set(bucketKey, b);
                    }
                    b.push(i);
                }
            }

            entityManager.update(simDelta);
            flushDamageBuffer(now);

            // --- MAIN SIMULATION LOOP ---
            for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                const u = unitPoolRef.current[i];
                const uData = unitDataPoolRef.current[i];
                const v = vehiclePoolRef.current[i];

                if (!u.isActive || u.hp <= 0) {
                    uData.position[1] = -100;
                    v.velocity.set(0, 0, 0); // Extra safety
                    continue;
                }

                if (u.hp <= 0 && !u.isDying) {
                    u.isDying = true;
                    u.deathTime = simNow; // Use simulation time!
                    uData.isDying = true;
                    v.maxSpeed = 0;
                    v.velocity.set(0, 0, 0);
                    v.steering.behaviors.length = 0;
                    entityManager.remove(v);

                    // SUPREME IMPACT: Freeze Frame on Boss Death
                    if (u.isBoss) {
                        freezeTimeRef.current = 200; // 0.2s Hit-stop
                    }
                    continue;
                }

                if (u.isDying) {
                    if (simNow - (u.deathTime || 0) > CORPSE_DESPAWN_MS) {
                        u.isActive = false;
                        uData.isActive = false;
                        unitIndexRef.current.delete(u.id);
                    }
                    continue;
                }

                // --- AI THINKING (Throttled per unit sim-time) ---
                const thinkThrottle = u.unitClass === "fighter" ? 100 : 150;
                if (
                    !u.lastThinkTime ||
                    simNow - u.lastThinkTime > thinkThrottle
                ) {
                    u.lastThinkTime = simNow;
                    const isFighter = u.unitClass === "fighter";
                    const perceptionRadiusSq = isFighter ? 1024 : 144;
                    // Rule 3: Target Prioritization Scoring
                    let bestScore = -1;
                    let bestTargetIdx = -1;

                    // --- SCORE TOWER ---
                    const dist = towerConfig.baseDistance ?? 24;
                    const targetBaseZ = u.type === "player" ? -dist : dist;
                    const dxB = uData.position[0];
                    const dzB = uData.position[2] - targetBaseZ;
                    const distToBaseSq = dxB * dxB + dzB * dzB;

                    // Tower is the "Ultimate" target (highest weight)
                    const towerWeight = 6.0;
                    bestScore = towerWeight / (distToBaseSq + 0.1);
                    const targetedBaseId =
                        u.type === "player" ? "enemy-base" : "player-base";

                    const currentX = Math.floor(uData.position[0] / GRID_SIZE);
                    const currentZ = Math.floor(uData.position[2] / GRID_SIZE);

                    for (let xOff = -1; xOff <= 1; xOff++) {
                        for (let zOff = -1; zOff <= 1; zOff++) {
                            const key =
                                currentX +
                                xOff +
                                1000 +
                                (currentZ + zOff + 1000) * GRID_PACK;
                            const neighbors = bucketsMapRef.current.get(key);
                            if (!neighbors) continue;
                            for (const neighborIdx of neighbors) {
                                if (neighborIdx === i) continue;
                                const potential =
                                    unitPoolRef.current[neighborIdx];
                                if (potential.type === u.type) continue;

                                const pData =
                                    unitDataPoolRef.current[neighborIdx];
                                const dx =
                                    uData.position[0] - pData.position[0];
                                const dz =
                                    uData.position[2] - pData.position[2];
                                const dSq = dx * dx + dz * dz;
                                if (dSq > perceptionRadiusSq) continue;

                                let weight = 1.0;
                                if (isFighter) {
                                    weight = 3.0;
                                } else if (potential.isBoss) {
                                    weight = 2.0;
                                }

                                const score = weight / (dSq + 0.1);
                                if (score > bestScore) {
                                    bestScore = score;
                                    bestTargetIdx = neighborIdx;
                                }
                            }
                        }
                    }

                    if (bestTargetIdx !== -1) {
                        u.targetId = unitPoolRef.current[bestTargetIdx].id;
                        uData.status = "chasing";
                    } else {
                        // ONLY target the base if NO units were found in perception range
                        u.targetId = targetedBaseId;
                        uData.status = "marching";
                    }
                }

                // --- COMBAT RESOLUTION ---
                const dist = towerConfig.baseDistance ?? 24;
                const targetBaseZ = u.type === "player" ? -dist : dist;
                const isBaseTarget =
                    u.targetId === "player-base" || u.targetId === "enemy-base";

                // SPECIAL: Mages/Marksmen move closer to Towers (Range Mult 0.82)
                const isRanged =
                    u.unitClass === "mage" || u.unitClass === "marksman";
                const rangeMult = isBaseTarget && isRanged ? 0.82 : 1.0;
                const effectiveRange = u.range * rangeMult;
                const rangeSq = effectiveRange * effectiveRange;

                let currentTarget: ActiveUnit | undefined =
                    u.targetId && !isBaseTarget
                        ? unitIndexRef.current.get(u.targetId)
                        : undefined;
                if (
                    currentTarget &&
                    (!currentTarget.isActive || currentTarget.isDying)
                ) {
                    currentTarget = undefined;
                    u.targetId = undefined;
                }

                const dxB = uData.position[0];
                const dzB = uData.position[2] - targetBaseZ;
                const distToBaseSq = dxB * dxB + dzB * dzB;
                const baseInRange = distToBaseSq < rangeSq; // Use adjusted range

                if (currentTarget) {
                    const tIdx = parseInt(currentTarget.id.split("-")[1]);
                    const tData = unitDataPoolRef.current[tIdx];
                    const dxT = uData.position[0] - tData.position[0];
                    const dzT = uData.position[2] - tData.position[2];
                    const dSq = dxT * dxT + dzT * dzT;

                    if (dSq < u.range * u.range) {
                        uData.status = "attacking";
                        v.maxSpeed = 0;
                        if (
                            simNow - (uData.lastAttackTime || 0) >
                            u.attackCooldown
                        ) {
                            let dmg = u.attack;

                            // Weather damage modifiers
                            const classDmgMult =
                                weatherMults[u.unitClass]?.atk || 1.0;
                            const globalDmgMult =
                                weatherMults.globalDamageMultiplier || 1.0;
                            dmg *= classDmgMult * globalDmgMult;

                            if (uData.pendingCrit) {
                                dmg *= 2.5;
                                uData.pendingCrit = false;
                            }

                            if (u.unitClass === "mage") {
                                // --- MAGE AOE LOGIC ---
                                let hits = 0;
                                const AOE_RADIUS_SQ = 12.25; // 3.5m radius
                                const tGridX = Math.floor(
                                    tData.position[0] / GRID_SIZE,
                                );
                                const tGridZ = Math.floor(
                                    tData.position[2] / GRID_SIZE,
                                );

                                // Main target logic inside AOE
                                currentTarget.hp -= dmg;
                                tData.hp = currentTarget.hp;
                                if (currentTarget.hp <= 0) {
                                    currentTarget.isActive = false;
                                    tData.isActive = false;
                                    tData.position[1] = -100;
                                }
                                accumulateDamage(
                                    currentTarget.id,
                                    dmg,
                                    tData.position,
                                    u.type === "player" ? "#0066FF" : "#FF0033",
                                );
                                hits++;

                                // Adjacent 2D search for AOE
                                for (let xOff = -1; xOff <= 1; xOff++) {
                                    for (let zOff = -1; zOff <= 1; zOff++) {
                                        if (hits >= 4) break;
                                        const key =
                                            tGridX +
                                            xOff +
                                            1000 +
                                            (tGridZ + zOff + 1000) * GRID_PACK;
                                        const neighbors =
                                            bucketsMapRef.current.get(key);
                                        if (!neighbors) continue;
                                        for (const nIdx of neighbors) {
                                            if (hits >= 4) break;
                                            const p = unitPoolRef.current[nIdx];
                                            if (
                                                p.id === currentTarget.id ||
                                                p.type === u.type ||
                                                p.isDying ||
                                                !p.isActive
                                            )
                                                continue;

                                            const pD =
                                                unitDataPoolRef.current[nIdx];
                                            const dx =
                                                tData.position[0] -
                                                pD.position[0];
                                            const dz =
                                                tData.position[2] -
                                                pD.position[2];
                                            if (
                                                dx * dx + dz * dz <
                                                AOE_RADIUS_SQ
                                            ) {
                                                p.hp -= dmg;
                                                pD.hp = p.hp;
                                                if (p.hp <= 0) {
                                                    p.isActive = false;
                                                    pD.isActive = false;
                                                    pD.position[1] = -100;
                                                }
                                                accumulateDamage(
                                                    p.id,
                                                    dmg,
                                                    pD.position,
                                                    u.type === "player"
                                                        ? "#0066FF"
                                                        : "#FF0033",
                                                );
                                                hits++;
                                            }
                                        }
                                    }
                                }
                            } else {
                                // Standard Single Target
                                currentTarget.hp -= dmg;
                                tData.hp = currentTarget.hp;
                                if (currentTarget.hp <= 0) {
                                    currentTarget.isActive = false;
                                    tData.isActive = false;
                                    tData.position[1] = -100;
                                }
                                accumulateDamage(
                                    currentTarget.id,
                                    dmg,
                                    tData.position,
                                    u.type === "player" ? "#0066FF" : "#FF0033",
                                );
                            }
                            uData.lastAttackTime = simNow;
                        }
                    } else {
                        uData.status = "chasing";
                        const classWeatherMult =
                            weatherMults[u.unitClass]?.move_speed_mult || 1.0;
                        v.maxSpeed = u.speed * classWeatherMult;
                        v.steering.behaviors.forEach((b: any) => {
                            if (b.target)
                                b.target.set(
                                    tData.position[0],
                                    0,
                                    tData.position[2],
                                );
                        });
                    }
                } else if (baseInRange) {
                    uData.status = "attacking";
                    v.maxSpeed = 0;
                    if (
                        simNow - (uData.lastAttackTime || 0) >
                        u.attackCooldown
                    ) {
                        const dmg = u.attack;
                        if (u.type === "player") {
                            enemyBaseHpRef.current -= dmg;
                            if (enemyBaseHpRef.current <= 0) {
                                addKillEvent(u.userName, "ENEMY BASE", "base");
                                freezeTimeRef.current = 100; // Hit-stop
                            }
                        } else {
                            playerBaseHpRef.current -= dmg;
                            if (playerBaseHpRef.current <= 0) {
                                addKillEvent(u.userName, "PLAYER BASE", "base");
                                freezeTimeRef.current = 100; // Hit-stop
                            }
                        }
                        accumulateDamage(
                            u.type === "player" ? "enemy-base" : "player-base",
                            dmg,
                            [0, 2, targetBaseZ],
                            u.type === "player" ? "#0066FF" : "#FF0033",
                        );

                        // Optimize: Base impact effect
                        if (simNow - (uData.lastEffectTime || 0) > 400) {
                            uData.lastEffectTime = simNow;
                            // Trigger base explosion/impact if damage is high
                            if (dmg > 50) {
                                // We'll add this to VFXManager later
                            }
                        }

                        uData.lastAttackTime = simNow;
                    }
                } else {
                    uData.status = "marching";
                    // Unified Speed Calculation + Weather Modifiers
                    const classWeatherMult =
                        weatherMults[u.unitClass]?.move_speed_mult || 1.0;
                    const globalWeatherMult =
                        weatherMults.globalSpeedMultiplier || 1.0;
                    const baseSpeed =
                        u.speed *
                        (settings.globalSpeedMultiplier || 1.0) *
                        classWeatherMult *
                        globalWeatherMult;

                    v.maxSpeed = baseSpeed;
                    v.steering.behaviors.forEach((b: any) => {
                        if (b.target) b.target.set(0, 0, targetBaseZ);
                    });
                }

                // --- 2. PHYSICS DAMPING (Anti-Bleeding) ---
                v.velocity.multiplyScalar(0.98);

                // --- 3. POSITION GUARD (Anti-Lightning Speed Limiter) ---
                const oldX = uData.position[0];
                const oldZ = uData.position[2];
                const newX = v.position.x;
                const newZ = v.position.z;

                // Calculate movement displacement this step
                const dx = newX - oldX;
                const dz = newZ - oldZ;
                const moveDistSq = dx * dx + dz * dz;

                // Electronic speed limit: units can only move speed * delta (+ 10% safety margin)
                const maxStepDist = v.maxSpeed * simDelta * 1.1;
                const maxStepDistSq = maxStepDist * maxStepDist;

                if (moveDistSq > maxStepDistSq && v.maxSpeed > 0) {
                    const ratio = maxStepDist / Math.sqrt(moveDistSq);
                    uData.position[0] = oldX + dx * ratio;
                    uData.position[2] = oldZ + dz * ratio;
                    // Sync back to physics engine so it doesn't "rubber band"
                    v.position.set(uData.position[0], -0.4, uData.position[2]);
                } else {
                    uData.position[0] = newX;
                    uData.position[2] = newZ;
                }
            }

            if (
                playerBaseHpRef.current <= 0 &&
                gameStateRef.current === "PLAYING"
            ) {
                gameStateRef.current = "LOST";
                useStore.getState().setGameState("LOST");
            }
            if (
                enemyBaseHpRef.current <= 0 &&
                gameStateRef.current === "PLAYING"
            ) {
                gameStateRef.current = "WON";
                useStore.getState().setGameState("WON");
            }

            if (simNow - lastStateUpdate.current > 100) {
                lastStateUpdate.current = simNow;
                let pC = 0,
                    eC = 0;
                for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                    if (
                        unitPoolRef.current[i].isActive &&
                        !unitPoolRef.current[i].isDying
                    ) {
                        if (unitPoolRef.current[i].type === "player") pC++;
                        else eC++;
                    }
                }
                useStore.getState().setArmyCounts(pC, eC);
                useStore
                    .getState()
                    .setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
            }
        },
        [entityManager, flushDamageBuffer, accumulateDamage, addKillEvent],
    );

    return {
        towerConfig,
        setTowerConfig,
        spawnUnit,
        resetBattle,
        getMVPData: () => ({
            topDamage: null,
            topSpawner: null,
            playerTopHit: null,
            enemyTopHit: null,
        }),
        setMapObstacles,
        mapObstacles,
        debug,
        setDebug,
        unitRegistry: unitDataPoolRef as React.RefObject<UnitRuntimeData[]>,
        vehicles: vehiclePoolRef as React.RefObject<YUKA.Vehicle[]>,
        unitIndex: unitIndexRef,
        updateSettingsRef: (newS: any) => {
            settingsRef.current = { ...settingsRef.current, ...newS };
        },
        spellsRef: spellsRef,
        mmSpellsRef: mmSpellsRef,
        fighterSpellsRef: fighterSpellsRef,
        tankSpellsRef: tankSpellsRef,
        assassinSpellsRef: assassinSpellsRef,
        stats: statsRef.current,
        triggerAirstrike: (side: "player" | "enemy") => {
            for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                const u = unitPoolRef.current[i];
                if (u.isActive && u.type === side && !u.isDying) {
                    u.hp -= u.maxHp * 0.4;
                    unitDataPoolRef.current[i].hp = u.hp;
                    accumulateDamage(
                        u.id,
                        u.maxHp * 0.4,
                        unitDataPoolRef.current[i].position,
                        "#FFFFFF",
                    );
                }
            }
        },
        updateSimulation,
        damageQueue: damageQueueRef,
        settingsRef,
        simTimeRef: simulationTimeRef,
        downloadPerfLogs: () => {},
        clearVFXCache: () => {},
    };
};
