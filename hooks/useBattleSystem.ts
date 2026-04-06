import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import * as YUKA from "yuka";
import { useStore } from "./useStore";

export interface UnitStats {
    hp: number;
    maxHp: number;
    attack: number;
    speed: number;
    range: number;
    level: number;
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
    maxUnits: number;
    unitConfig: {
        hpMultiplier: number;
        speedMultiplier: number;
        attackMultiplier: number;
    };
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
    userName: string;
    position?: [number, number, number];
    status: "idling" | "marching" | "attacking";
    targetId?: string;
    lastAttackTime: number;
    isDying?: boolean;
    deathTime?: number;
    isBoss: boolean;
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
    unitsSpawned: Record<string, number>;
    playerHits: Record<string, number>;
    enemyHits: Record<string, number>;
}

const PLAYER_BASE_Z = 24;
const ENEMY_BASE_Z = -24;

const getUnitStats = (
    level: number,
    config: TowerConfig["unitConfig"],
): UnitStats => ({
    hp: Math.floor(100 * Math.pow(2.2, level - 1) * config.hpMultiplier),
    maxHp: Math.floor(100 * Math.pow(2.2, level - 1) * config.hpMultiplier),
    attack: Math.floor(25 * Math.pow(1.8, level - 1) * config.attackMultiplier),
    speed: 2.2 * config.speedMultiplier,
    range: 2.5,
    level,
});

