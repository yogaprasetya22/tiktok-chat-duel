// ============================================================
// BATTLE SYSTEM - MAIN HOOK (Controller)
// ============================================================
// Orchestrates the simulation loop and exposes the public API.
// Optimized for Zero-Allocation & High-Performance.
// ============================================================

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import * as YUKA from "yuka";
import { useStore } from "@/src/state/useStore";

// --- Zero-Allocation Scratch Objects ---
const _scratchCol = new THREE.Color();
const _white = new THREE.Color("#ffffff");
import {
    createWorld,
    defineComponent,
    Types,
    addEntity,
    addComponent,
} from "bitecs";
import {
    RARITY_WEIGHTS,
    RARITY_BONUS_MATRIX,
    applyClassSpecialization,
} from "../../core/logic/battle/combatSpecs";
import {
    calculateProcessedDamage,
    applySustain,
} from "../../core/logic/battle/combatProcessor";
import {
    UnitRarity,
    ActiveUnit,
    UnitRuntimeData,
    ClassKey,
    TowerConfig,
    BattleStats,
    KillEvent,
    MapObstacle,
    SimulationSettings,
} from "../../core/domain/unit.types";
export type { TowerConfig };

import {
    LANE_OFFSETS,
    INITIAL_SETTINGS,
    CLASS_CONFIG,
    CORPSE_DESPAWN_MS,
    WEATHER_CONFIG,
} from "@/src/core/logic/combat/constants";

import {
    getUnitStats,
    pickRandom,
    pickWeightedRandom,
} from "@/src/core/logic/combat/battleUtils";

