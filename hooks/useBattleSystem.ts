// ============================================================
// BATTLE SYSTEM - MAIN HOOK (Controller)
// ============================================================
// Orchestrates the simulation loop and exposes the public API.
// Optimized for Zero-Allocation & High-Performance.
// ============================================================

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import * as YUKA from "yuka";
import * as THREE from "three";
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
} from "./battle/constants";

import {
    getUnitStats,
    pickRandom,
} from "./battle/battleUtils";

// --- GLOBAL SCRATCH VARIABLES (Zero-Allocation Loop) ---
const WORLD_UNIT_POOL_SIZE = 1200; 

export const useBattleSystem = () => {
    const [mapObstacles, setMapObstacles] = useState<MapObstacle[]>([]);
    const [debug, setDebug] = useState(true);

    const playerBaseHpRef = useRef(1000);
    const enemyBaseHpRef = useRef(1000);
    const gameStateRef = useRef<"SETUP" | "PLAYING" | "WON" | "LOST">("SETUP");

    const liveSettings = useStore((s) => s.settings);
    const settingsRef = useRef<SimulationSettings>(INITIAL_SETTINGS);
    useEffect(() => { settingsRef.current = liveSettings; }, [liveSettings]);
    
    const statsRef = useRef<BattleStats>({
        damageDealt: {}, playerDamage: {}, enemyDamage: {},
        playerKills: {}, enemyKills: {}, unitsSpawned: {},
        playerHits: {}, enemyHits: {},
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
    const unitIndexRef = useRef<Map<string, ActiveUnit>>(new Map());

    const spellsRef = useRef<any[]>(
        Array.from({ length: 300 }, () => ({
            fromX: 0, fromY: 1, fromZ: 0, toX: 0, toY: 1, toZ: 0,
            progress: 0, startTime: 0, active: false,
        }))
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
            units.push({ isActive: false, hp: 0, maxHp: 0, id: `pool-${i}`, isDying: false } as ActiveUnit);
            data.push({ isActive: false, id: `pool-${i}`, position: [0,0,0], rotation:[0,0,0], userName: "", isDying: false } as UnitRuntimeData);
            const v = new YUKA.Vehicle(); v.maxSpeed = 3; v.updateOrientation = false;
            vehs.push(v);
        }
        unitPoolRef.current = units;
        unitDataPoolRef.current = data;
        vehiclePoolRef.current = vehs;
    }, []);

    const damageQueueRef = useRef<{ value: number; position: [number, number, number]; isCrit: boolean; color: string; timestamp: number }[]>([]);
    const damageBufferRef = useRef<Map<string, { total: number; position: [number, number, number]; lastHit: number; color: string }>>(new Map());

    const flushDamageBuffer = useCallback((now: number) => {
        damageBufferRef.current.forEach((data, targetId) => {
            if (now - data.lastHit > 150) {
                if (damageQueueRef.current.length < 500) {
                    damageQueueRef.current.push({ value: Math.round(data.total), position: data.position, isCrit: data.total > 150, color: data.color, timestamp: now });
                }
                damageBufferRef.current.delete(targetId);
            }
        });
    }, []);

    const accumulateDamage = useCallback((targetId: string, value: number, position: number[], color: string) => {
        const existing = damageBufferRef.current.get(targetId);
        if (existing) {
            existing.total += value;
            existing.position[0] = position[0]; existing.position[1] = position[1]; existing.position[2] = position[2];
            existing.lastHit = Date.now();
        } else {
            damageBufferRef.current.set(targetId, { total: value, position: [position[0], position[1], position[2]], lastHit: Date.now(), color });
        }
    }, []);

    const [towerConfig, setTowerConfig] = useState<TowerConfig>({
        player: { name: "Pihak A", color: "#0066FF", active: true, commentKeyword: "indo", commentType: "contains", giftKeyword: "rose" },
        enemy: { name: "Pihak B", color: "#FF0033", active: true, commentKeyword: "malay", commentType: "contains", giftKeyword: "coffee" },
        baseHp: 1000, baseDistance: 24, maxUnits: 200,
        unitConfig: { hpMultiplier: 1.0, speedMultiplier: 1.0, attackMultiplier: 1.0 },
    });
    const towerConfigRef = useRef(towerConfig);
    useEffect(() => { towerConfigRef.current = towerConfig; }, [towerConfig]);

    const addKillEvent = useCallback((killer: string, victim: string, victimType: KillEvent["victimType"]) => {
        useStore.getState().addKillEvent({ id: Math.random().toString(36).substring(7), killer, victim, victimType, timestamp: Date.now() });
    }, []);

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
    }, [entityManager]);

    const spawnUnit = useCallback((level: number = 1, userName: string = "Guest", type: "player" | "enemy" = "player", isBoss: boolean = false, forcedClass?: any) => {
        let poolIdx = -1;
        for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
            if (!unitPoolRef.current[i].isActive) { poolIdx = i; break; }
        }
        if (poolIdx === -1) return;

        const name = userName.trim().substring(0, 16);
        const unitClass = forcedClass || pickRandom(["fighter", "tank", "mage", "marksman", "assassin"]);
        const stats = getUnitStats(level, towerConfigRef.current.unitConfig, settingsRef.current);
        const c = CLASS_CONFIG[unitClass as keyof typeof CLASS_CONFIG] || CLASS_CONFIG.fighter;

        const u = unitPoolRef.current[poolIdx];
        const uData = unitDataPoolRef.current[poolIdx];
        const v = vehiclePoolRef.current[poolIdx];

        u.isActive = true; u.id = `${type}-${poolIdx}-${Date.now()}`;
        u.type = type; u.userName = name; u.unitClass = unitClass;
        u.hp = stats.hp * c.hp; u.maxHp = stats.maxHp * c.hp;
        u.attack = stats.attack * c.atk; u.range = c.range;
        u.speed = stats.speed * c.move_speed_mult * (0.8 + Math.random() * 0.4);
        u.isDying = false; u.isBoss = isBoss; u.hpRegen = c.hp_regen;
        u.attackCooldown = settingsRef.current.globalAttackCooldown / (c.attack_speed_mult || 1.0);

        const dist = towerConfigRef.current.baseDistance ?? 24;
        const spawnZ = type === "player" ? dist - 2 : -dist + 2;
        const laneOffset = isBoss ? 0 : pickRandom(LANE_OFFSETS);
        
        v.position.set(laneOffset + (Math.random()-0.5)*4, -0.4, spawnZ + (Math.random()-0.5)*4);
        v.maxSpeed = u.speed; v.velocity.set(0,0,0);
        v.steering.behaviors.length = 0;
        
        const targetZ = type === "player" ? -dist : dist;
        v.steering.add(new YUKA.SeekBehavior(new YUKA.Vector3(laneOffset, -0.4, targetZ)));
        v.steering.add(new YUKA.SeparationBehavior());
        entityManager.add(v);

        uData.isActive = true; uData.id = u.id; uData.type = type; uData.userName = name;
        uData.hp = u.hp; uData.maxHp = u.maxHp; uData.position = [v.position.x, -0.4, v.position.z];
        uData.unitClass = unitClass; uData.isBoss = isBoss; uData.lastAttackTime = 0;
        uData.status = "marching"; uData.isDying = false;

        unitIndexRef.current.set(u.id, u);
    }, [entityManager]);

    const updateSimulation = useCallback((delta: number) => {
        if (gameStateRef.current !== "PLAYING") return;
        const now = Date.now();
        const settings = settingsRef.current;
        const simDelta = delta * (settings.timeScale || 1.0);
        simulationTimeRef.current += simDelta * 1000;
        const simNow = simulationTimeRef.current;

        // --- GRID BUCKET UPDATE (Zero-Allocation) ---
        bucketsMapRef.current.clear();
        for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
            const u = unitPoolRef.current[i];
            if (!u.isActive || u.isDying) continue;
            const uData = unitDataPoolRef.current[i];
            const bucketKey = Math.floor(uData.position[2] / 4.0); // 4m chunks
            let b = bucketsMapRef.current.get(bucketKey);
            if (!b) { b = []; bucketsMapRef.current.set(bucketKey, b); }
            b.push(i);
        }

        entityManager.update(simDelta);
        flushDamageBuffer(now);

        // --- MAIN SIMULATION LOOP ---
        for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
            const u = unitPoolRef.current[i];
            if (!u.isActive) continue;
            const uData = unitDataPoolRef.current[i];
            const v = vehiclePoolRef.current[i];

            if (u.isDying) {
                if (now - (u.deathTime || 0) > CORPSE_DESPAWN_MS) {
                    u.isActive = false; uData.isActive = false;
                    unitIndexRef.current.delete(u.id);
                    entityManager.remove(v);
                }
                continue;
            }

            if (u.hp <= 0) { u.isDying = true; u.deathTime = now; uData.isDying = true; v.maxSpeed = 0; continue; }

            // --- AI THINKING (Throttled per unit class) ---
            const thinkThrottle = u.unitClass === 'fighter' ? 100 : 150;
            if (!u.lastThinkTime || now - u.lastThinkTime > thinkThrottle) {
                u.lastThinkTime = now;
                const myBucket = Math.floor(uData.position[2] / 4.0);
                const isFighter = u.unitClass === 'fighter';
                const scanRange = isFighter ? 8 : 2; 
                const perceptionRadiusSq = isFighter ? 1024 : 144;
                let bestScore = -1;
                let bestTargetIdx = -1;
                let minDSq = perceptionRadiusSq;
                
                for (let bOff = -scanRange; bOff <= scanRange; bOff++) {
                    const neighbors = bucketsMapRef.current.get(myBucket + bOff);
                    if (!neighbors) continue;
                    for (const neighborIdx of neighbors) {
                        if (neighborIdx === i) continue;
                        const potential = unitPoolRef.current[neighborIdx];
                        if (potential.type === u.type) continue;
                        
                        const pData = unitDataPoolRef.current[neighborIdx];
                        const dx = uData.position[0] - pData.position[0];
                        const dz = uData.position[2] - pData.position[2];
                        const dSq = dx*dx + dz*dz;
                        if (dSq > perceptionRadiusSq) continue;

                        // Rule 3: Target Prioritization Scoring
                        let weight = 1.0;
                        if (u.unitClass === 'assassin' && (potential.unitClass === 'mage' || potential.unitClass === 'marksman')) {
                            weight = 10.0; 
                        } else if (isFighter) {
                            weight = 3.0; 
                        } else if (potential.isBoss) {
                            weight = 2.0;
                        }

                        const score = weight / (dSq + 0.1); 
                        if (score > bestScore) {
                            bestScore = score;
                            minDSq = dSq;
                            bestTargetIdx = neighborIdx;
                        }
                    }
                }

                if (bestTargetIdx !== -1) {
                    u.targetId = unitPoolRef.current[bestTargetIdx].id;
                    uData.status = "chasing";
                } else {
                    u.targetId = undefined;
                    uData.status = "marching";
                }
            }

            // --- COMBAT RESOLUTION ---
            const dist = towerConfig.baseDistance ?? 24;
            const targetBaseZ = u.type === "player" ? -dist : dist;
            let currentTarget: ActiveUnit | undefined = u.targetId ? unitIndexRef.current.get(u.targetId) : undefined;
            if (currentTarget && (!currentTarget.isActive || currentTarget.isDying)) { currentTarget = undefined; u.targetId = undefined; }

            const dxB = uData.position[0]; const dzB = uData.position[2] - targetBaseZ;
            const distToBaseSq = dxB*dxB + dzB*dzB;
            const baseInRange = distToBaseSq < (u.range * u.range);

            if (currentTarget) {
                const tIdx = parseInt(currentTarget.id.split('-')[1]);
                const tData = unitDataPoolRef.current[tIdx];
                const dxT = uData.position[0] - tData.position[0];
                const dzT = uData.position[2] - tData.position[2];
                const dSq = dxT*dxT + dzT*dzT;

                if (dSq < (u.range * u.range)) {
                    uData.status = "attacking"; v.maxSpeed = 0;
                    if (simNow - (uData.lastAttackTime || 0) > u.attackCooldown) {
                        const dmg = u.attack;
                        currentTarget.hp -= dmg; tData.hp = currentTarget.hp;
                        accumulateDamage(currentTarget.id, dmg, tData.position, u.type === 'player' ? "#0066FF" : "#FF0033");
                        uData.lastAttackTime = simNow;
                    }
                } else {
                    uData.status = "chasing"; v.maxSpeed = u.speed;
                    v.steering.behaviors.forEach((b: any) => { if (b.target) b.target.set(tData.position[0], 0, tData.position[2]); });
                }
            } else if (baseInRange) {
                uData.status = "attacking"; v.maxSpeed = 0;
                if (simNow - (uData.lastAttackTime || 0) > u.attackCooldown) {
                    const dmg = u.attack;
                    if (u.type === "player") {
                        enemyBaseHpRef.current -= dmg;
                        if (enemyBaseHpRef.current <= 0) addKillEvent(u.userName, "ENEMY BASE", "base");
                    } else {
                        playerBaseHpRef.current -= dmg;
                        if (playerBaseHpRef.current <= 0) addKillEvent(u.userName, "PLAYER BASE", "base");
                    }
                    accumulateDamage(u.type === "player" ? "enemy-base" : "player-base", dmg, [0, 2, targetBaseZ], u.type === 'player' ? "#0066FF" : "#FF0033");
                    uData.lastAttackTime = simNow;
                }
            } else {
                uData.status = "marching"; v.maxSpeed = u.speed;
                v.steering.behaviors.forEach((b: any) => { if (b.target) b.target.set(0, 0, targetBaseZ); });
            }

            uData.position[0] = v.position.x; uData.position[2] = v.position.z;
        }

        if (playerBaseHpRef.current <= 0 && gameStateRef.current === "PLAYING") { gameStateRef.current = "LOST"; useStore.getState().setGameState("LOST"); }
        if (enemyBaseHpRef.current <= 0 && gameStateRef.current === "PLAYING") { gameStateRef.current = "WON"; useStore.getState().setGameState("WON"); }

        if (now - lastStateUpdate.current > 100) {
            lastStateUpdate.current = now;
            let pC = 0, eC = 0;
            for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                if (unitPoolRef.current[i].isActive && !unitPoolRef.current[i].isDying) {
                    if (unitPoolRef.current[i].type === 'player') pC++; else eC++;
                }
            }
            useStore.getState().setArmyCounts(pC, eC);
            useStore.getState().setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
        }
    }, [entityManager, flushDamageBuffer, accumulateDamage, addKillEvent]);

    return {
        towerConfig, setTowerConfig, spawnUnit, resetBattle, 
        getMVPData: () => ({ topDamage: null, topSpawner: null, playerTopHit: null, enemyTopHit: null }),
        setMapObstacles, mapObstacles, debug, setDebug,
        unitRegistry: unitDataPoolRef as React.RefObject<UnitRuntimeData[]>,
        vehicles: vehiclePoolRef as React.RefObject<YUKA.Vehicle[]>,
        unitIndex: unitIndexRef,
        updateSettingsRef: (newS: any) => { settingsRef.current = { ...settingsRef.current, ...newS }; },
        spellsRef: spellsRef,
        stats: statsRef.current,
        triggerAirstrike: (side: "player" | "enemy") => {
            for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                const u = unitPoolRef.current[i];
                if (u.isActive && u.type === side && !u.isDying) {
                    u.hp -= u.maxHp * 0.4;
                    unitDataPoolRef.current[i].hp = u.hp;
                    accumulateDamage(u.id, u.maxHp * 0.4, unitDataPoolRef.current[i].position, "#FFFFFF");
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