export const useBattleSystem = () => {
    const [activeUnits, setActiveUnits] = useState<ActiveUnit[]>([]);
    const [damageTexts, setDamageTexts] = useState<DamageText[]>([]);
    const [mapObstacles, setMapObstacles] = useState<MapObstacle[]>([]);
    const [debug, setDebug] = useState(true);

    // References for UI state to avoid closure issues in setInterval
    const playerBaseHpRef = useRef(1000);
    const enemyBaseHpRef = useRef(1000);
    const gameStateRef = useRef<"SETUP" | "PLAYING" | "WON" | "LOST">("SETUP");

    const statsRef = useRef<BattleStats>({
        damageDealt: {},
        playerDamage: {},
        enemyDamage: {},
        unitsSpawned: {},
        playerHits: {},
        enemyHits: {},
    });

    const replayBufferRef = useRef<any[]>([]);
    const [updateTick, setUpdateTick] = useState(0); // Trigger for UI refresh
    const lastLogTimeRef = useRef<number>(0);
    const frameParityRef = useRef<number>(0);

    const entityManager = useMemo(() => new YUKA.EntityManager(), []);
    const vehicles = useRef<Map<string, YUKA.Vehicle>>(new Map());
    const unitRegistry = useRef<
        Map<
            string,
            {
                hp: number;
                status: string;
                position: number[];
                lastAttackTime: number;
                isAttackingBase?: boolean;
            }
        >
    >(new Map());
    const unitsRef = useRef<ActiveUnit[]>([]);
    const obstacleEntities = useRef<YUKA.GameEntity[]>([]);

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

    // --- DAMAGE AGGREGATION SYSTEM ---
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

    const addDamageText = useCallback(
        (
            value: number,
            position: [number, number, number],
            color: string = "#FF0000",
        ) => {
            setDamageTexts((prev) =>
                [
                    ...prev,
                    {
                        id: Math.random().toString(36).substring(7),
                        value,
                        position: [...position] as [number, number, number],
                        timestamp: Date.now(),
                        color,
                        isCritical: value > 100,
                    },
                ].slice(-20),
            );
        },
        [],
    );

    // Flush Accumulated Damage to UI
    const flushDamageBuffer = useCallback(
        (now: number) => {
            damageBufferRef.current.forEach((data, targetId) => {
                if (now - data.lastHit > 300) {
                    // Flush every 300ms of silence
                    addDamageText(data.total, data.position, data.color);
                    damageBufferRef.current.delete(targetId);
                }
            });
        },
        [addDamageText],
    );

    const accumulateDamage = (
        targetId: string,
        value: number,
        position: number[],
        color: string,
    ) => {
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

    const resetBattle = useCallback(() => {
        vehicles.current.forEach((v) => entityManager.remove(v));
        vehicles.current.clear();
        unitRegistry.current.clear();
        
        playerBaseHpRef.current = towerConfig.baseHp;
        enemyBaseHpRef.current = towerConfig.baseHp;
        gameStateRef.current = "PLAYING";
        
        useStore.getState().resetStore(towerConfig);
        
        setActiveUnits([]);
        unitsRef.current = [];
        setDamageTexts([]);
        
        statsRef.current = { 
            damageDealt: {}, 
            playerDamage: {},
            enemyDamage: {},
            unitsSpawned: {}, 
            playerHits: {}, 
            enemyHits: {} 
        };
    }, [towerConfig.baseHp, entityManager]);

    const lastTickRef = useRef<number>(Date.now());

    const spawnUnit = useCallback(
        (
            level: number = 1,
            userName: string = "Guest",
            type: "player" | "enemy" = "player",
            isBoss: boolean = false,
        ) => {
            const isTestingBot =
                userName === towerConfig.player.name ||
                userName === towerConfig.enemy.name;
            if (
                !isBoss &&
                !isTestingBot &&
                (statsRef.current.unitsSpawned[userName] || 0) >= 3
            )
                return;

            setActiveUnits((prev) => {
                const teamUnits = prev.filter(
                    (u) => u.type === type && !u.isDying,
                );
                if (!isBoss && teamUnits.length >= towerConfig.maxUnits)
                    return prev;

                const spawnCounter = (teamUnits.length + 1) % 10;
                const laneOffset = (spawnCounter - 4.5) * 2.0;

                statsRef.current.unitsSpawned[userName] =
                    (statsRef.current.unitsSpawned[userName] || 0) + 1;
                const stats = getUnitStats(level, towerConfig.unitConfig);
                const speedVariation = 0.8 + Math.random() * 0.4;
                const actualSpeed = stats.speed * speedVariation;

                if (isBoss) {
                    stats.hp *= 10;
                    stats.maxHp *= 10;
                    stats.attack *= 5;
                    stats.speed *= 0.5;
                    stats.range *= 1.5;
                }

                const unitId = `${type}-${Math.random().toString(36).substring(2, 9)}`;
                const jitterX = (Math.random() - 0.5) * 4.0;
                const jitterZ = (Math.random() - 0.5) * 4.0;
                const spawnPos = [
                    laneOffset + jitterX,
                    -0.4,
                    (type === "player" ? 22 : -22) + jitterZ,
                ] as [number, number, number];

                const vehicle = new YUKA.Vehicle();
                vehicle.position.set(spawnPos[0], spawnPos[1], spawnPos[2]);
                vehicle.maxSpeed = actualSpeed;
                vehicle.updateOrientation = false;
                vehicle.boundingRadius = isBoss ? 3.5 : 0.8;

                const obstacleAvoidance = new YUKA.ObstacleAvoidanceBehavior(
                    obstacleEntities.current,
                );
                obstacleAvoidance.weight = 3.0;
                vehicle.steering.add(obstacleAvoidance);

                const seek = new YUKA.SeekBehavior(
                    new YUKA.Vector3(
                        0,
                        -0.4,
                        type === "player" ? ENEMY_BASE_Z : PLAYER_BASE_Z,
                    ),
                );
                seek.weight = 2.5;
                vehicle.steering.add(seek);

                entityManager.add(vehicle);
                vehicles.current.set(unitId, vehicle);
                unitRegistry.current.set(unitId, {
                    hp: stats.hp,
                    status: "marching",
                    position: spawnPos,
                    lastAttackTime: 0,
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
                };

                unitsRef.current.push(newUnit);
                return [...prev, newUnit];
            });
        },
        [
            towerConfig.maxUnits,
            towerConfig.unitConfig,
            entityManager,
            ENEMY_BASE_Z,
            PLAYER_BASE_Z,
        ],
    );

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

    const perfRef = useRef({ drawCalls: 0, triangles: 0, drift: 0 });

    const syncPerformance = useCallback((data: { drawCalls: number, triangles: number, drift: number }) => {
        perfRef.current = data;
    }, []);

    useEffect(() => {
        const loop = setInterval(() => {
            if (gameStateRef.current !== "PLAYING") return;

            const now = Date.now();
            const delta = (now - lastTickRef.current) / 1000;
            lastTickRef.current = now;

            // --- DIAGNOSTIC: PERFORMANCE BENCHMARKING ---
            const startTime = performance.now();

            entityManager.update(delta);
            flushDamageBuffer(now);

            // RECORD PERFORMANCE SNAPSHOT (Every 1s)
            if (now - lastLogTimeRef.current > 1000) {
                const simulationUnits = unitsRef.current;
                const pCount = simulationUnits.filter(u => u.type === "player" && !u.isDying).length;
                const eCount = simulationUnits.filter(u => u.type === "enemy" && !u.isDying).length;

                replayBufferRef.current.push({
                    t: now,
                    fps: Math.round(1 / delta),
                    stats: {
                        p: pCount,
                        e: eCount,
                        tot: simulationUnits.length,
                        vfx: damageTexts.length,
                        aiMs: (performance.now() - startTime).toFixed(2),
                        // Newly added Deep Metrics
                        drawCalls: perfRef.current.drawCalls,
                        tri: Math.round(perfRef.current.triangles / 1000), // kTri
                        drift: perfRef.current.drift.toFixed(1)
                    },
                    u: simulationUnits.map(u => ({
                        id: u.id,
                        p: unitRegistry.current.get(u.id)?.position,
                        s: unitRegistry.current.get(u.id)?.status,
                        hp: u.hp
                    }))
                });
                if (replayBufferRef.current.length > 61)
                    replayBufferRef.current.shift();
                lastLogTimeRef.current = now;
                setUpdateTick(prev => prev + 1); // Trigger UI Refresh for charts
            }

            if (Math.random() > 0.8) {
                setDamageTexts((dTexts) =>
                    dTexts.length === 0
                        ? dTexts
                        : dTexts.filter((t) => now - t.timestamp < 1000),
                );
            }

            const simulationUnits = unitsRef.current;
            const pUnits = simulationUnits.filter(
                (u) => u.type === "player" && !u.isDying,
            );
            const eUnits = simulationUnits.filter(
                (u) => u.type === "enemy" && !u.isDying,
            );

            let stateChanged = false;
            frameParityRef.current = (frameParityRef.current + 1) % 3;

            // --- PASS 1: Movement & AI Actions (Optimized with Staggering) ---
            for (let i = 0; i < simulationUnits.length; i++) {
                const u = simulationUnits[i];
                if (u.isDying) continue;

                const uData = unitRegistry.current.get(u.id);
                if (!uData) continue;

                if (u.hp <= 0) {
                    u.isDying = true;
                    u.deathTime = now;
                    stateChanged = true;
                    continue;
                }

                if (i % 2 !== frameParityRef.current && !u.isBoss) {
                    const vehicle = vehicles.current.get(u.id);
                    if (vehicle) {
                        uData.position[0] = vehicle.position.x;
                        uData.position[2] = vehicle.position.z;
                    }
                    continue;
                }

                let currentTarget: ActiveUnit | null = null;
                let isAttackingTarget = false;

                const distToBaseSq = Math.pow(
                    uData.position[2] -
                        (u.type === "player" ? ENEMY_BASE_Z : PLAYER_BASE_Z),
                    2,
                );
                const attackRangeSq = u.range * u.range;

                if (distToBaseSq < attackRangeSq) {
                    uData.status = "attacking";
                    uData.isAttackingBase = true; // MARK AS THREAT
                    isAttackingTarget = true;
                    if (now - uData.lastAttackTime > 1100) {
                        const damage = u.attack;
                        if (u.type === "player") {
                            enemyBaseHpRef.current = Math.max(0, enemyBaseHpRef.current - damage);
                            if (enemyBaseHpRef.current === 0 && gameStateRef.current === "PLAYING") {
                                addKillEvent(u.userName, towerConfig.enemy.name, "base");
                            }
                            useStore.getState().setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
                            
                            accumulateDamage(
                                "enemy-base",
                                damage,
                                [0, 5, ENEMY_BASE_Z],
                                towerConfig.player.color,
                            );
                        } else {
                            playerBaseHpRef.current = Math.max(0, playerBaseHpRef.current - damage);
                            if (playerBaseHpRef.current === 0 && gameStateRef.current === "PLAYING") {
                                addKillEvent(u.userName, towerConfig.player.name, "base");
                            }
                            useStore.getState().setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
                            
                            accumulateDamage(
                                "player-base",
                                damage,
                                [0, 5, PLAYER_BASE_Z],
                                towerConfig.enemy.color,
                            );
                        }
                        uData.lastAttackTime = now;
                        statsRef.current.damageDealt[u.userName] =
                            (statsRef.current.damageDealt[u.userName] || 0) +
                            damage;
                        
                        // TEAM-BASED LEADERBOARD Tracking
                        if (u.type === 'player') {
                            statsRef.current.playerDamage[u.userName] = (statsRef.current.playerDamage[u.userName] || 0) + damage;
                        } else {
                            statsRef.current.enemyDamage[u.userName] = (statsRef.current.enemyDamage[u.userName] || 0) + damage;
                        }

                        const hitMap = u.type === "player" ? statsRef.current.playerHits : statsRef.current.enemyHits;
                        hitMap[u.userName] = (hitMap[u.userName] || 0) + 1;
                    }
                }

                // RETARGETING & ATTACK LOGIC (Throttled Search)
                const shouldSearch = !isAttackingTarget || (frameParityRef.current % 45 === 0);

                if (shouldSearch) {
                    const targets = u.type === "player" ? eUnits : pUnits;
                    const searchLimit = Math.min(targets.length, 30);
                    let maxTargetScore = -Infinity;
                    let bestTarget = null;

                    for (let j = 0; j < searchLimit; j++) {
                        const target = targets[j];
                        const tData = unitRegistry.current.get(target.id);
                        if (!tData || target.hp <= 0) continue;
                        const dSq = Math.pow(uData.position[0] - tData.position[0], 2) + Math.pow(uData.position[2] - tData.position[2], 2);

                        let score = 100 / (dSq + 0.1); 
                        if (tData.isAttackingBase) score += 20000; // SUPREME PRIORITY

                        if (score > maxTargetScore) {
                            maxTargetScore = score;
                            bestTarget = target;
                        }
                    }
                    currentTarget = bestTarget;
                }

                if (currentTarget) {
                    const tData = unitRegistry.current.get(currentTarget.id);
                    if (tData) {
                        const dSq = Math.pow(uData.position[0] - tData.position[0], 2) + Math.pow(uData.position[2] - tData.position[2], 2);
                        const dynamicRangeSq = (u.range + (u.id.charCodeAt(0) % 5) * 0.1) ** 2;

                        if (dSq < dynamicRangeSq) {
                            uData.status = "attacking";
                            uData.isAttackingBase = false;
                            isAttackingTarget = true;
                            
                            if (now - uData.lastAttackTime > 1100) {
                                currentTarget.hp -= u.attack;
                                accumulateDamage(currentTarget.id, u.attack, tData.position as [number, number, number], u.type === "player" ? towerConfig.player.color : towerConfig.enemy.color);
                                uData.lastAttackTime = now;
                                
                                const damage = u.attack;
                                statsRef.current.damageDealt[u.userName] = (statsRef.current.damageDealt[u.userName] || 0) + damage;
                                if (u.type === 'player') {
                                    statsRef.current.playerDamage[u.userName] = (statsRef.current.playerDamage[u.userName] || 0) + damage;
                                    statsRef.current.playerHits[u.userName] = (statsRef.current.playerHits[u.userName] || 0) + 1;
                                } else {
                                    statsRef.current.enemyDamage[u.userName] = (statsRef.current.enemyDamage[u.userName] || 0) + damage;
                                    statsRef.current.enemyHits[u.userName] = (statsRef.current.enemyHits[u.userName] || 0) + 1;
                                }

                                if (currentTarget.hp <= 0) {
                                    addKillEvent(u.userName, currentTarget.userName, currentTarget.isBoss ? "boss" : "unit");
                                }
                            }
                        }
                    }
                }

                if (!isAttackingTarget) uData.status = "marching";

                const vehicle = vehicles.current.get(u.id);
                if (vehicle) {
                    const seek = vehicle.steering.behaviors.find(
                        (b) => b instanceof YUKA.SeekBehavior,
                    ) as YUKA.SeekBehavior;
                    if (seek) {
                        if (currentTarget) {
                            const tData = unitRegistry.current.get(
                                currentTarget.id,
                            );
                            if (tData) {
                                // Engage target but try to stay somewhat centered on your lane
                                seek.target.set(
                                    tData.position[0],
                                    0,
                                    tData.position[2],
                                );
                            }
                        } else {
                            // MARCHING: Stay in your assigned lane (X position) instead of converging to center!
                            // This is the key to spreading out the battle
                            const spawnLaneX = vehicle.position.x; // Simplified: Use current X as lane anchor if no target
                            seek.target.set(
                                spawnLaneX,
                                -0.4,
                                u.type === "player"
                                    ? ENEMY_BASE_Z
                                    : PLAYER_BASE_Z,
                            );
                        }
                    }
                    vehicle.maxSpeed =
                        uData.status === "attacking" ? 0 : u.speed;
                    uData.position[0] = vehicle.position.x;
                    uData.position[2] = vehicle.position.z;
                }
            }

            // --- PASS 2: Collision (Optimized Lane-based Spatial Check) ---
            const laneSize = 2.5; 
            for (let i = 0; i < simulationUnits.length; i++) {
                const uA = simulationUnits[i];
                if (uA.isDying) continue;
                const uDataA = unitRegistry.current.get(uA.id);
                if (!uDataA) continue;

                for (let j = i + 1; j < simulationUnits.length; j++) {
                    const uB = simulationUnits[j];
                    if (uB.isDying || uA.type !== uB.type) continue; // Only process same-team repulsion to save 50% checks
                    
                    const uDataB = unitRegistry.current.get(uB.id);
                    if (!uDataB) continue;

                    // Quick Lane Skip
                    if (Math.abs(uDataA.position[0] - uDataB.position[0]) > laneSize) continue;
                    // Vertical distance check (before SQRT)
                    const dz = uDataA.position[2] - uDataB.position[2];
                    if (Math.abs(dz) > laneSize) continue;

                    const dx = uDataA.position[0] - uDataB.position[0];
                    const distSq = dx * dx + dz * dz;
                    const rA = uA.isBoss ? 2.5 : 0.85;
                    const rB = uB.isBoss ? 2.5 : 0.85;
                    const minDist = rA + rB;

                    if (distSq < minDist * minDist) {
                        const dist = Math.sqrt(distSq) || 0.001;
                        const overlap = (minDist - dist) * 0.5;
                        const pushX = (dx / dist) * overlap;
                        const pushZ = (dz / dist) * overlap;

                        uDataA.position[0] += pushX;
                        uDataA.position[2] += pushZ;
                        uDataB.position[0] -= pushX;
                        uDataB.position[2] -= pushZ;

                        const vA = vehicles.current.get(uA.id);
                        const vB = vehicles.current.get(uB.id);
                        if (vA) { vA.position.x = uDataA.position[0]; vA.position.z = uDataA.position[2]; }
                        if (vB) { vB.position.x = uDataB.position[0]; vB.position.z = uDataB.position[2]; }
                    }
                }
            }

            const filtered = simulationUnits.filter((u) => {
                const keep =
                    !u.isDying || (u.deathTime && now - u.deathTime < 1500);
                if (!keep) {
                    const v = vehicles.current.get(u.id);
                    if (v) entityManager.remove(v);
                    vehicles.current.delete(u.id);
                    unitRegistry.current.delete(u.id);
                }
                return keep;
            });

            // Throttle UI update to every 3 simulation ticks
            const shouldForceUpdate = filtered.length !== simulationUnits.length || stateChanged;
            if (shouldForceUpdate || (frameParityRef.current % 3 === 0)) {
                unitsRef.current = filtered;
                setActiveUnits([...filtered]);

                // Sync damage stats to store for real-time leaderboard (Throttled every 12 ticks ~0.2s)
                if (frameParityRef.current % 12 === 0) {
                    useStore.getState().setLiveStats({ 
                        damageDealt: { ...statsRef.current.damageDealt },
                        playerDamage: { ...statsRef.current.playerDamage },
                        enemyDamage: { ...statsRef.current.enemyDamage }
                    });
                }

                // --- IMMEDIATE VICTORY/DEFEAT CHECK ---
                if (gameStateRef.current === "PLAYING") {
                    if (playerBaseHpRef.current <= 0) {
                        gameStateRef.current = "LOST";
                        useStore.getState().setGameState("LOST");
                    } else if (enemyBaseHpRef.current <= 0) {
                        gameStateRef.current = "WON";
                        useStore.getState().setGameState("WON");
                    }
                }
            }
        }, 16); 
        return () => {
            clearInterval(loop);
            vehicles.current.forEach((v) => entityManager.remove(v));
        };
    }, [
        towerConfig,
        addKillEvent,
        addDamageText,
        entityManager,
        ENEMY_BASE_Z,
        PLAYER_BASE_Z,
    ]);

    useEffect(() => {
        // ALWAYS Sync army counts to store safely (Setup, Playing, etc.)
        const pCount = activeUnits.filter(u => u.type === 'player' && !u.isDying).length;
        const eCount = activeUnits.filter(u => u.type === 'enemy' && !u.isDying).length;
        useStore.getState().setArmyCounts(pCount, eCount);
    }, [activeUnits.length]);

    const getMVPData = useCallback(() => {
        const dDealer = Object.entries(statsRef.current.damageDealt).sort(
            ([, a]: [any, any], [, b]: [any, any]) => b - a,
        )[0];
        const tSpawner = Object.entries(statsRef.current.unitsSpawned).sort(
            ([, a]: [any, any], [, b]: [any, any]) => b - a,
        )[0];
        const pTopHitter = Object.entries(statsRef.current.playerHits).sort(
            ([, a]: [any, any], [, b]: [any, any]) => b - a,
        )[0];
        const eTopHitter = Object.entries(statsRef.current.enemyHits).sort(
            ([, a]: [any, any], [, b]: [any, any]) => b - a,
        )[0];

        return {
            topDamage: dDealer ? { username: dDealer[0], value: dDealer[1] } : null,
            topSpawner: tSpawner ? { username: tSpawner[0], value: tSpawner[1] } : null,
            playerTopHit: pTopHitter ? { username: pTopHitter[0], value: pTopHitter[1] } : null,
            enemyTopHit: eTopHitter ? { username: eTopHitter[0], value: eTopHitter[1] } : null,
        };
    }, []);

    return {
        activeUnits,
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
        unitRegistry,
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
    };
};