import { WORLD_UNIT_POOL_SIZE } from "@/src/core/domain/unit.types";
import { battleGrid } from "@/src/core/logic/combat/spatialGrid";

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
        profileImages: {},
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
            rarity: "common",
        })),
    );
    const mmSpellsRef = useRef<any[]>(
        Array.from({ length: 800 }, () => ({
            fromX: 0,
            fromY: 1,
            fromZ: 0,
            toX: 0,
            toY: 1,
            toZ: 0,
            progress: 0,
            startTime: 0,
            active: false,
            rarity: "common",
        })),
    );
    const fighterSpellsRef = useRef<any[]>(
        Array.from({ length: 200 }, () => ({
            x: 0,
            y: 0,
            z: 0,
            targetX: 0,
            targetZ: 0,
            rotation: 0,
            progress: 0,
            startTime: 0,
            active: false,
            color: "#ffffff",
            rarity: "common",
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
            rarity: "common",
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
            rarity: "common",
        })),
    );

    const simulationTimeRef = useRef<number>(0);
    const physicsAccumulatorRef = useRef(0);
    const lastStateUpdate = useRef<number>(0); // --- BITECS ECS ARCHITECTURE ---

    const world = useMemo(() => createWorld(), []);
    const frameCountRef = useRef(0);
    const Position = useMemo(
        () => defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 }),
        [],
    );
    const Health = useMemo(
        () => defineComponent({ current: Types.f32, max: Types.f32 }),
        [],
    );
    const Status = useMemo(
        () =>
            defineComponent({
                type: Types.ui8,
                classIdx: Types.ui8,
                state: Types.ui8,
                active: Types.ui8,
                isBuffed: Types.ui8,
            }),
        [],
    ); // Entity mapping for pool management

    const eidMap = useRef<number[]>(new Array(WORLD_UNIT_POOL_SIZE).fill(-1)); // Ref pointers to raw bitecs arrays for tight loop access

    const _px = Position.x;
    const _py = Position.y;
    const _pz = Position.z;
    const _vh = Health.current;
    const _vmh = Health.max;
    const _vActive = Status.active;
    const _vType = Status.type;
    const _vState = Status.state; // --- ZERO-ALLOCATION OBJECT POOL ---

    const unitPoolRef = useRef<ActiveUnit[]>([]);
    const unitDataPoolRef = useRef<UnitRuntimeData[]>([]);
    const vehiclePoolRef = useRef<YUKA.Vehicle[]>([]);
    const activeIndicesRef = useRef<number[]>([]);
    const activeSetRef = useRef<Set<number>>(new Set()); // O(1) companion for .has() checks
    const availablePoolIndicesRef = useRef<number[]>(Array.from({ length: 1500 }, (_, i) => i)); // O(1) free slot pool
    const playerUnitCountRef = useRef(0);
    const enemyUnitCountRef = useRef(0);
    const lastMvpTimeRef = useRef(0);
    const cachedMvpRef = useRef<any>(null); // --- OPTIMIZATION: Spell Pool Pointers ---

    const mageSpellPtr = useRef(0);
    const mmSpellPtr = useRef(0);
    const fighterSpellPtr = useRef(0);
    const tankSpellPtr = useRef(0);
    const assassinSpellPtr = useRef(0);

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
            v.maxForce = 10; // Cap steering force to prevent "snapping"
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
        // FIX: Cap buffer size to prevent unbounded growth during intense combat
        if (damageBufferRef.current.size > 200) {
            const toDelete: string[] = [];
            for (const [targetId, data] of damageBufferRef.current) {
                toDelete.push(targetId);
                if (damageQueueRef.current.length < 500) {
                    damageQueueRef.current.push({
                        value: Math.round(data.total),
                        position: data.position,
                        isCrit: data.total > 150,
                        color: data.color,
                        timestamp: now,
                    });
                }
            }
            for (let d = 0; d < toDelete.length; d++) damageBufferRef.current.delete(toDelete[d]);
            return;
        }
        const toFlush: string[] = [];
        for (const [targetId, data] of damageBufferRef.current) {
            if (now - data.lastHit > 150) {
                toFlush.push(targetId);
                if (damageQueueRef.current.length < 500) {
                    damageQueueRef.current.push({
                        value: Math.round(data.total),
                        position: data.position,
                        isCrit: data.total > 150,
                        color: data.color,
                        timestamp: now,
                    });
                }
            }
        }
        for (let d = 0; d < toFlush.length; d++) damageBufferRef.current.delete(toFlush[d]);
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
        baseHp: 100000,
        baseDistance: 40,
        maxUnits: 80, // Optimized from 100
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
            profileImage?: string,
        ) => {
            useStore.getState().addKillEvent({
                id: Math.random().toString(36).substring(7),
                killer,
                victim,
                victimType,
                timestamp: Date.now(),
                profileImage,
            });
        },
        [],
    );

    const updateStats = useCallback(
        (
            userName: string,
            type: "player" | "enemy",
            dmg: number,
            isKill: boolean = false,
        ) => {
            const stats = statsRef.current;
            if (type === "player") {
                stats.playerDamage[userName] =
                    (stats.playerDamage[userName] || 0) + dmg;
                if (isKill)
                    stats.playerKills[userName] =
                        (stats.playerKills[userName] || 0) + 1;
                if (dmg > 0)
                    stats.playerHits[userName] =
                        (stats.playerHits[userName] || 0) + 1;
            } else {
                stats.enemyDamage[userName] =
                    (stats.enemyDamage[userName] || 0) + dmg;
                if (isKill)
                    stats.enemyKills[userName] =
                        (stats.enemyKills[userName] || 0) + 1;
                if (dmg > 0)
                    stats.enemyHits[userName] =
                        (stats.enemyHits[userName] || 0) + 1;
            }
        },
        [],
    );

    const resetBattle = useCallback(() => {
        gameStateRef.current = "PLAYING";
        playerBaseHpRef.current = towerConfigRef.current.baseHp;
        enemyBaseHpRef.current = towerConfigRef.current.baseHp;
        useStore.getState().setGameState("PLAYING");
        useStore.getState().resetStore(towerConfigRef.current); // Clear internal simulation stats

        statsRef.current = {
            damageDealt: {},
            playerDamage: {},
            enemyDamage: {},
            playerKills: {},
            enemyKills: {},
            unitsSpawned: {},
            playerHits: {},
            enemyHits: {},
            profileImages: statsRef.current.profileImages, // Preserve textures
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
        };

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
        activeIndicesRef.current = [];
        activeSetRef.current.clear();
        availablePoolIndicesRef.current = Array.from({ length: WORLD_UNIT_POOL_SIZE }, (_, i) => i);
        playerUnitCountRef.current = 0;
        enemyUnitCountRef.current = 0;
    }, [entityManager]);

    const spawnUnit = useCallback(
        (
            level: number = 1,
            userName: string = "Guest",
            type: "player" | "enemy" = "player",
            isBoss: boolean = false,
            forcedClass?: any,
            profileImage?: string,
        ) => {
            // --- 1. CAPACITY CHECK (Sync with UI Settings) ---
            const maxUnitsPerSide =
                towerConfigRef.current.maxUnits ||
                settingsRef.current.maxUnits ||
                20;

            const sideCount = type === "player" ? playerUnitCountRef.current : enemyUnitCountRef.current;
            if (sideCount >= maxUnitsPerSide) return;

            if (availablePoolIndicesRef.current.length === 0) return;
            const poolIdx = availablePoolIndicesRef.current.shift()!; // O(1) retrieval

            const name = userName.trim().substring(0, 16);
            const unitClass =
                forcedClass ||
                pickWeightedRandom(
                    ["fighter", "tank", "assassin", "marksman", "mage"],
                    [35, 35, 7, 11, 12],
                ); // --- MODULAR GACHA SYSTEM ---

            const rarity = pickWeightedRandom(
                ["common", "elite", "epic", "legendary"],
                [
                    RARITY_WEIGHTS.common,
                    RARITY_WEIGHTS.elite,
                    RARITY_WEIGHTS.epic,
                    RARITY_WEIGHTS.legendary,
                ],
            ) as UnitRarity;

            const rarityBonus = RARITY_BONUS_MATRIX[rarity];

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
            u.poolIdx = poolIdx;
            u.type = type;
            u.userName = name;
            u.unitClass = unitClass;
            u.rarity = rarity; // --- MODULAR STAT SCALING ---

            u.hp = stats.hp * c.hp;
            u.attack = stats.attack * c.atk; // Apply specialized scaling from modular logic

            applyClassSpecialization(
                u,
                unitClass as ClassKey,
                rarityBonus,
                c,
                settingsRef.current,
            );

            u.maxHp = u.hp;
            u.range = c.range;
            u.speed =
                stats.speed *
                c.move_speed_mult *
                (1 + rarityBonus.as * 0.2) *
                (0.9 + Math.random() * 0.2);
            u.isDying = false;
            u.isBoss = isBoss;
            u.isShield = false;
            u.cooldownReduction = c.cooldown_reduction || 0;
            u.hpRegen = c.hp_regen;
            u.targetId = undefined;
            u.lastThinkTime = 0;
            u.attackCooldown =
                (settingsRef.current.globalAttackCooldown || 800) /
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
            v.maxForce = unitClass === "assassin" ? 20 : 10; // Reduced from 100/30 to prevent zipping
            v.velocity.set(0, 0, 0);
            v.steering.behaviors.length = 0;

            const targetZ = type === "player" ? -dist : dist;
            v.steering.add(
                new YUKA.SeekBehavior(
                    new YUKA.Vector3(laneOffset, -0.4, targetZ),
                ),
            );

            entityManager.add(v);

            uData.isActive = true;
            uData.id = u.id;
            uData.poolIdx = poolIdx;
            uData.type = type;
            uData.userName = name;
            uData.hp = u.hp;
            uData.maxHp = u.maxHp;
            uData.position = [v.position.x, -0.4, v.position.z];
            uData.rotation = [0, 0, 0];
            uData.unitClass = unitClass;
            uData.isBoss = isBoss;
            uData.spawnTime = simulationTimeRef.current;
            uData.status = "marching";
            uData.isDying = false;
            uData.range = u.range;
            uData.speed = u.speed;
            uData.profileImage = profileImage;
            uData.rarity = rarity;
            uData.laneOffset = laneOffset;
            uData.jitterOffset = Math.random() * Math.PI * 2;
            uData.encirclementRadius =
                (c.ai_behavior?.encirclement || 1.2) * 1.25;
            uData.lastSkillTime = unitClass === "marksman" ? -30000 : 0; // Ready immediately
            uData.lastAttackTime = 0;
            uData.isBuffed = false;
            uData.isRolling = false;
            uData.isShield = unitClass === "tank";
            if (uData.isShield) {
                u.isShield = true;
                (uData as any).shieldEndTime = simulationTimeRef.current + 5000;
            }
            uData.pendingCrit = false;
            uData.laneSwaggerAmp = c.ai_behavior?.swagger || 0.3;

            if (profileImage) {
                statsRef.current.profileImages[name] = profileImage;
            }
            statsRef.current.unitsSpawned[name] =
                (statsRef.current.unitsSpawned[name] || 0) + 1;

            let eid = eidMap.current[poolIdx];
            if (eid === -1) {
                eid = addEntity(world);
                addComponent(world, Position, eid);
                addComponent(world, Health, eid);
                addComponent(world, Status, eid);
                eidMap.current[poolIdx] = eid;
            }

            _px[poolIdx] = v.position.x;
            _py[poolIdx] = -0.4;
            _pz[poolIdx] = v.position.z;
            _vh[poolIdx] = u.hp;
            _vmh[poolIdx] = u.maxHp;
            _vType[poolIdx] = type === "player" ? 0 : 1;
            _vActive[poolIdx] = 1;
            _vState[poolIdx] = 1;

            // FIX: O(1) check instead of O(n) .includes()
            if (!activeSetRef.current.has(poolIdx)) {
                activeIndicesRef.current.push(poolIdx);
                activeSetRef.current.add(poolIdx);
            }

            unitIndexRef.current.set(u.id, u);
            if (type === "player") playerUnitCountRef.current++;
            else enemyUnitCountRef.current++;
        },
        [entityManager],
    );

    const freezeTimeRef = useRef(0);

    const updateSimulation = useCallback(
        (delta: number) => {
            frameCountRef.current++;
            const now = performance.now();

            if (freezeTimeRef.current > 0) {
                freezeTimeRef.current -= delta * 1000;
                return;
            }

            const simDelta = delta * (settingsRef.current.timeScale || 1.0);
            simulationTimeRef.current += simDelta * 1000;
            const simNow = simulationTimeRef.current;
            const settings = settingsRef.current;
            const weather = useStore.getState().weather;
            const weatherCfg = (WEATHER_CONFIG as any)[weather] || {};
            const weatherMults = weatherCfg.multipliers || {};

            // FIX: Use activeIndicesRef.length instead of scanning all 1500 slots every frame
            const activeCount = activeIndicesRef.current.length;
            if (activeCount === 0 && gameStateRef.current !== "PLAYING") return; // OPTIMIZATION: Reduce grid update frequency to once every 5 frames (was 2).
            // This reclaim CPU time for VFX while maintaining accurate targeting.

            if (frameCountRef.current % 5 === 0) {
                battleGrid.update(
                    unitDataPoolRef.current,
                    activeIndicesRef.current,
                );
            }

            const PHYSICS_STEP = 0.016;
            physicsAccumulatorRef.current += simDelta;

            if (physicsAccumulatorRef.current > 0.2) {
                physicsAccumulatorRef.current = 0.2;
            }

            // FIX: Cap physics to 1 step/frame max — YUKA EntityManager.update is O(n) vehicles
            // 3 steps * 1500 vehicles = crushing CPU. 1 step is plenty for smooth movement.
            if (physicsAccumulatorRef.current >= PHYSICS_STEP) {
                entityManager.update(PHYSICS_STEP);
                physicsAccumulatorRef.current -= PHYSICS_STEP;
                // Discard excess to prevent spiral of death
                if (physicsAccumulatorRef.current > PHYSICS_STEP) {
                    physicsAccumulatorRef.current = 0;
                }
            }
            flushDamageBuffer(now);

            const eids = eidMap.current;
            const activeStates = _vActive;
            const uPool = unitPoolRef.current;
            const uiPool = unitDataPoolRef.current;
            const vPool = vehiclePoolRef.current;
            const activeIdxArray = activeIndicesRef.current;

            // FIX: Zero-allocation in-place compaction instead of .filter() which creates new array
            if (frameCountRef.current % 30 === 0) {
                let writeIdx = 0;
                activeSetRef.current.clear(); // Rebuild set
                for (let ri = 0; ri < activeIdxArray.length; ri++) {
                    if (uPool[activeIdxArray[ri]].isActive) {
                        activeIdxArray[writeIdx] = activeIdxArray[ri];
                        activeSetRef.current.add(activeIdxArray[writeIdx]);
                        writeIdx++;
                    }
                }
                activeIdxArray.length = writeIdx;
            }

            for (let k = 0; k < activeIdxArray.length; k++) {
                const i = activeIdxArray[k];
                const eid = eids[i];
                if (eid === -1 || !activeStates[i]) continue;

                const u = uPool[i];
                const uData = uiPool[i];
                const v = vPool[i]; // PRIMARY DEATH CHECK: use eid-indexed buffer for instant cleanup
                if (_vh[i] <= 0) {
                    if (!u.isDying) {
                        u.isDying = true;
                        u.deathTime = simNow;
                        uData.isDying = true;
                        v.maxSpeed = 0;
                        v.velocity.set(0, 0, 0);
                        v.steering.behaviors.length = 0;
                        entityManager.remove(v); // CRITICAL: Remove from YUKA simulation
                        if (u.isBoss) {
                            freezeTimeRef.current = 200;
                        }
                    }

                    if (simNow - (u.deathTime || 0) > CORPSE_DESPAWN_MS) {
                        uData.position[1] = -100;
                        _py[i] = -100;
                        _vActive[i] = 0;
                        u.isActive = false;
                        uData.isActive = false;
                        unitIndexRef.current.delete(u.id);
                        activeSetRef.current.delete(i);
                        if (u.type === "player") playerUnitCountRef.current--;
                        else enemyUnitCountRef.current--;
                        availablePoolIndicesRef.current.push(i); // Return to pool
                    }
                    continue;
                } // PERFORMANCE: Spread 'Thinking' logic across 16 frames instead of 8.
                // This reduces the per-frame cost of spatial queries by 50% in high-density combat.

                const thinkThrottle =
                    u.unitClass === "fighter"
                        ? 120
                        : u.unitClass === "assassin"
                          ? 60
                          : 180;
                const phaseOffset = i % 16;
                const frameCheck =
                    (Math.floor(simNow / 16) + phaseOffset) % 16 === 0;

                if (
                    frameCheck &&
                    (!u.lastThinkTime ||
                        simNow - u.lastThinkTime > thinkThrottle)
                ) {
                    u.lastThinkTime = simNow;
                    const isFighter = u.unitClass === "fighter";
                    const isAssassin = u.unitClass === "assassin";

                    let bestScore = -1;
                    let bestTargetId: string | undefined = undefined;

                    const dist = towerConfigRef.current.baseDistance ?? 34;
                    const targetBaseZ = u.type === "player" ? -dist : dist;
                    const dxB = uData.position[0];
                    const dzB = uData.position[2] - targetBaseZ;
                    const distToBaseSq = dxB * dxB + dzB * dzB;

                    const towerWeight = 0.01;
                    bestScore = towerWeight / (distToBaseSq + 0.1);
                    const targetedBaseId =
                        u.type === "player" ? "enemy-base" : "player-base";

                    const neighbors = battleGrid.queryRadius(
                        uData.position[0],
                        uData.position[2],
                        isFighter || isAssassin ? 32 : 12,
                    );
                    for (let j = 0; j < neighbors.length; j++) {
                        const potential = neighbors[j];
                        if (potential.id === u.id) continue;
                        if (potential.type === u.type) continue;
                        if (potential.hp <= 0 || potential.isDying) continue;

                        const dx = _px[i] - potential.position[0];
                        const dz = _pz[i] - potential.position[2];
                        const dSq = dx * dx + dz * dz;

                        let weight = 1.0;
                        if (isAssassin) {
                            if (
                                potential.unitClass === "mage" ||
                                potential.unitClass === "marksman"
                            ) {
                                weight = 15.0;
                            } else {
                                weight = 0.05;
                            }
                        } else if (isFighter) {
                            weight = 3.0;
                        } else if (potential.isBoss) {
                            weight = 2.0;
                        }

                        const score = weight / (dSq + 0.1);
                        if (score > bestScore) {
                            bestScore = score;
                            bestTargetId = potential.id;
                        }
                    }

                    if (bestTargetId !== undefined) {
                        u.targetId = bestTargetId;
                        uData.status = "chasing";
                    } else {
                        u.targetId = targetedBaseId;
                        uData.status = "marching";
                    }
                }

                const simFrame = Math.floor(simNow * 60); // PERFORMANCE: Spread collision/separation logic over 12 frames instead of 6.
                const moveCheck = (simFrame + i) % 12 === 0;

                if (moveCheck && !u.isDying) {
                    const sepWeight = 0.5;
                    const neighbors = battleGrid.queryRadius(
                        _px[i],
                        _pz[i],
                        1.2,
                    );
                    for (let j = 0; j < neighbors.length; j++) {
                        const potential = neighbors[j];
                        if (potential.id === u.id) continue;

                        const dx = _px[i] - potential.position[0];
                        const dz = _pz[i] - potential.position[2];
                        const dSq = dx * dx + dz * dz;

                        if (dSq < 1.0 && dSq > 0.001) {
                            const d = Math.sqrt(dSq);
                            v.velocity.x += (dx / d) * sepWeight;
                            v.velocity.z += (dz / d) * sepWeight;
                        }
                    }
                }

                const dist = towerConfigRef.current.baseDistance ?? 24;
                const targetBaseZ = u.type === "player" ? -dist : dist;
                const isBaseTarget =
                    u.targetId === "player-base" || u.targetId === "enemy-base";

                const isRanged =
                    u.unitClass === "mage" || u.unitClass === "marksman"; // --- Skill/Buff Range Adjustment ---

                const skillRange = uData.isBuffed ? u.range * 1.5 : u.range;
                const rangeMult = isBaseTarget && isRanged ? 0.82 : 1.0;
                const effectiveRange = skillRange * rangeMult;
                const rangeSq = effectiveRange * effectiveRange;

                const dxB = _px[i];
                const dzB = _pz[i] - targetBaseZ;
                const distToBaseSq = dxB * dxB + dzB * dzB;
                const baseInRange = distToBaseSq < rangeSq;

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

                const tIdx = currentTarget ? currentTarget.poolIdx : -1;
                const tData =
                    tIdx >= 0 ? unitDataPoolRef.current[tIdx] : undefined; // ============================================================
                // ACTIVE SKILL SYSTEM (INNOVATION)
                // ============================================================

                const cfg = CLASS_CONFIG[u.unitClass];
                const cooldown = cfg.skill_cooldown * (1 - u.cooldownReduction);
                const skillReady =
                    !uData.lastSkillTime ||
                    simNow - uData.lastSkillTime > cooldown;

                if (skillReady && !u.isDying) {
                    // 1. FIGHTER: Cyclone Slash (AOE around self)
                    if (u.unitClass === "fighter") {
                        const neighbors = battleGrid.queryRadius(
                            _px[i],
                            _pz[i],
                            cfg.skill_range,
                        );
                        let enemyCount = 0;
                        for (let n = 0; n < neighbors.length; n++) {
                            if (
                                neighbors[n].type !== u.type &&
                                !neighbors[n].isDying
                            )
                                enemyCount++;
                        }

                        if (enemyCount >= 1) {
                            uData.lastSkillTime = simNow;
                            const pool = fighterSpellsRef.current;
                            if (pool) {
                                const s = pool[fighterSpellPtr.current];
                                s.active = true;
                                s.x = _px[i];
                                s.z = _pz[i];
                                s.startTime = simNow;
                                s.color =
                                    u.type === "player" ? "#ffd700" : "#ff4400";
                                s.rarity = u.rarity;
                                (s as any).isCyclone = true;
                                (s as any)._tIdx = undefined;
                                fighterSpellPtr.current =
                                    (fighterSpellPtr.current + 1) % pool.length;
                            }
                            for (let n = 0; n < neighbors.length; n++) {
                                const tar = neighbors[n];
                                if (tar.type !== u.type && !tar.isDying) {
                                    const tnIdx = tar.poolIdx;
                                    const dmg = u.attack * 2.5;
                                    if (tnIdx >= 0) {
                                        const tarUnit =
                                            unitIndexRef.current.get(tar.id);
                                        if (tarUnit && tarUnit.isShield) {
                                            accumulateDamage(
                                                tar.id,
                                                0,
                                                tar.position,
                                                "#FFFFFF",
                                            );
                                        } else {
                                            _vh[tnIdx] -= dmg;
                                            accumulateDamage(
                                                tar.id,
                                                dmg,
                                                tar.position,
                                                "#fff",
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    } else if (
                        u.unitClass === "mage" &&
                        (currentTarget || baseInRange)
                    ) {
                        // 2. MAGE: Meteor Rain (Targeted AOE)
                        uData.lastSkillTime = simNow;
                        const pool = spellsRef.current;
                        if (pool) {
                            const tx = currentTarget
                                ? tData!.position[0]
                                : u.type === "player"
                                  ? 0
                                  : 0;
                            const tz = currentTarget
                                ? tData!.position[2]
                                : targetBaseZ;
                            const shardCount = 5; // PERF: Reduced from 12 — still visually impactful

                            for (let m = 0; m < shardCount; m++) {
                                const s = pool[mageSpellPtr.current];
                                s.active = true; // Rhythmic Staggering: Shards fall in waves

                                const waveIndex = Math.floor(m / 5);
                                s.startTime =
                                    simNow +
                                    waveIndex * 300 +
                                    Math.random() * 400; // High-altitude source

                                s.fromX = tx + (Math.random() - 0.5) * 10;
                                s.fromY = 25 + Math.random() * 15;
                                s.fromZ = tz + (Math.random() - 0.5) * 10; // Precise landing with slight spread

                                s.toX = tx + (Math.random() - 0.5) * 7;
                                s.toY = 0;
                                s.toZ = tz + (Math.random() - 0.5) * 7; // Team-Based Icy Colors

                                const teamBaseCol =
                                    u.type === "player"
                                        ? towerConfigRef.current.player.color
                                        : towerConfigRef.current.enemy.color;

                                // PERFORMANCE: Reuse scratch color objects instead of creating new ones in a loop
                                _scratchCol.set(teamBaseCol);
                                if (Math.random() > 0.4) {
                                    _scratchCol.lerp(_white, 0.4);
                                }
                                s.color = _scratchCol.getStyle();

                                s.rarity = u.rarity;
                                s.isMeteor = true;
                                (s as any).attackPower = u.attack;
                                (s as any).ownerType = u.type;
                                (s as any).iceDmgMult = 2.0; // Buffed damage for refactored ult
                                s.isBullet = false;
                                (s as any).isTeleport = false;
                                (s as any)._tIdx = undefined;

                                mageSpellPtr.current =
                                    (mageSpellPtr.current + 1) % pool.length;
                            }
                        }
                    } else if (u.unitClass === "mage" && baseInRange) {
                        // 2.2 MAGE: Base Attack Enhancement (Tower)
                        // Logic already handles tower attacks below
                    } else if (u.unitClass === "marksman") {
                        // 3. MARKSMAN: Triple Threat Precision (Sniper Burst Initialization)
                        // Pick target (priority: CLOSEST in range for better accuracy)
                        const targets = battleGrid.queryRadius(
                            _px[i],
                            _pz[i],
                            cfg.skill_range,
                        );
                        let bestTarget = null;
                        let minDSq = Infinity;
                        for (let t = 0; t < targets.length; t++) {
                            const tar = targets[t];
                            const dx = _px[i] - tar.position[0];
                            const dz = _pz[i] - tar.position[2];
                            const dSq = dx * dx + dz * dz;
                            if (
                                tar.type !== u.type &&
                                !tar.isDying &&
                                dSq < minDSq
                            ) {
                                minDSq = dSq;
                                bestTarget = tar;
                            }
                        }

                        if (bestTarget) {
                            uData.lastSkillTime = simNow;
                            uData.isBuffed = true;
                            u.isBuffed = true;
                            u.targetId = bestTarget.id;
                            uData.targetId = bestTarget.id;
                            (uData as any).sniperCount = 0;
                            (uData as any).lastSniperTime = 0;
                            (uData as any).sniperChargeDone = false; // buffEndTime set panjang agar tidak memotong rangkaian 5 tembakan
                            (uData as any).buffEndTime = simNow + 8000;
                            (uData as any).sniperTargetId = bestTarget.id;
                            (uData as any).sniperTargetPoolIdx =
                                bestTarget.poolIdx;
                        }
                    } else if (u.unitClass === "tank" && u.hp < u.maxHp * 0.6) {
                        // 4. TANK: Fortress Guard (Shield)
                        uData.lastSkillTime = simNow;
                        u.isShield = true;
                        uData.isShield = true;
                        (uData as any).shieldEndTime = simNow + 3500;
                        const pool = tankSpellsRef.current;
                        if (pool) {
                            const s = pool[tankSpellPtr.current];
                            s.active = true;
                            s.x = _px[i];
                            s.z = _pz[i];
                            s.startTime = simNow;
                            s.rarity = u.rarity;
                            (s as any).isShield = true;
                            tankSpellPtr.current =
                                (tankSpellPtr.current + 1) % pool.length;
                        }
                    } else if (u.unitClass === "assassin") {
                        // 5. ASSASSIN: Shadow Step (Teleport to Squishy)
                        const targets = battleGrid.queryRadius(
                            _px[i],
                            _pz[i],
                            cfg.skill_range,
                        );
                        let bestTarget = null;
                        let minHp = Infinity;

                        for (let tj = 0; tj < targets.length; tj++) {
                            const t = targets[tj];
                            if (
                                t.type !== u.type &&
                                (t.unitClass === "mage" ||
                                    t.unitClass === "marksman") &&
                                !t.isDying
                            ) {
                                if (t.hp < minHp) {
                                    minHp = t.hp;
                                    bestTarget = t;
                                }
                            }
                        }

                        if (bestTarget) {
                            const targetU = unitIndexRef.current.get(
                                bestTarget.id,
                            );
                            if (targetU) {
                                uData.lastSkillTime = simNow;

                                const pool = assassinSpellsRef.current;
                                if (pool) {
                                    const s = pool[assassinSpellPtr.current];
                                    s.active = true;
                                    s.x = _px[i];
                                    s.y = 0.5;
                                    s.z = _pz[i];
                                    s.startTime = simNow;
                                    s.rarity = u.rarity;
                                    (s as any).isTeleport = true;
                                    assassinSpellPtr.current =
                                        (assassinSpellPtr.current + 1) %
                                        pool.length;
                                }

                                const tx =
                                    bestTarget.position[0] +
                                    (Math.random() - 0.5) * 0.5;
                                const tz =
                                    bestTarget.position[2] +
                                    (u.type === "player" ? 1.5 : -1.5);

                                v.position.set(tx, -0.4, tz);
                                _px[i] = tx;
                                _pz[i] = tz;
                                uData.position[0] = tx;
                                uData.position[2] = tz;
                                u.targetId = bestTarget.id;

                                if (pool) {
                                    const s = pool[assassinSpellPtr.current];
                                    s.active = true;
                                    s.x = tx;
                                    s.y = 0.5;
                                    s.z = tz;
                                    s.startTime = simNow + 50;
                                    s.rarity = u.rarity;
                                    (s as any).isTeleport = true;
                                    assassinSpellPtr.current =
                                        (assassinSpellPtr.current + 1) %
                                        pool.length;
                                }

                                u.untargetableUntil = simNow + 400;
                                u.isCriticalReady = true;
                                uData.status = "attacking";
                            }
                        }
                    }
                } // --- ACTIVE SKILL UPDATES (Post-Initiation) ---

                if (
                    uData.isBuffed &&
                    u.unitClass === "marksman" &&
                    !u.isDying
                ) {
                    uData.status = "attacking";
                    u.isBuffed = true;
                    const sCount = (uData as any).sniperCount || 0;
                    const lastS = (uData as any).lastSniperTime || 0;
                    const delay = sCount === 4 ? 1500 : 800; // Increased delay from 1000/500

                    if (simNow - lastS > delay && sCount < 5) {
                        (uData as any).sniperCount = sCount + 1;
                        (uData as any).lastSniperTime = simNow;
                        uData.lastAttackTime = simNow;

                        const targetPoolIdx = (uData as any)
                            .sniperTargetPoolIdx;
                        const targetData =
                            targetPoolIdx !== undefined && targetPoolIdx >= 0
                                ? unitDataPoolRef.current[targetPoolIdx]
                                : null; // Update target jika masih aktif, atau cari target baru

                        let tPos: [number, number, number] | null = null;
                        let tId = (uData as any).sniperTargetId;
                        if (
                            targetData &&
                            targetData.isActive &&
                            !targetData.isDying &&
                            targetData.id === tId
                        ) {
                            tPos = targetData.position as [
                                number,
                                number,
                                number,
                            ];
                        } else {
                            // Target mati, cari target baru terdekat
                            const newTargets = battleGrid.queryRadius(
                                _px[i],
                                _pz[i],
                                60,
                            );
                            for (let t2 = 0; t2 < newTargets.length; t2++) {
                                const nt = newTargets[t2];
                                if (
                                    nt.type !== u.type &&
                                    nt.isActive &&
                                    !nt.isDying
                                ) {
                                    tId = nt.id;
                                    u.targetId = nt.id;
                                    uData.targetId = nt.id;
                                    (uData as any).sniperTargetId = nt.id;
                                    (uData as any).sniperTargetPoolIdx =
                                        nt.poolIdx;
                                    const ntData =
                                        unitDataPoolRef.current[nt.poolIdx];
                                    if (ntData)
                                        tPos = ntData.position as [
                                            number,
                                            number,
                                            number,
                                        ];
                                    break;
                                }
                            }
                        }

                        if (tPos) {
                            const tPoolIdx = (uData as any).sniperTargetPoolIdx; // Lead Shooting (Predictive Aiming)

                            let txP = tPos[0];
                            let tzP = tPos[2];
                            const tVeh =
                                tPoolIdx !== undefined
                                    ? vehiclePoolRef.current[tPoolIdx]
                                    : null;
                            const bSpeed = 55.0; // Sniper speed
                            if (tVeh && tVeh.velocity.squaredLength() > 0.05) {
                                const dist = Math.sqrt(
                                    (_px[i] - txP) ** 2 + (_pz[i] - tzP) ** 2,
                                );
                                const tHit = dist / bSpeed;
                                txP += tVeh.velocity.x * tHit;
                                tzP += tVeh.velocity.z * tHit;
                            }

                            const pool = mmSpellsRef.current;
                            const color =
                                u.type === "player"
                                    ? towerConfigRef.current.player.color
                                    : towerConfigRef.current.enemy.color;
                            const s = pool[mmSpellPtr.current];
                            s.active = true;
                            s.startTime = simNow;
                            s.fromX = _px[i];
                            s.fromY = 1.2;
                            s.fromZ = _pz[i];
                            s.toX = txP;
                            s.toY = tPos[1] + 1.2;
                            s.toZ = tzP;
                            s.color = color;
                            s.rarity = u.rarity;
                            s.isBullet = true;
                            (s as any).isSniper = true;
                            (s as any).targetId = tId;
                            (s as any).targetPoolIdx = tPoolIdx;
                            (s as any).isFinisher = sCount + 1 === 5;
                            (s as any).sniperSpeed = 55.0; // Snappier sniper
                            (s as any)._tIdx = undefined;
                            mmSpellPtr.current =
                                (mmSpellPtr.current + 1) % pool.length;

                            if (tPoolIdx !== undefined && tPoolIdx >= 0) {
                                const targetUnit =
                                    unitIndexRef.current.get(tId);
                                const targetData =
                                    unitDataPoolRef.current[tPoolIdx];
                                if (targetUnit && targetUnit.isShield) {
                                    // IMMUNE — do NOT show damage number for clean UI
                                } else if (targetUnit && targetData) {
                                    // Balanced: 1.8x normal, 5.0x finisher
                                    const dmg =
                                        u.attack *
                                        (sCount + 1 === 5 ? 5.0 : 1.8); // Sync _vh, u.hp, uData.hp all at once
                                    const newHp = Math.max(
                                        0,
                                        _vh[tPoolIdx] - dmg,
                                    );
                                    _vh[tPoolIdx] = newHp;
                                    targetUnit.hp = newHp;
                                    targetData.hp = newHp;
                                    accumulateDamage(tId, dmg, tPos, color);
                                }
                            }
                        }
                    }

                    if (sCount >= 5 && simNow - lastS > 1200) {
                        uData.isBuffed = false;
                        u.isBuffed = false;
                        (uData as any).sniperCount = 0;
                    }
                }

                if (
                    uData.isBuffed &&
                    simNow > ((uData as any).buffEndTime || 0)
                ) {
                    uData.isBuffed = false;
                    u.isBuffed = false; // CRITICAL SYNC
                }
                if (
                    uData.isRolling &&
                    simNow > ((uData as any).rollEndTime || 0)
                )
                    uData.isRolling = false;
                if (
                    uData.isShield &&
                    simNow > ((uData as any).shieldEndTime || 0)
                ) {
                    uData.isShield = false;
                    u.isShield = false;
                }

                if (currentTarget && tData) {
                    const dxT = _px[i] - tData.position[0];
                    const dzT = _pz[i] - tData.position[2];
                    const dSq = dxT * dxT + dzT * dzT;

                    if (dSq < rangeSq) {
                        uData.status = "attacking";
                        v.maxSpeed = uData.isRolling ? u.speed * 4.0 : 0;
                        if (
                            simNow - (uData.lastAttackTime || 0) >
                            u.attackCooldown
                        ) {
                            const { dmg, isCrit } = calculateProcessedDamage(
                                u,
                                currentTarget,
                                !!uData.pendingCrit,
                            );
                            if (isCrit) uData.pendingCrit = false;

                            applySustain(u, uData, dmg, _vh, i);

                            if (u.unitClass === "mage") {
                                let hits = 0;
                                _vh[tIdx] -= dmg;
                                tData.hp = _vh[tIdx];
                                currentTarget.hp = _vh[tIdx];
                                if (_vh[tIdx] <= 0) {
                                    _vActive[tIdx] = 0;
                                    currentTarget.isActive = false;
                                    tData.isActive = false;
                                    tData.position[1] = -100;
                                    _py[tIdx] = -100;
                                    addKillEvent(
                                        u.userName,
                                        currentTarget.userName,
                                        "unit",
                                        u.profileImage,
                                    );
                                    updateStats(u.userName, u.type, 0, true);
                                }
                                updateStats(u.userName, u.type, dmg);
                                accumulateDamage(
                                    currentTarget.id,
                                    dmg,
                                    tData.position,
                                    isCrit
                                        ? "#FFDD00"
                                        : u.type === "player"
                                          ? "#0066FF"
                                          : "#FF0033",
                                );
                                hits++;

                                const searchRadius =
                                    u.unitClass === "mage" ? 3.5 : 2.5;
                                const neighbors = battleGrid.queryRadius(
                                    tData.position[0],
                                    tData.position[2],
                                    searchRadius,
                                );
                                for (let j = 0; j < neighbors.length; j++) {
                                    if (hits >= 4) break;
                                    const p = neighbors[j];
                                    if (
                                        p.id === currentTarget.id ||
                                        p.type === u.type ||
                                        p.isDying ||
                                        !p.isActive
                                    )
                                        continue;

                                    const dx =
                                        tData.position[0] - p.position[0];
                                    const dz =
                                        tData.position[2] - p.position[2];
                                    const dSq = dx * dx + dz * dz;

                                    if (dSq < searchRadius * searchRadius) {
                                        const pIdx = p.poolIdx;
                                        if (pIdx >= 0) {
                                            const pUnit =
                                                unitIndexRef.current.get(p.id);
                                            if (pUnit && pUnit.isShield) {
                                                // IMMUNE
                                                accumulateDamage(
                                                    p.id,
                                                    0,
                                                    p.position,
                                                    "#FFFFFF",
                                                );
                                            } else {
                                                _vh[pIdx] -= dmg;
                                                const pData =
                                                    unitDataPoolRef.current[
                                                        pIdx
                                                    ];
                                                if (pData && pUnit) {
                                                    pData.hp = _vh[pIdx];
                                                    pUnit.hp = _vh[pIdx];
                                                    if (_vh[pIdx] <= 0) {
                                                        _vActive[pIdx] = 0;
                                                        pUnit.isActive = false;
                                                        pData.isActive = false;
                                                        pData.position[1] =
                                                            -100;
                                                        _py[pIdx] = -100;
                                                        addKillEvent(
                                                            u.userName,
                                                            p.userName,
                                                            "unit",
                                                            u.profileImage,
                                                        );
                                                        updateStats(
                                                            u.userName,
                                                            u.type,
                                                            0,
                                                            true,
                                                        );
                                                    }
                                                    updateStats(
                                                        u.userName,
                                                        u.type,
                                                        dmg,
                                                    );
                                                    accumulateDamage(
                                                        p.id,
                                                        dmg,
                                                        pData.position,
                                                        u.type === "player"
                                                            ? "#0066FF"
                                                            : "#FF0033",
                                                    );
                                                    hits++;
                                                }
                                            }
                                        }
                                    }
                                }
                            } else if (
                                u.unitClass === "fighter" &&
                                (u.rarity === "epic" ||
                                    u.rarity === "legendary")
                            ) {
                                const cleavePerc =
                                    u.rarity === "legendary" ? 0.5 : 0.3;
                                _vh[tIdx] -= dmg;
                                tData.hp = _vh[tIdx];
                                currentTarget.hp = _vh[tIdx];
                                if (_vh[tIdx] <= 0) {
                                    _vActive[tIdx] = 0;
                                    currentTarget.isActive = false;
                                    tData.isActive = false;
                                    tData.position[1] = -100;
                                    _py[tIdx] = -100;
                                    addKillEvent(
                                        u.userName,
                                        currentTarget.userName,
                                        "unit",
                                        u.profileImage,
                                    );
                                    updateStats(u.userName, u.type, 0, true);
                                }
                                updateStats(u.userName, u.type, dmg);
                                accumulateDamage(
                                    currentTarget.id,
                                    dmg,
                                    tData.position,
                                    isCrit
                                        ? "#FFDD00"
                                        : u.type === "player"
                                          ? "#0066FF"
                                          : "#FF0033",
                                );

                                const cleaveNearby = battleGrid.queryRadius(
                                    tData.position[0],
                                    tData.position[2],
                                    2.0,
                                );
                                let cleaveCount = 0;
                                for (
                                    let cj = 0;
                                    cj < cleaveNearby.length && cleaveCount < 4;
                                    cj++
                                ) {
                                    const cp = cleaveNearby[cj];
                                    if (
                                        !cp.isActive ||
                                        cp.type === u.type ||
                                        cp.id === currentTarget!.id
                                    )
                                        continue;
                                    const cIdx = cp.poolIdx;
                                    if (cIdx >= 0) {
                                        const cpUnit = unitIndexRef.current.get(
                                            cp.id,
                                        );
                                        if (cpUnit && cpUnit.isShield) {
                                            // IMMUNE
                                            accumulateDamage(
                                                cp.id,
                                                0,
                                                cp.position,
                                                "#FFFFFF",
                                            );
                                        } else {
                                            const cDmg = dmg * cleavePerc;
                                            _vh[cIdx] -= cDmg;
                                            const cpData =
                                                unitDataPoolRef.current[cIdx];
                                            if (cpData && cpUnit) {
                                                cpData.hp = _vh[cIdx];
                                                cpUnit.hp = _vh[cIdx];
                                                if (_vh[cIdx] <= 0) {
                                                    _vActive[cIdx] = 0;
                                                    cpUnit.isActive = false;
                                                    cpData.isActive = false;
                                                    cpData.position[1] = -100;
                                                    _py[cIdx] = -100;
                                                    addKillEvent(
                                                        u.userName,
                                                        cp.userName,
                                                        "unit",
                                                        u.profileImage,
                                                    );
                                                    updateStats(
                                                        u.userName,
                                                        u.type,
                                                        0,
                                                        true,
                                                    );
                                                }
                                                updateStats(
                                                    u.userName,
                                                    u.type,
                                                    cDmg,
                                                );
                                                accumulateDamage(
                                                    cp.id,
                                                    cDmg,
                                                    cpData.position,
                                                    u.type === "player"
                                                        ? "#0066FF"
                                                        : "#FF0033",
                                                );
                                                cleaveCount++;
                                            }
                                        }
                                    }
                                }
                            } else {
                                _vh[tIdx] -= dmg;
                                tData.hp = _vh[tIdx];
                                currentTarget.hp = _vh[tIdx];
                                if (_vh[tIdx] <= 0) {
                                    _vActive[tIdx] = 0;
                                    currentTarget.isActive = false;
                                    tData.isActive = false;
                                    tData.position[1] = -100;
                                    _py[tIdx] = -100;
                                    addKillEvent(
                                        u.userName,
                                        currentTarget.userName,
                                        "unit",
                                        u.profileImage,
                                    );
                                    updateStats(u.userName, u.type, 0, true);
                                }
                                updateStats(u.userName, u.type, dmg);
                                accumulateDamage(
                                    currentTarget.id,
                                    dmg,
                                    tData.position,
                                    isCrit
                                        ? "#FFDD00"
                                        : u.type === "player"
                                          ? "#0066FF"
                                          : "#FF0033",
                                );
                            }
                            uData.lastAttackTime = simNow;

                            const teamColor =
                                u.type === "player"
                                    ? towerConfigRef.current.player.color
                                    : towerConfigRef.current.enemy.color;
                            const fwdX = Math.sin(uData.rotation[1] || 0);
                            const fwdZ = Math.cos(uData.rotation[1] || 0);
                            const launchY = uData.position[1] + 1.8;

                            switch (u.unitClass) {
                                case "fighter": {
                                    const pool = fighterSpellsRef.current;
                                    if (pool) {
                                        const s = pool[fighterSpellPtr.current];
                                        s.x = uData.position[0] + fwdX * 0.8;
                                        s.y = 1.2;
                                        s.z = uData.position[2] + fwdZ * 0.8;
                                        s.targetX = tData.position[0];
                                        s.targetZ = tData.position[2];
                                        s.rotation = uData.rotation[1] || 0;
                                        s.startTime = simNow;
                                        s.color = teamColor;
                                        s.active = true;
                                        s.progress = 0;
                                        s.rarity = u.rarity || "common";
                                        (s as any).isCyclone = false;
                                        (s as any)._tIdx = undefined;
                                        fighterSpellPtr.current =
                                            (fighterSpellPtr.current + 1) %
                                            pool.length;
                                    }
                                    break;
                                }
                                case "tank": {
                                    const pool = tankSpellsRef.current;
                                    if (pool) {
                                        const s = pool[tankSpellPtr.current];
                                        s.x = tData.position[0];
                                        s.y = 0.2;
                                        s.z = tData.position[2];
                                        s.startTime = simNow;
                                        s.color = teamColor;
                                        s.active = true;
                                        s.progress = 0;
                                        s.rarity = u.rarity || "common";
                                        s.isShield = false;
                                        tankSpellPtr.current =
                                            (tankSpellPtr.current + 1) %
                                            pool.length;
                                    }
                                    break;
                                }
                                case "mage": {
                                    const pool = spellsRef.current;
                                    if (pool) {
                                        const s = pool[mageSpellPtr.current];
                                        s.fromX = uData.position[0];
                                        s.fromY = launchY;
                                        s.fromZ = uData.position[2];
                                        s.toX = tData.position[0];
                                        s.toY = tData.position[1] + 1.0;
                                        s.toZ = tData.position[2];
                                        s.targetId = currentTarget.id;
                                        s.startTime = simNow;
                                        s.color = teamColor;
                                        s.active = true;
                                        s.progress = 0;
                                        s.rarity = u.rarity || "common";
                                        s.isMeteor = false;
                                        s.isBullet = false;
                                        (s as any)._tIdx = undefined;
                                        mageSpellPtr.current =
                                            (mageSpellPtr.current + 1) %
                                            pool.length;

                                        const aoeNearby =
                                            battleGrid.queryRadius(
                                                tData.position[0],
                                                tData.position[2],
                                                3.5,
                                            );
                                        let aoeCount = 0;
                                        for (
                                            let aj = 0;
                                            aj < aoeNearby.length &&
                                            aoeCount < 3;
                                            aj++
                                        ) {
                                            const ap = aoeNearby[aj];
                                            if (
                                                !ap.isActive ||
                                                ap.type === u.type ||
                                                ap.id === currentTarget.id
                                            )
                                                continue;
                                            const as =
                                                pool[mageSpellPtr.current];
                                            as.fromX = uData.position[0];
                                            as.fromY = launchY;
                                            as.fromZ = uData.position[2];
                                            as.toX = ap.position[0];
                                            as.toY = ap.position[1] + 1.0;
                                            as.toZ = ap.position[2];
                                            as.targetId = ap.id;
                                            as.startTime = simNow;
                                            as.color = teamColor;
                                            as.active = true;
                                            as.progress = 0;
                                            as.rarity = u.rarity || "common";
                                            as.isMeteor = false;
                                            as.isBullet = false;
                                            (as as any)._tIdx = undefined;
                                            mageSpellPtr.current =
                                                (mageSpellPtr.current + 1) %
                                                pool.length;
                                            aoeCount++;
                                        }
                                    }
                                    break;
                                }
                                case "marksman": {
                                    if (uData.isBuffed) break;
                                    const pool = mmSpellsRef.current;
                                    if (pool) {
                                        // Lead Shooting (Predictive Aiming)
                                        let txP = tData.position[0];
                                        let tzP = tData.position[2];
                                        const tVeh =
                                            tIdx !== undefined
                                                ? vehiclePoolRef.current[tIdx]
                                                : null;
                                        const bSpeed = 110.0; // Basic bullet speed
                                        if (
                                            tVeh &&
                                            tVeh.velocity.squaredLength() > 0.05
                                        ) {
                                            const dist = Math.sqrt(
                                                (uData.position[0] - txP) ** 2 +
                                                    (uData.position[2] - tzP) **
                                                        2,
                                            );
                                            const tHit = dist / bSpeed;
                                            txP += tVeh.velocity.x * tHit;
                                            tzP += tVeh.velocity.z * tHit;
                                        }

                                        const s = pool[mmSpellPtr.current];
                                        s.fromX =
                                            uData.position[0] + fwdX * 2.5;
                                        s.fromY = launchY;
                                        s.fromZ =
                                            uData.position[2] + fwdZ * 2.5;
                                        s.toX = txP;
                                        s.toY = tData.position[1] + 1.2;
                                        s.toZ = tzP;
                                        s.targetId = currentTarget!.id;
                                        (s as any).targetPoolIdx = tIdx;
                                        s.startTime = simNow;
                                        s.color = teamColor;
                                        s.active = true;
                                        s.progress = 0;
                                        s.isBullet = true;
                                        s.isMeteor = false;
                                        s.isCyclone = false;
                                        s.isShield = false;
                                        (s as any).isRolling = false;
                                        (s as any).isTeleport = false;
                                        s.rarity = u.rarity || "common";
                                        (s as any).bulletSpeed = bSpeed; // High velocity
                                        (s as any)._tIdx = undefined;
                                        mmSpellPtr.current =
                                            (mmSpellPtr.current + 1) %
                                            pool.length;
                                    }
                                    break;
                                }
                                case "assassin": {
                                    const pool = assassinSpellsRef.current;
                                    if (pool) {
                                        const s =
                                            pool[assassinSpellPtr.current];
                                        s.x = tData.position[0];
                                        s.y = 1.3;
                                        s.z = tData.position[2];
                                        s.startTime = simNow;
                                        s.color = teamColor;
                                        s.active = true;
                                        s.progress = 0;
                                        s.rarity = u.rarity || "common";
                                        assassinSpellPtr.current =
                                            (assassinSpellPtr.current + 1) %
                                            pool.length;
                                    }
                                    break;
                                }
                            }
                        }
                    } else if (u.targetId) {
                        if (!(uData.isBuffed && u.unitClass === "marksman"))
                            uData.status = "chasing";
                        const classWeatherMult =
                            weatherMults[u.unitClass]?.move_speed_mult || 1.0;
                        v.maxSpeed =
                            u.speed *
                            classWeatherMult *
                            (uData.isRolling
                                ? 4.0
                                : uData.isBuffed && u.unitClass === "marksman"
                                  ? 0
                                  : 1.0);
                        const seek = v.steering.behaviors[0] as any;
                        if (seek?.target && tData) {
                            if (u.unitClass === "mage") {
                                const ddx = _px[i] - tData.position[0];
                                const ddz = _pz[i] - tData.position[2];
                                if (ddx * ddx + ddz * ddz < 49) {
                                    const rDir = u.type === "player" ? 1 : -1;
                                    seek.target.set(
                                        _px[i] + ddx * 2,
                                        0,
                                        _pz[i] + ddz * 2 + rDir * 5,
                                    );
                                } else {
                                    seek.target.set(
                                        tData.position[0],
                                        0,
                                        tData.position[2],
                                    );
                                }
                            } else if (u.unitClass === "marksman") {
                                const angleHash =
                                    ((i * 2654435761) >>> 0) % 360;
                                const angle = angleHash * (Math.PI / 180);
                                const orbitR = uData.encirclementRadius || 1.25;
                                const ddx = _px[i] - tData.position[0];
                                const ddz = _pz[i] - tData.position[2];
                                if (ddx * ddx + ddz * ddz < 80 * 80) {
                                    seek.target.set(
                                        tData.position[0] +
                                            Math.cos(angle) * orbitR,
                                        0,
                                        tData.position[2] +
                                            Math.sin(angle) * orbitR,
                                    );
                                } else {
                                    seek.target.set(
                                        tData.position[0],
                                        0,
                                        tData.position[2],
                                    );
                                }
                            } else {
                                const offsetX = (((i * 127) % 7) - 3) * 0.25;
                                const offsetZ = (((i * 53) % 7) - 3) * 0.25;
                                seek.target.set(
                                    tData.position[0] + offsetX,
                                    0,
                                    tData.position[2] + offsetZ,
                                );
                            }
                        }
                    }
                } else if (baseInRange) {
                    uData.status = "attacking";
                    v.maxSpeed = 0;
                    if (
                        simNow - (uData.lastAttackTime || 0) >
                        u.attackCooldown
                    ) {
                        const dmg = u.attack;
                        updateStats(u.userName, u.type, dmg);
                        if (u.type === "player") {
                            enemyBaseHpRef.current -= dmg;
                            if (enemyBaseHpRef.current <= 0) {
                                addKillEvent(
                                    u.userName,
                                    "ENEMY BASE",
                                    "base",
                                    u.profileImage,
                                );
                                updateStats(u.userName, u.type, 0, true);
                                freezeTimeRef.current = 100;
                            }
                        } else {
                            playerBaseHpRef.current -= dmg;
                            if (playerBaseHpRef.current <= 0) {
                                addKillEvent(
                                    u.userName,
                                    "PLAYER BASE",
                                    "base",
                                    u.profileImage,
                                );
                                updateStats(u.userName, u.type, 0, true);
                                freezeTimeRef.current = 100;
                            }
                        }
                        accumulateDamage(
                            u.type === "player" ? "enemy-base" : "player-base",
                            dmg,
                            [0, 2, targetBaseZ],
                            u.type === "player" ? "#0066FF" : "#FF0033",
                        );

                        uData.lastAttackTime = simNow; // COMBAT EFFECTS FOR TOWER ATTACK

                        const teamColor =
                            u.type === "player"
                                ? towerConfigRef.current.player.color
                                : towerConfigRef.current.enemy.color;
                        const fwdX = Math.sin(uData.rotation[1] || 0);
                        const fwdZ = Math.cos(uData.rotation[1] || 0);
                        const launchY = uData.position[1] + 1.8;
                        const tPos = [0, 1.0, targetBaseZ]; // Tower target point

                        switch (u.unitClass) {
                            case "fighter": {
                                const pool = fighterSpellsRef.current;
                                if (pool) {
                                    const s = pool[fighterSpellPtr.current];
                                    s.x = uData.position[0] + fwdX * 0.8;
                                    s.y = 1.2;
                                    s.z = uData.position[2] + fwdZ * 0.8;
                                    s.targetX = tPos[0];
                                    s.targetZ = tPos[2];
                                    s.rotation = uData.rotation[1] || 0;
                                    s.startTime = simNow;
                                    s.color = teamColor;
                                    s.active = true;
                                    s.progress = 0;
                                    (s as any).isCyclone = false;
                                    (s as any)._tIdx = undefined;
                                    fighterSpellPtr.current =
                                        (fighterSpellPtr.current + 1) %
                                        pool.length;
                                }
                                break;
                            }
                            case "tank": {
                                const pool = tankSpellsRef.current;
                                if (pool) {
                                    const s = pool[tankSpellPtr.current];
                                    s.x = tPos[0];
                                    s.y = 0.2;
                                    s.z = tPos[2];
                                    s.startTime = simNow;
                                    s.color = teamColor;
                                    s.active = true;
                                    s.progress = 0;
                                    s.isShield = false;
                                    tankSpellPtr.current =
                                        (tankSpellPtr.current + 1) %
                                        pool.length;
                                }
                                break;
                            }
                            case "mage": {
                                const pool = spellsRef.current;
                                if (pool) {
                                    for (let m = 0; m < 3; m++) {
                                        const s = pool[mageSpellPtr.current];
                                        s.fromX = uData.position[0];
                                        s.fromY = launchY;
                                        s.fromZ = uData.position[2];
                                        s.toX = tPos[0];
                                        s.toY = tPos[1] + 2.0;
                                        s.toZ = tPos[2];
                                        s.targetId =
                                            u.type === "player"
                                                ? "enemy-base"
                                                : "player-base";
                                        s.startTime = simNow;
                                        s.color = teamColor;
                                        s.active = true;
                                        s.progress = 0;
                                        mageSpellPtr.current =
                                            (mageSpellPtr.current + 1) %
                                            pool.length;
                                    }
                                }
                                break;
                            }
                            case "marksman": {
                                if (uData.isBuffed) break; // DON'T FIRE BASIC ATTACK IN SNIPER MODE
                                const pool = mmSpellsRef.current;
                                if (pool) {
                                    const s = pool[mmSpellPtr.current];
                                    s.fromX = uData.position[0] + fwdX * 2.5;
                                    s.fromY = launchY;
                                    s.fromZ = uData.position[2] + fwdZ * 2.5;
                                    s.toX = tPos[0];
                                    s.toY = tPos[1] + 2.0;
                                    s.toZ = tPos[2];
                                    s.targetId =
                                        u.type === "player"
                                            ? "enemy-base"
                                            : "player-base";
                                    s.startTime = simNow;
                                    s.color = teamColor;
                                    s.active = true;
                                    s.progress = 0;
                                    s.isBullet = true;
                                    (s as any).isSniper = false; // RECYCLE
                                    (s as any).isFinisher = false;
                                    mmSpellPtr.current =
                                        (mmSpellPtr.current + 1) % pool.length;
                                }
                                break;
                            }
                            case "assassin": {
                                const pool = assassinSpellsRef.current;
                                if (pool) {
                                    const s = pool[assassinSpellPtr.current];
                                    s.x = tPos[0];
                                    s.y = 1.3;
                                    s.z = tPos[2];
                                    s.startTime = simNow;
                                    s.color = "#FFFF00";
                                    s.active = true;
                                    s.progress = 0;
                                    assassinSpellPtr.current =
                                        (assassinSpellPtr.current + 1) %
                                        pool.length;
                                }
                                break;
                            }
                        }
                    }
                } else {
                    if (!(uData.isBuffed && u.unitClass === "marksman"))
                        uData.status = "marching";
                    const classWeatherMult =
                        weatherMults[u.unitClass]?.move_speed_mult || 1.0;
                    const globalWeatherMult =
                        weatherMults.globalSpeedMultiplier || 1.0;
                    const baseSpeed =
                        u.speed *
                        (settings.globalSpeedMultiplier || 1.0) *
                        classWeatherMult *
                        globalWeatherMult;

                    v.maxSpeed = baseSpeed * (uData.isRolling ? 4.0 : 1.0);
                    const seek = v.steering.behaviors[0] as any;
                    if (seek?.target) {
                        const swagger =
                            Math.sin(i * 8.0 + (uData.jitterOffset || 0)) *
                            (uData.laneSwaggerAmp || 1.5);
                        seek.target.set(swagger, 0, targetBaseZ);
                    }
                }

                {
                    const rotSmooth = settings.rotationSmoothing || 0.12;
                    const velSq = v.velocity.x ** 2 + v.velocity.z ** 2;
                    if (
                        (uData.status === "marching" ||
                            uData.status === "chasing") &&
                        velSq > 0.05
                    ) {
                        const targetRot = Math.atan2(
                            v.velocity.x,
                            v.velocity.z,
                        );
                        let diff = targetRot - uData.rotation[1];
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        while (diff > Math.PI) diff -= Math.PI * 2;
                        uData.rotation[1] +=
                            diff * Math.min(rotSmooth * 2, 1.0);
                    } else if (uData.status === "attacking") {
                        const tIdx2 = currentTarget
                            ? currentTarget.poolIdx
                            : -1;
                        const td2 = tIdx2 !== -1 ? uiPool[tIdx2] : null;
                        const tx2 =
                            td2 && td2.isActive && td2.id === u.targetId
                                ? td2.position[0]
                                : 0;
                        const tz2 =
                            td2 && td2.isActive && td2.id === u.targetId
                                ? td2.position[2]
                                : targetBaseZ;
                        const targetRot = Math.atan2(
                            tx2 - _px[i],
                            tz2 - _pz[i],
                        );
                        let diff = targetRot - uData.rotation[1];
                        while (diff < -Math.PI) diff += Math.PI * 2;
                        while (diff > Math.PI) diff -= Math.PI * 2;

                        const isSniper =
                            u.unitClass === "marksman" && uData.isBuffed;
                        const finalSmooth = isSniper ? 1.0 : rotSmooth;
                        uData.rotation[1] += diff * Math.min(finalSmooth, 1.0);
                    }
                }

                if (u.unitClass === "assassin" && u.targetId && !isBaseTarget) {
                    const blinkCooldownS = 4000;
                    const lastBlink = uData.lastBlinkTime || 0;

                    if (simNow - lastBlink > blinkCooldownS) {
                        const tIdx3 = currentTarget
                            ? currentTarget.poolIdx
                            : -1;
                        const td3 = tIdx3 !== -1 ? uiPool[tIdx3] : null;

                        if (
                            td3 &&
                            td3.isActive &&
                            td3.id === u.targetId &&
                            (td3.unitClass === "mage" ||
                                td3.unitClass === "marksman")
                        ) {
                            const ddx = _px[i] - td3.position[0];
                            const ddz = _pz[i] - td3.position[2];
                            const dSq2 = ddx * ddx + ddz * ddz;

                            if (dSq2 < 36 && dSq2 > 4) {
                                const targetForward =
                                    u.type === "player" ? -1.8 : 1.8;
                                const bx = td3.position[0];
                                const bz = td3.position[2] + targetForward;

                                v.position.set(bx, 0, bz);
                                _px[i] = bx;
                                _pz[i] = bz;
                                uData.position[0] = bx;
                                uData.position[2] = bz;

                                uData.lastBlinkTime = simNow;
                                uData.pendingCrit = true;
                                uData.status = "attacking";

                                const pool = assassinSpellsRef.current;
                                if (pool) {
                                    const s = pool[assassinSpellPtr.current];
                                    s.x = bx;
                                    s.y = 1.3;
                                    s.z = bz;
                                    s.startTime = simNow;
                                    s.color = "#ff00ff";
                                    s.active = true;
                                    s.progress = 0;
                                    assassinSpellPtr.current =
                                        (assassinSpellPtr.current + 1) %
                                        pool.length;
                                }
                            }
                        }
                    }
                }

                v.velocity.multiplyScalar(Math.pow(0.1, simDelta));

                if (
                    uData.status === "attacking" ||
                    u.isDying ||
                    (uData.isBuffed && u.unitClass === "marksman")
                ) {
                    v.velocity.set(0, 0, 0);
                    v.maxSpeed = 0;
                }

                const oldX = _px[i];
                const oldZ = _pz[i];
                const newX = v.position.x;
                const newZ = v.position.z;

                const dx = newX - oldX;
                const dz = newZ - oldZ;
                const moveDistSq = dx * dx + dz * dz;

                const maxStepDist = v.maxSpeed * simDelta * 1.2 + 0.02;
                const maxStepDistSq = maxStepDist * maxStepDist;

                if (moveDistSq > maxStepDistSq) {
                    const ratio = maxStepDist / Math.sqrt(moveDistSq);
                    _px[i] = oldX + dx * ratio;
                    _pz[i] = oldZ + dz * ratio;
                    v.position.set(_px[i], -0.4, _pz[i]);
                } else {
                    _px[i] = newX;
                    _pz[i] = newZ;
                }

                uData.position[0] = _px[i];
                uData.position[2] = _pz[i];
            } // --- SPELL IMPACT LOGIC (Mage Meteors) ---

            const sPool = spellsRef.current;
            for (let si = 0; si < sPool.length; si++) {
                const s = sPool[si];
                if (!s.active || !s.isMeteor) continue;

                const age = simNow - s.startTime;
                if (age >= 800) {
                    s.active = false;

                    const aoeRadius = 3.0; // Optimized for "Rain" density
                    const aoeTargets = battleGrid.queryRadius(
                        s.toX,
                        s.toZ,
                        aoeRadius,
                    );
                    const attackPower = (s as any).attackPower || 100;
                    const dmg = attackPower * ((s as any).iceDmgMult || 5.5); // Use ice mult or fallback

                    for (let ti = 0; ti < aoeTargets.length; ti++) {
                        const target = aoeTargets[ti];
                        if (target.type === (s as any).ownerType) continue;

                        const tIdx = target.poolIdx;
                        if (tIdx >= 0) {
                            const tUnit = unitIndexRef.current.get(target.id);
                            if (tUnit && tUnit.isShield) {
                                accumulateDamage(
                                    target.id,
                                    0,
                                    target.position,
                                    "#FFFFFF",
                                );
                            } else {
                                _vh[tIdx] -= dmg;
                                const td = unitDataPoolRef.current[tIdx];
                                if (td && tUnit) {
                                    td.hp = _vh[tIdx];
                                    tUnit.hp = _vh[tIdx]; // Visual feedback for impact
                                    accumulateDamage(
                                        target.id,
                                        dmg,
                                        target.position,
                                        s.color || "#FFDD00",
                                    );
                                }
                            }
                        }
                    }
                }
            }

            if (
                playerBaseHpRef.current <= 0 &&
                gameStateRef.current === "PLAYING"
            ) {
                gameStateRef.current = "LOST";
                setTowerConfig((prev) => ({
                    ...prev,
                    enemy: {
                        ...prev.enemy,
                        score: (prev.enemy.score || 0) + 1,
                    },
                }));
                const currentWins = useStore.getState().enemyWins;
                useStore
                    .getState()
                    .setWins(useStore.getState().playerWins, currentWins + 1);
                useStore.getState().setGameState("LOST"); // Auto-reset stats after 10 seconds of glory

                setTimeout(() => {
                    if (gameStateRef.current === "LOST" && useStore.getState().gameMode !== "TRAINING") {
                        resetBattle();
                    }
                }, 10000);
            }
            if (
                enemyBaseHpRef.current <= 0 &&
                gameStateRef.current === "PLAYING"
            ) {
                gameStateRef.current = "WON";
                setTowerConfig((prev) => ({
                    ...prev,
                    player: {
                        ...prev.player,
                        score: (prev.player.score || 0) + 1,
                    },
                }));
                const currentWins = useStore.getState().playerWins;
                useStore
                    .getState()
                    .setWins(currentWins + 1, useStore.getState().enemyWins);
                useStore.getState().setGameState("WON"); // Auto-reset stats after 10 seconds of glory

                setTimeout(() => {
                    if (gameStateRef.current === "WON" && useStore.getState().gameMode !== "TRAINING") {
                        resetBattle();
                    }
                }, 10000);
            }

            if (simNow - lastStateUpdate.current > 100) {
                lastStateUpdate.current = simNow;
                let pC = 0,
                    eC = 0;
                const activeIndices = activeIndicesRef.current;
                const uPool = unitPoolRef.current;
                for (let k = 0; k < activeIndices.length; k++) {
                    const i = activeIndices[k];
                    const u = uPool[i];
                    if (u.isActive && !u.isDying) {
                        if (u.type === "player") pC++;
                        else eC++;
                    }
                }
                useStore.getState().setArmyCounts(pC, eC);
                useStore
                    .getState()
                    .setBaseHp(playerBaseHpRef.current, enemyBaseHpRef.current);
                useStore.getState().setLiveStats({ ...statsRef.current });
            }
        },
        [entityManager, flushDamageBuffer, accumulateDamage, addKillEvent],
    );

    return {
        towerConfig,
        setTowerConfig,
        spawnUnit,
        resetBattle,
        getMVPData: () => {
            const now = performance.now();
            if (cachedMvpRef.current && now - lastMvpTimeRef.current < 1000) {
                return cachedMvpRef.current;
            }

            const stats = statsRef.current;
            const getMax = (record: Record<string, number>) => {
                let maxUser = "N/A";
                let maxValue = 0;
                Object.entries(record).forEach(([user, val]) => {
                    if (val > maxValue) {
                        maxValue = val;
                        maxUser = user;
                    }
                });
                return maxValue > 0
                    ? { username: maxUser, value: maxValue }
                    : null;
            };

            const allUsers = new Set([
                ...Object.keys(stats.playerKills),
                ...Object.keys(stats.enemyKills),
                ...Object.keys(stats.playerDamage),
                ...Object.keys(stats.enemyDamage),
            ]);

            const top5 = Array.from(allUsers)
                .map((username) => {
                    const kills =
                        (stats.playerKills[username] || 0) +
                        (stats.enemyKills[username] || 0);
                    const damage =
                        (stats.playerDamage[username] || 0) +
                        (stats.enemyDamage[username] || 0);
                    const spawns = stats.unitsSpawned[username] || 0;
                    return {
                        username,
                        kills,
                        damage,
                        spawns,
                        profileImage: stats.profileImages[username],
                    };
                })
                .sort((a, b) =>
                    b.kills !== a.kills
                        ? b.kills - a.kills
                        : b.damage - a.damage,
                )
                .slice(0, 5);

            const result = {
                topDamage: getMax({
                    ...stats.playerDamage,
                    ...stats.enemyDamage,
                }),
                topSpawner: getMax(stats.unitsSpawned),
                playerTopHit: getMax(stats.playerHits),
                enemyTopHit: getMax(stats.enemyHits),
                top5,
            };

            cachedMvpRef.current = result;
            lastMvpTimeRef.current = now;
            return result;
        },
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
            const activeIndices = activeIndicesRef.current;
            const uPool = unitPoolRef.current;
            const uiPool = unitDataPoolRef.current;
            for (let k = 0; k < activeIndices.length; k++) {
                const i = activeIndices[k];
                const u = uPool[i];
                if (u.isActive && u.type === side && !u.isDying) {
                    u.hp -= u.maxHp * 0.4;
                    uiPool[i].hp = u.hp;
                    accumulateDamage(
                        u.id,
                        u.maxHp * 0.4,
                        uiPool[i].position,
                        "#FFFFFF",
                    );
                }
            }
        },
        updateSimulation,
        damageQueue: damageQueueRef,
        settingsRef,
        simTimeRef: simulationTimeRef,
        compBuffers: {
            px: _px,
            py: _py,
            pz: _pz,
            vHealth: _vh,
            vMaxHealth: _vmh,
            vType: _vType,
            vActive: _vActive,
            eidMap: eidMap.current,
            activeIndices: activeIndicesRef,
        },
        downloadPerfLogs: () => {},
        clearVFXCache: () => {},
    };
};
