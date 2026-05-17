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
  SEAL_M_ENEMIES,
} from "@/src/core/logic/combat/constants";
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import { getGroundHeight } from "@/src/core/utils/globalRaycaster";

import {
  getUnitStats,
  pickRandom,
  pickWeightedRandom,
} from "@/src/core/logic/combat/battleUtils";

import { PlayerInput } from "@/src/components/game/systems/PlayerECS";

import { WORLD_UNIT_POOL_SIZE } from "@/src/core/domain/unit.types";
import { battleGrid } from "@/src/core/logic/combat/spatialGrid";

export const useBattleSystem = () => {
  const [mapObstacles, setMapObstacles] = useState<MapObstacle[]>([]);
  const [debug, setDebug] = useState(true);

  const playerBaseHpRef = useRef(1000);
  const enemyBaseHpRef = useRef(1000);
  const gameStateRef = useRef<"SETUP" | "PLAYING" | "WON" | "LOST">("SETUP");
  const lastPlayerBaseDamageTime = useRef(0);
  const lastEnemyBaseDamageTime = useRef(0);

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
  
  const killEventQueueRef = useRef<KillEvent[]>([]);
  const _killEventIdCounter = useRef(0); // Zero-alloc ID counter
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
  const lastLeaderboardUpdate = useRef(0);

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

  const spawnQueueRef = useRef<{level: number, userName: string, type: "player" | "enemy", isBoss: boolean, forcedClass?: any, profileImage?: string, forcedRarity?: UnitRarity, customPos?: [number, number, number]}[]>([]);
  const spawnQueueHeadRef = useRef(0); // O(1) queue head pointer — avoids O(N) shift()

  const unitPoolRef = useRef<ActiveUnit[]>([]);
  const unitDataPoolRef = useRef<UnitRuntimeData[]>([]);
  const vehiclePoolRef = useRef<YUKA.Vehicle[]>([]);
  const activeIndicesRef = useRef<number[]>([]);
  const activeIndicesSetRef = useRef<Set<number>>(new Set()); // O(1) lookup set
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
      for (let d = 0; d < toDelete.length; d++)
        damageBufferRef.current.delete(toDelete[d]);
      return;
    }
    const toFlush: string[] = [];
    for (const [targetId, data] of damageBufferRef.current) {
      // GHOST PROTECTION: If target is dead/dying, flush IMMEDIATELY
      const u = unitIndexRef.current.get(targetId);
      const isDead = !u || !u.isActive || u.isDying || u.hp <= 0;

      const age = now - (data as any).startTime;
      const idle = now - data.lastHit;

      if (idle > 100 || age > 250 || isDead) {
        toFlush.push(targetId);
        if (damageQueueRef.current.length < 500) {
          damageQueueRef.current.push({
            value: Math.round(data.total),
            position: [...data.position],
            isCrit: data.total > 150,
            color: data.color,
            timestamp: now,
          });
        }
      }
    }
    for (let d = 0; d < toFlush.length; d++)
      damageBufferRef.current.delete(toFlush[d]);
  }, []);

  const accumulateDamage = useCallback(
    (targetId: string | undefined, value: number, position: number[], color: string, now: number) => {
      if (!targetId) return;
      const existing = damageBufferRef.current.get(targetId);
      if (existing) {
        existing.total += value;
        // FIX: Update in-place — no new array allocation
        existing.position[0] = position[0];
        existing.position[1] = position[1];
        existing.position[2] = position[2];
        existing.lastHit = now;
      } else {
        // FIX: Allocate only when creating a new entry (unavoidable), but reuse pattern
        damageBufferRef.current.set(targetId, {
          total: value,
          position: [position[0], position[1] ?? 0, position[2]] as [number, number, number],
          lastHit: now,
          startTime: now,
          color,
        } as any);
      }
    },
    [],
  );

  const [towerConfig, setTowerConfig] = useState<TowerConfig>({
      player: {
          name: "Humans (Travelers)",
          color: "#0066FF",
          active: true,
          commentKeyword: "B",
          commentType: "contains",
          // 6 Gift 1-Koin khas penonton maskulin/umum
          giftBindings: [
              { keyword: "blow a kiss", formationId: "tier5_vanguard" },
              { keyword: "cake slice", formationId: "tier5_sorcery" },
              { keyword: "coffee", formationId: "tier5_sorcery" },
              { keyword: "congratulations", formationId: "tier5_vanguard" },
              { keyword: "freestyle", formationId: "tier5_vanguard" },
              { keyword: "gg", formationId: "tier5_artillery" },
              { keyword: "go popular", formationId: "tier5_vanguard" },
              { keyword: "heart", formationId: "tier5_vanguard" },
              { keyword: "ice cream cone", formationId: "tier5_sorcery" },
              { keyword: "milk tea", formationId: "tier5_sorcery" },
              { keyword: "nyota", formationId: "tier5_vanguard" },
              { keyword: "orange juice", formationId: "tier5_sorcery" },
              { keyword: "power hug", formationId: "tier5_vanguard" },
              { keyword: "sea shell", formationId: "tier5_vanguard" },
              { keyword: "thumbs up", formationId: "tier5_vanguard" },
              { keyword: "wink charm", formationId: "tier5_vanguard" },
              { keyword: "you re awesome", formationId: "tier5_vanguard" },
              { keyword: "duit raya", formationId: "tier5_vanguard" },
              { keyword: "name shoutout", formationId: "tier5_vanguard" },
              { keyword: "padang rice", formationId: "tier5_sorcery" },
              { keyword: "club power", formationId: "tier5_vanguard" },
              { keyword: "chocolate", formationId: "tier5_sorcery" },
              { keyword: "heart gaze", formationId: "tier5_vanguard" },
              { keyword: "journey pass", formationId: "tier5_vanguard" },
              { keyword: "lucky pony", formationId: "tier5_vanguard" },
              { keyword: "slow motion", formationId: "tier5_vanguard" },
              { keyword: "bravo", formationId: "tier5_vanguard" },
              { keyword: "bouquet flower", formationId: "tier5_vanguard" },
              { keyword: "life star", formationId: "tier5_artillery" },
              { keyword: "bubble gum", formationId: "tier5_sorcery" },
              { keyword: "charmer bow", formationId: "tier5_artillery" },
              { keyword: "cupid s bow", formationId: "tier5_artillery" },
              { keyword: "hat and mustache", formationId: "tier5_vanguard" },
              { keyword: "like pop", formationId: "tier5_vanguard" },
              { keyword: "love painting", formationId: "tier5_vanguard" },
              { keyword: "paper crane", formationId: "tier5_vanguard" },
              { keyword: "bouquet", formationId: "tier5_vanguard" },
              { keyword: "confetti", formationId: "tier5_vanguard" },
              { keyword: "hand hearts", formationId: "tier5_vanguard" },
              { keyword: "mishka bear", formationId: "tier5_berserkers" },
              { keyword: "singing magic", formationId: "tier5_sorcery" },
              { keyword: "balloon crown", formationId: "tier5_vanguard" },
              { keyword: "bowknot", formationId: "tier5_artillery" },
              { keyword: "catrina", formationId: "tier5_assassins" },
              { keyword: "feather tiara", formationId: "tier5_vanguard" },
              { keyword: "masquerade", formationId: "tier5_vanguard" },
              { keyword: "santa cocoa", formationId: "tier5_vanguard" },
              { keyword: "cheer for you", formationId: "tier5_vanguard" },
              { keyword: "chirpy kisses", formationId: "tier5_vanguard" },
              { keyword: "coffee magic", formationId: "tier5_sorcery" },
              { keyword: "floating octopus", formationId: "tier5_vanguard" },
              { keyword: "garland headpiece", formationId: "tier5_vanguard" },
              { keyword: "halo kiss", formationId: "tier5_vanguard" },
              { keyword: "hearts", formationId: "tier5_vanguard" },
              { keyword: "joker ball", formationId: "tier5_artillery" },
              { keyword: "league countdown", formationId: "tier5_vanguard" },
              { keyword: "massage for you", formationId: "tier5_vanguard" },
              { keyword: "party pony", formationId: "tier5_vanguard" },
              { keyword: "rose hand", formationId: "tier5_vanguard" },
              { keyword: "sour buddy", formationId: "tier5_vanguard" },
              { keyword: "sunglasses", formationId: "tier5_vanguard" },
              { keyword: "balloons", formationId: "tier5_artillery" },
              { keyword: "gold necklace", formationId: "tier5_vanguard" },
              { keyword: "rose bear", formationId: "tier5_vanguard" },
              { keyword: "cheer mic", formationId: "tier5_vanguard" },
              { keyword: "face pulling", formationId: "tier5_vanguard" },
              { keyword: "ice cream mic", formationId: "tier5_sorcery" },
              { keyword: "music bubbles", formationId: "tier5_vanguard" },
              { keyword: "party blossom", formationId: "tier5_vanguard" },
              { keyword: "snow bloom", formationId: "tier5_vanguard" },
              { keyword: "sweet flutter", formationId: "tier5_vanguard" },
              { keyword: "tiny diny float", formationId: "tier5_vanguard" },
              { keyword: "boxing gloves", formationId: "tier5_vanguard" },
              { keyword: "butterfly for you", formationId: "tier5_assassins" },
              { keyword: "eid gift box", formationId: "tier5_vanguard" },
              { keyword: "go hamster", formationId: "tier5_vanguard" },
              { keyword: "kicker challenge", formationId: "tier5_vanguard" },
              { keyword: "love call", formationId: "tier5_vanguard" },
              { keyword: "music mate", formationId: "tier5_vanguard" },
              { keyword: "pawfect", formationId: "tier5_vanguard" },
              { keyword: "play for you", formationId: "tier5_vanguard" },
              { keyword: "puppy kisses", formationId: "tier5_vanguard" },
              { keyword: "sax groove", formationId: "tier5_vanguard" },
              { keyword: "starlight compass", formationId: "tier5_artillery" },
              { keyword: "united heart", formationId: "tier5_vanguard" },
              { keyword: "air dancer", formationId: "tier5_vanguard" },
              { keyword: "feather mask", formationId: "tier5_vanguard" },
              { keyword: "batwing hat", formationId: "tier5_assassins" },
              { keyword: "become kitten", formationId: "tier5_vanguard" },
              { keyword: "festival bracelet", formationId: "tier5_vanguard" },
              { keyword: "juicy cap", formationId: "tier5_vanguard" },
              { keyword: "mystic drink", formationId: "tier5_vanguard" },
              { keyword: "sparkle pony", formationId: "tier5_vanguard" },
              { keyword: "vintage flight", formationId: "tier5_vanguard" },
              { keyword: "alien buddy", formationId: "tier5_vanguard" },
              { keyword: "cactus shuffle", formationId: "tier5_vanguard" },
              { keyword: "dreamy hat", formationId: "tier5_vanguard" },
              { keyword: "forever rosa", formationId: "tier5_vanguard" },
              { keyword: "kitten kneading", formationId: "tier5_vanguard" },
              { keyword: "magic rhythm", formationId: "tier5_sorcery" },
              { keyword: "relaxed goose", formationId: "tier5_berserkers" },
              { keyword: "rosie s concert", formationId: "tier5_vanguard" },
              { keyword: "sage s slash", formationId: "tier5_vanguard" },
              { keyword: "santa owl surprise", formationId: "tier5_vanguard" },
              { keyword: "singing sax", formationId: "tier5_vanguard" },
              { keyword: "tom s hug", formationId: "tier5_vanguard" },
              { keyword: "you are loved", formationId: "tier5_vanguard" },
              { keyword: "cheeky pup", formationId: "tier5_vanguard" },
              { keyword: "mic champ", formationId: "tier5_vanguard" },
              { keyword: "wishing cake", formationId: "tier5_sorcery" },
              { keyword: "beating heart", formationId: "tier5_vanguard" },
              { keyword: "captured vocals", formationId: "tier5_vanguard" },
              { keyword: "encore clap", formationId: "tier5_vanguard" },
              { keyword: "space love", formationId: "tier5_vanguard" },
              { keyword: "celebration hat", formationId: "tier5_vanguard" },
              { keyword: "clover hat", formationId: "tier5_vanguard" },
              { keyword: "halloween fun hat", formationId: "tier5_vanguard" },
              { keyword: "music conductor", formationId: "tier5_vanguard" },
              { keyword: "powerful mind", formationId: "tier5_vanguard" },
              { keyword: "superwoman", formationId: "tier5_vanguard" },
              { keyword: "hands up", formationId: "tier5_vanguard" },
              { keyword: "rose soundwave", formationId: "tier5_vanguard" },
              { keyword: "baby chicks", formationId: "tier5_vanguard" },
              { keyword: "cozy xmas set", formationId: "tier5_vanguard" },
              { keyword: "dragon crown", formationId: "tier5_vanguard" },
              { keyword: "heart guitar", formationId: "tier5_vanguard" },
              { keyword: "jungle blitzy", formationId: "tier5_vanguard" },
              { keyword: "jungle diny", formationId: "tier5_vanguard" },
              { keyword: "jungle tom", formationId: "tier5_vanguard" },
              { keyword: "manifesting", formationId: "tier5_vanguard" },
              { keyword: "mystery box", formationId: "tier5_vanguard" },
              { keyword: "prairie blitzy", formationId: "tier5_vanguard" },
              { keyword: "prairie diny", formationId: "tier5_vanguard" },
              { keyword: "prairie tom", formationId: "tier5_vanguard" },
              { keyword: "racing helmet", formationId: "tier5_artillery" },
              { keyword: "starry fluff", formationId: "tier5_artillery" },
              { keyword: "xxxl flowers", formationId: "tier5_vanguard" },
              { keyword: "bubbly kiss", formationId: "tier5_vanguard" },
              { keyword: "hive escape", formationId: "tier5_vanguard" },
              { keyword: "fully bloomed sakura", formationId: "tier5_vanguard" },
              { keyword: "join butterflies", formationId: "tier5_vanguard" },
              { keyword: "swan", formationId: "tier5_vanguard" },
              { keyword: "cute cat", formationId: "tier5_assassins" },
              { keyword: "love flight", formationId: "tier5_vanguard" },
              { keyword: "grand show", formationId: "tier5_vanguard" },
              { keyword: "travel with you", formationId: "tier5_vanguard" },
              { keyword: "uniform", formationId: "tier5_vanguard" },
              { keyword: "desert blitzy", formationId: "tier5_apocalypse" },
              { keyword: "desert diny", formationId: "tier5_apocalypse" },
              { keyword: "desert tom", formationId: "tier5_apocalypse" },
              { keyword: "firepit blitzy", formationId: "tier5_apocalypse" },
              { keyword: "firepit diny", formationId: "tier5_apocalypse" },
              { keyword: "firepit tom", formationId: "tier5_apocalypse" },
              { keyword: "galaxy", formationId: "tier5_apocalypse" },
              { keyword: "lightning your world", formationId: "tier5_apocalypse" },
              { keyword: "sparkle dance", formationId: "tier5_apocalypse" },
              { keyword: "tundra cooper", formationId: "tier5_apocalypse" },
              { keyword: "tundra nyota", formationId: "tier5_apocalypse" },
              { keyword: "watermelon love", formationId: "tier5_apocalypse" },
              { keyword: "joy floats", formationId: "tier5_apocalypse" },
              { keyword: "fireworks", formationId: "tier5_apocalypse" },
              { keyword: "exclusive spark", formationId: "tier5_apocalypse" },
              { keyword: "umbrella of love", formationId: "tier5_apocalypse" },
              { keyword: "party laser", formationId: "tier5_apocalypse" },
              { keyword: "astrobear", formationId: "tier5_apocalypse" },
              { keyword: "cherry blossoms", formationId: "tier5_apocalypse" },
              { keyword: "greeting card", formationId: "tier5_apocalypse" },
              { keyword: "racing debut", formationId: "tier5_apocalypse" },
              { keyword: "under control", formationId: "tier5_apocalypse" },
              { keyword: "wild mic", formationId: "tier5_apocalypse" },
              { keyword: "blooming heart", formationId: "tier5_apocalypse" },
              { keyword: "fox legend", formationId: "tier5_apocalypse" },
              { keyword: "cooper flies home", formationId: "tier5_apocalypse" },
              { keyword: "mystery firework", formationId: "tier5_apocalypse" },
              { keyword: "club music", formationId: "tier5_apocalypse" },
              { keyword: "sky drift", formationId: "tier5_apocalypse" },
              { keyword: "blow rosie kisses", formationId: "tier5_apocalypse" },
              { keyword: "rocky s punch", formationId: "tier5_apocalypse" },
              { keyword: "stargazing", formationId: "tier5_apocalypse" },
              { keyword: "by the glaziers", formationId: "tier5_apocalypse" },
              { keyword: "magic stage", formationId: "tier5_apocalypse" },
              { keyword: "motorcycle", formationId: "tier5_apocalypse" },
              { keyword: "party bus", formationId: "tier5_apocalypse" },
              { keyword: "ring of honor cube", formationId: "tier5_apocalypse" },
              { keyword: "meteor shower", formationId: "tier5_apocalypse" },
              { keyword: "sea cooper", formationId: "tier5_apocalypse" },
              { keyword: "sea nyota", formationId: "tier5_apocalypse" },
              { keyword: "hip hop hen", formationId: "tier5_apocalypse" },
              { keyword: "look up", formationId: "tier5_apocalypse" },
              { keyword: "guiding star", formationId: "tier5_apocalypse" },
              { keyword: "shine bright", formationId: "tier5_apocalypse" },
              { keyword: "dynamic music", formationId: "tier5_apocalypse" },
              { keyword: "leon the kitten", formationId: "tier5_apocalypse" },
              { keyword: "signature jet", formationId: "tier5_apocalypse" },
              { keyword: "sage s venture", formationId: "tier5_apocalypse" },
              { keyword: "flying jets", formationId: "tier5_apocalypse" },
              { keyword: "league fandom", formationId: "tier5_apocalypse" },
              { keyword: "seaside romance", formationId: "tier5_apocalypse" },
              { keyword: "fluffy buddies", formationId: "tier5_apocalypse" },
              { keyword: "wolf", formationId: "tier5_apocalypse" },
              { keyword: "valiant odyssey", formationId: "tier5_apocalypse" },
              { keyword: "chick stampede", formationId: "tier5_apocalypse" },
              { keyword: "sam in new city", formationId: "tier5_apocalypse" },
              { keyword: "work hard play harder", formationId: "tier5_apocalypse" },
              { keyword: "celebration time", formationId: "tier5_apocalypse" },
              { keyword: "sports car", formationId: "tier5_apocalypse" },
              { keyword: "star throne", formationId: "tier5_apocalypse" },
              { keyword: "leon and lili", formationId: "tier5_apocalypse" },
              { keyword: "sunset speedway", formationId: "tier5_apocalypse" },
              { keyword: "red lightning", formationId: "tier5_apocalypse" },
              { keyword: "atlantis", formationId: "tier5_apocalypse" },
              { keyword: "invincible hammer", formationId: "tier5_apocalypse" },
              { keyword: "battle champion", formationId: "tier5_apocalypse" },
              { keyword: "future journey", formationId: "tier5_apocalypse" },
              { keyword: "leopard", formationId: "tier5_apocalypse" },
              { keyword: "party on on", formationId: "tier5_apocalypse" },
              { keyword: "sneaky jockey", formationId: "tier5_apocalypse" },
              { keyword: "diamond flight", formationId: "tier5_apocalypse" },
              { keyword: "castle fantasy", formationId: "tier5_apocalypse" },
              { keyword: "tiktok shuttle", formationId: "tier5_apocalypse" },
              { keyword: "infinite heart", formationId: "tier5_apocalypse" },
              { keyword: "cyber roar", formationId: "tier5_apocalypse" },
              { keyword: "undersea kingdom", formationId: "tier5_apocalypse" },
              { keyword: "lion", formationId: "tier5_apocalypse" },
              { keyword: "leon and lion", formationId: "tier5_apocalypse" },
              { keyword: "thunder falcon", formationId: "tier5_apocalypse" },
              { keyword: "fire phoenix", formationId: "tier5_apocalypse" },
              { keyword: "pegasus", formationId: "tier5_apocalypse" },
              { keyword: "tiktok universe", formationId: "tier5_apocalypse" },
          ],



      },
      enemy: {
          name: "Seven Sages (Monsters)",
          color: "#FF0033",
          active: true,
          commentKeyword: "G",
          commentType: "contains",
          // 6 Gift 1-Koin khas penonton feminin/kasual
          giftBindings: [
              { keyword: "boba", formationId: "tier5_sorcery" },
              { keyword: "club cheers", formationId: "tier5_vanguard" },
              { keyword: "coldy", formationId: "tier5_vanguard" },
              { keyword: "creeper", formationId: "tier5_vanguard" },
              { keyword: "fried", formationId: "tier5_vanguard" },
              { keyword: "glow stick", formationId: "tier5_vanguard" },
              { keyword: "headphone", formationId: "tier5_vanguard" },
              { keyword: "heart me", formationId: "tier5_vanguard" },
              { keyword: "love you so much", formationId: "tier5_vanguard" },
              { keyword: "music album", formationId: "tier5_vanguard" },
              { keyword: "oldies", formationId: "tier5_vanguard" },
              { keyword: "pop", formationId: "tier5_vanguard" },
              { keyword: "rose", formationId: "tier5_vanguard" },
              { keyword: "so cute", formationId: "tier5_vanguard" },
              { keyword: "tiktok", formationId: "tier5_sorcery" },
              { keyword: "wink wink", formationId: "tier5_vanguard" },
              { keyword: "team bracelet", formationId: "tier5_sorcery" },
              { keyword: "finger heart", formationId: "tier5_vanguard" },
              { keyword: "overreact", formationId: "tier5_vanguard" },
              { keyword: "cheer you up", formationId: "tier5_vanguard" },
              { keyword: "super popular", formationId: "tier5_vanguard" },
              { keyword: "friendship necklace", formationId: "tier5_vanguard" },
              { keyword: "i love you", formationId: "tier5_vanguard" },
              { keyword: "league ball", formationId: "tier5_artillery" },
              { keyword: "rosa", formationId: "tier5_vanguard" },
              { keyword: "style me up", formationId: "tier5_vanguard" },
              { keyword: "perfume", formationId: "tier5_vanguard" },
              { keyword: "doughnut", formationId: "tier5_sorcery" },
              { keyword: "batik bucket hat", formationId: "tier5_vanguard" },
              { keyword: "cap", formationId: "tier5_vanguard" },
              { keyword: "club victory", formationId: "tier5_vanguard" },
              { keyword: "greeting heart", formationId: "tier5_vanguard" },
              { keyword: "level up sparks", formationId: "tier5_vanguard" },
              { keyword: "little crown", formationId: "tier5_vanguard" },
              { keyword: "mark of love", formationId: "tier5_vanguard" },
              { keyword: "sundae bowl", formationId: "tier5_artillery" },
              { keyword: "chicken and cola", formationId: "tier5_vanguard" },
              { keyword: "game controller", formationId: "tier5_artillery" },
              { keyword: "marvelous confetti", formationId: "tier5_vanguard" },
              { keyword: "shell energy", formationId: "tier5_vanguard" },
              { keyword: "super gg", formationId: "tier5_artillery" },
              { keyword: "big shout out", formationId: "tier5_vanguard" },
              { keyword: "caterpillar chaos", formationId: "tier5_assassins" },
              { keyword: "chatting popcorn", formationId: "tier5_vanguard" },
              { keyword: "love glasses", formationId: "tier5_vanguard" },
              { keyword: "raving snail", formationId: "tier5_vanguard" },
              { keyword: "song of harvest", formationId: "tier5_vanguard" },
              { keyword: "cheering crab", formationId: "tier5_vanguard" },
              { keyword: "coconut juice", formationId: "tier5_sorcery" },
              { keyword: "dancing hands", formationId: "tier5_vanguard" },
              { keyword: "flower headband", formationId: "tier5_vanguard" },
              { keyword: "goalkeeper save", formationId: "tier5_vanguard" },
              { keyword: "heart hood", formationId: "tier5_vanguard" },
              { keyword: "indoor fan", formationId: "tier5_vanguard" },
              { keyword: "juicy smile", formationId: "tier5_vanguard" },
              { keyword: "love you", formationId: "tier5_vanguard" },
              { keyword: "melon juice", formationId: "tier5_sorcery" },
              { keyword: "pinch cheek", formationId: "tier5_vanguard" },
              { keyword: "side by side", formationId: "tier5_vanguard" },
              { keyword: "stinging bee", formationId: "tier5_vanguard" },
              { keyword: "the crown", formationId: "tier5_vanguard" },
              { keyword: "diamond heart necklace", formationId: "tier5_vanguard" },
              { keyword: "magic genie", formationId: "tier5_sorcery" },
              { keyword: "cat", formationId: "tier5_assassins" },
              { keyword: "dreamy strings", formationId: "tier5_vanguard" },
              { keyword: "forest elf", formationId: "tier5_vanguard" },
              { keyword: "melodic birds", formationId: "tier5_assassins" },
              { keyword: "palm breeze", formationId: "tier5_vanguard" },
              { keyword: "pinch face", formationId: "tier5_vanguard" },
              { keyword: "star goggles", formationId: "tier5_artillery" },
              { keyword: "treasured voice", formationId: "tier5_vanguard" },
              { keyword: "bat headwear", formationId: "tier5_vanguard" },
              { keyword: "budding heart", formationId: "tier5_vanguard" },
              { keyword: "corgi", formationId: "tier5_vanguard" },
              { keyword: "fruit friends", formationId: "tier5_vanguard" },
              { keyword: "hi rosie", formationId: "tier5_vanguard" },
              { keyword: "live ranking crown", formationId: "tier5_vanguard" },
              { keyword: "melody glasses", formationId: "tier5_vanguard" },
              { keyword: "naughty chicken", formationId: "tier5_vanguard" },
              { keyword: "penguin snowpal", formationId: "tier5_vanguard" },
              { keyword: "pony lantern", formationId: "tier5_vanguard" },
              { keyword: "rock star", formationId: "tier5_artillery" },
              { keyword: "spring sprout", formationId: "tier5_vanguard" },
              { keyword: "tiktok crown", formationId: "tier5_vanguard" },
              { keyword: "wakey mallow", formationId: "tier5_vanguard" },
              { keyword: "diamond ring of love", formationId: "tier5_vanguard" },
              { keyword: "backing monkey", formationId: "tier5_vanguard" },
              { keyword: "beach maracas", formationId: "tier5_vanguard" },
              { keyword: "candy bouquet", formationId: "tier5_vanguard" },
              { keyword: "gingerbread man", formationId: "tier5_vanguard" },
              { keyword: "marked with love", formationId: "tier5_vanguard" },
              { keyword: "rocking shroom", formationId: "tier5_vanguard" },
              { keyword: "spring bouquet", formationId: "tier5_vanguard" },
              { keyword: "vinyl flip", formationId: "tier5_vanguard" },
              { keyword: "blossom fairy", formationId: "tier5_vanguard" },
              { keyword: "confetti bear", formationId: "tier5_berserkers" },
              { keyword: "fairy locket", formationId: "tier5_vanguard" },
              { keyword: "jollie the joy bean", formationId: "tier5_vanguard" },
              { keyword: "let butterfly dances", formationId: "tier5_assassins" },
              { keyword: "panda snap", formationId: "tier5_vanguard" },
              { keyword: "rocky the rock bean", formationId: "tier5_vanguard" },
              { keyword: "rosie the rose bean", formationId: "tier5_vanguard" },
              { keyword: "sage the smart bean", formationId: "tier5_vanguard" },
              { keyword: "shoot the apple", formationId: "tier5_vanguard" },
              { keyword: "tiger lift", formationId: "tier5_vanguard" },
              { keyword: "vocal bear", formationId: "tier5_berserkers" },
              { keyword: "bounce speakers", formationId: "tier5_vanguard" },
              { keyword: "crystal dreams", formationId: "tier5_sorcery" },
              { keyword: "reindeer milk", formationId: "tier5_vanguard" },
              { keyword: "batting cutie", formationId: "tier5_vanguard" },
              { keyword: "candy loot", formationId: "tier5_sorcery" },
              { keyword: "clown boogie", formationId: "tier5_vanguard" },
              { keyword: "pirate s treasure", formationId: "tier5_vanguard" },
              { keyword: "xmas tree hat", formationId: "tier5_vanguard" },
              { keyword: "city pop", formationId: "tier5_vanguard" },
              { keyword: "cupid koala", formationId: "tier5_vanguard" },
              { keyword: "hat of joy", formationId: "tier5_vanguard" },
              { keyword: "paw call", formationId: "tier5_vanguard" },
              { keyword: "sloth peek", formationId: "tier5_vanguard" },
              { keyword: "coral", formationId: "tier5_vanguard" },
              { keyword: "panda hug", formationId: "tier5_vanguard" },
              { keyword: "surfing penguin", formationId: "tier5_vanguard" },
              { keyword: "bunny crown", formationId: "tier5_vanguard" },
              { keyword: "dj glasses", formationId: "tier5_vanguard" },
              { keyword: "gem gun", formationId: "tier5_artillery" },
              { keyword: "heart it out", formationId: "tier5_vanguard" },
              { keyword: "jungle cooper", formationId: "tier5_vanguard" },
              { keyword: "jungle nyota", formationId: "tier5_vanguard" },
              { keyword: "magic prop", formationId: "tier5_sorcery" },
              { keyword: "money gun", formationId: "tier5_artillery" },
              { keyword: "polaris", formationId: "tier5_vanguard" },
              { keyword: "prairie cooper", formationId: "tier5_vanguard" },
              { keyword: "prairie nyota", formationId: "tier5_vanguard" },
              { keyword: "prince", formationId: "tier5_vanguard" },
              { keyword: "roses", formationId: "tier5_vanguard" },
              { keyword: "vr goggles", formationId: "tier5_artillery" },
              { keyword: "you re amazing", formationId: "tier5_vanguard" },
              { keyword: "drum hamster", formationId: "tier5_vanguard" },
              { keyword: "blind box nyota", formationId: "tier5_vanguard" },
              { keyword: "league trophy", formationId: "tier5_artillery" },
              { keyword: "seahorse pop", formationId: "tier5_vanguard" },
              { keyword: "colorful wings", formationId: "tier5_assassins" },
              { keyword: "sunset in bali", formationId: "tier5_vanguard" },
              { keyword: "train", formationId: "tier5_vanguard" },
              { keyword: "lucky airdrop box", formationId: "tier5_vanguard" },
              { keyword: "trending figure", formationId: "tier5_vanguard" },
              { keyword: "blooming ribbons", formationId: "tier5_apocalypse" },
              { keyword: "desert cooper", formationId: "tier5_apocalypse" },
              { keyword: "desert nyota", formationId: "tier5_apocalypse" },
              { keyword: "fairy wings", formationId: "tier5_apocalypse" },
              { keyword: "firepit cooper", formationId: "tier5_apocalypse" },
              { keyword: "firepit nyota", formationId: "tier5_apocalypse" },
              { keyword: "flamingo groove", formationId: "tier5_apocalypse" },
              { keyword: "glowing jellyfish", formationId: "tier5_apocalypse" },
              { keyword: "shiny air balloon", formationId: "tier5_apocalypse" },
              { keyword: "tundra blitzy", formationId: "tier5_apocalypse" },
              { keyword: "tundra diny", formationId: "tier5_apocalypse" },
              { keyword: "tundra tom", formationId: "tier5_apocalypse" },
              { keyword: "candy puffs", formationId: "tier5_apocalypse" },
              { keyword: "diamond tree", formationId: "tier5_apocalypse" },
              { keyword: "magic role", formationId: "tier5_apocalypse" },
              { keyword: "starlight sceptre", formationId: "tier5_apocalypse" },
              { keyword: "frozen magic", formationId: "tier5_apocalypse" },
              { keyword: "vibrant stage", formationId: "tier5_apocalypse" },
              { keyword: "chasing the dream", formationId: "tier5_apocalypse" },
              { keyword: "future encounter", formationId: "tier5_apocalypse" },
              { keyword: "lover s lock", formationId: "tier5_apocalypse" },
              { keyword: "raya gift card", formationId: "tier5_apocalypse" },
              { keyword: "viking hammer", formationId: "tier5_apocalypse" },
              { keyword: "you re so fly", formationId: "tier5_apocalypse" },
              { keyword: "here we go", formationId: "tier5_apocalypse" },
              { keyword: "love drop", formationId: "tier5_apocalypse" },
              { keyword: "doll new year greeting", formationId: "tier5_apocalypse" },
              { keyword: "star of red carpet", formationId: "tier5_apocalypse" },
              { keyword: "crystal crown", formationId: "tier5_apocalypse" },
              { keyword: "whale diving", formationId: "tier5_apocalypse" },
              { keyword: "jollie s heartland", formationId: "tier5_apocalypse" },
              { keyword: "sage s coinbot", formationId: "tier5_apocalypse" },
              { keyword: "wave lights", formationId: "tier5_apocalypse" },
              { keyword: "animal band", formationId: "tier5_apocalypse" },
              { keyword: "samfaring tom", formationId: "tier5_apocalypse" },
              { keyword: "level up spotlight", formationId: "tier5_apocalypse" },
              { keyword: "rhythmic bear", formationId: "tier5_apocalypse" },
              { keyword: "surprise baby mob", formationId: "tier5_apocalypse" },
              { keyword: "sea blitzy", formationId: "tier5_apocalypse" },
              { keyword: "sea diny", formationId: "tier5_apocalypse" },
              { keyword: "sea tom", formationId: "tier5_apocalypse" },
              { keyword: "dream big", formationId: "tier5_apocalypse" },
              { keyword: "go home", formationId: "tier5_apocalypse" },
              { keyword: "magic world", formationId: "tier5_apocalypse" },
              { keyword: "your concert", formationId: "tier5_apocalypse" },
              { keyword: "fiery dragon", formationId: "tier5_apocalypse" },
              { keyword: "private jet", formationId: "tier5_apocalypse" },
              { keyword: "sugar whiskers", formationId: "tier5_apocalypse" },
              { keyword: "diamond gun", formationId: "tier5_apocalypse" },
              { keyword: "four king", formationId: "tier5_apocalypse" },
              { keyword: "leon s sigil cape", formationId: "tier5_apocalypse" },
              { keyword: "unicorn fantasy", formationId: "tier5_apocalypse" },
              { keyword: "desert wolf", formationId: "tier5_apocalypse" },
              { keyword: "cub on clouds", formationId: "tier5_apocalypse" },
              { keyword: "devoted heart", formationId: "tier5_apocalypse" },
              { keyword: "future city", formationId: "tier5_apocalypse" },
              { keyword: "strong finish", formationId: "tier5_apocalypse" },
              { keyword: "lili the leopard", formationId: "tier5_apocalypse" },
              { keyword: "happy party", formationId: "tier5_apocalypse" },
              { keyword: "majestic hearts", formationId: "tier5_apocalypse" },
              { keyword: "bird of paradise", formationId: "tier5_apocalypse" },
              { keyword: "interstellar", formationId: "tier5_apocalypse" },
              { keyword: "falcon", formationId: "tier5_apocalypse" },
              { keyword: "level up spectacle", formationId: "tier5_apocalypse" },
              { keyword: "crystal heart", formationId: "tier5_apocalypse" },
              { keyword: "tidecaller trident", formationId: "tier5_apocalypse" },
              { keyword: "crocodile", formationId: "tier5_apocalypse" },
              { keyword: "golden gallop", formationId: "tier5_apocalypse" },
              { keyword: "paris", formationId: "tier5_apocalypse" },
              { keyword: "rosa nebula", formationId: "tier5_apocalypse" },
              { keyword: "amusement park", formationId: "tier5_apocalypse" },
              { keyword: "fly love", formationId: "tier5_apocalypse" },
              { keyword: "premium shuttle", formationId: "tier5_apocalypse" },
              { keyword: "level ship", formationId: "tier5_apocalypse" },
              { keyword: "tier5 test", formationId: "tier5_apocalypse" },
              { keyword: "phoenix", formationId: "tier5_apocalypse" },
              { keyword: "dragon flame", formationId: "tier5_apocalypse" },
              { keyword: "gorilla", formationId: "tier5_apocalypse" },
              { keyword: "zeus", formationId: "tier5_apocalypse" },
              { keyword: "tiktok stars", formationId: "tier5_apocalypse" },
              { keyword: "legend marcellus", formationId: "tier5_apocalypse" },
              { keyword: "julius the champion", formationId: "tier5_apocalypse" },
          ],

      },
      baseHp: 100000,
      baseDistance: 40,
      maxUnits: 15, // Disarankan dinaikkan sedikit karena spam 1 koin akan sangat masif
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
      rarity?: UnitRarity,
    ) => {
      // FIX: Use integer counter instead of Math.random().toString() to eliminate string allocation per kill
      killEventQueueRef.current.push({
        id: String(++_killEventIdCounter.current),
        killer,
        victim,
        victimType,
        timestamp: Date.now(),
        profileImage,
        rarity,
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
          stats.playerKills[userName] = (stats.playerKills[userName] || 0) + 1;
        if (dmg > 0)
          stats.playerHits[userName] = (stats.playerHits[userName] || 0) + 1;
      } else {
        stats.enemyDamage[userName] = (stats.enemyDamage[userName] || 0) + dmg;
        if (isKill)
          stats.enemyKills[userName] = (stats.enemyKills[userName] || 0) + 1;
        if (dmg > 0)
          stats.enemyHits[userName] = (stats.enemyHits[userName] || 0) + 1;
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
      unitPoolRef.current[i].hp = 0;
      unitDataPoolRef.current[i].isActive = false;
      unitDataPoolRef.current[i].position[1] = -100;
      _vActive[i] = 0;
      const v = vehiclePoolRef.current[i];
      if (v.manager === entityManager) {
        entityManager.remove(v);
      }
    }
    unitIndexRef.current.clear();
    lastPlayerBaseDamageTime.current = 0;
    lastEnemyBaseDamageTime.current = 0;
    damageBufferRef.current.clear();
    damageQueueRef.current.length = 0;
    killEventQueueRef.current.length = 0;
    spellsRef.current.forEach((s) => (s.active = false));
    mmSpellsRef.current.forEach((s) => (s.active = false));
    fighterSpellsRef.current.forEach((s) => (s.active = false));
    tankSpellsRef.current.forEach((s) => (s.active = false));
    assassinSpellsRef.current.forEach((s) => (s.active = false));
    activeIndicesRef.current = [];
    activeIndicesSetRef.current.clear(); // FIX: Reset O(1) lookup set
    spawnQueueHeadRef.current = 0;       // FIX: Reset queue head pointer
    
    // Reset performance throttling settings
    settingsRef.current.potatoMode = false;
  }, [entityManager]);

  const _executeSpawn = useCallback(
    (
      level: number = 1,
      userName: string = "Guest",
      type: "player" | "enemy" = "player",
      isBoss: boolean = false,
      forcedClass?: any,
      profileImage?: string,
      forcedRarity?: UnitRarity,
      customPos?: [number, number, number],
    ) => {
      // --- 1. CAPACITY CHECK (Sync with UI Settings) ---
      const maxUnitsPerSide =
        towerConfigRef.current.maxUnits || settingsRef.current.maxUnits || 20;

      let sideActiveCount = 0;
      for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
        if (
          unitPoolRef.current[i].isActive &&
          unitPoolRef.current[i].type === type
        ) {
          sideActiveCount++;
        }
      }
      if (sideActiveCount >= maxUnitsPerSide) return;

      let poolIdx = -1;
      for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
        if (!unitPoolRef.current[i].isActive) {
          poolIdx = i;
          break;
        }
      }
      if (poolIdx === -1) return;

      const name = (userName === "Guest" && type === "enemy") 
        ? pickRandom(SEAL_M_ENEMIES) 
        : userName.trim().substring(0, 16);
      const unitClass =
        forcedClass ||
        (type === "enemy" 
          ? (isBoss ? "enemy_boss" : pickWeightedRandom(["enemy_grunt"], [100]))
          : pickWeightedRandom(
              ["fighter", "tank", "assassin", "marksman", "mage"],
              [35, 35, 7, 11, 12],
            )
        ); // --- MODULAR GACHA SYSTEM ---

      const rarity = forcedRarity || (pickWeightedRandom(
        ["common", "elite"],
        [95, 5] // Only up to Elite, and extremely rare
      ) as UnitRarity);

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

      const isUnderAttack = type === "player" 
        ? (simulationTimeRef.current - lastPlayerBaseDamageTime.current < 3000)
        : (simulationTimeRef.current - lastEnemyBaseDamageTime.current < 3000);

      const laneOffset = (isBoss || isUnderAttack) ? 0 : pickRandom(LANE_OFFSETS);
      const spread = isUnderAttack ? 1.5 : 4.0;

      if (customPos) {
        v.position.set(customPos[0], customPos[1], customPos[2]);
      } else {
        v.position.set(
          laneOffset + (Math.random() - 0.5) * spread,
          -0.4,
          spawnZ + (Math.random() - 0.5) * spread,
        );
      }
      v.maxSpeed = u.speed;
      v.maxForce = unitClass === "assassin" ? 50 : 30; // Increased to improve responsiveness
      v.velocity.set(0, 0, 0);
      v.steering.behaviors.length = 0;

      const targetZ = type === "player" ? -dist : dist;
      v.steering.add(
        new YUKA.SeekBehavior(new YUKA.Vector3(laneOffset, -0.4, targetZ)),
      );

      if (v.manager !== entityManager) {
        entityManager.add(v);
      }

      uData.isActive = true;
      uData.id = u.id;
      uData.poolIdx = poolIdx;
      uData.type = type;
      uData.userName = name;
      uData.hp = u.hp;
      uData.maxHp = u.maxHp;
      uData.position = [v.position.x, -0.4, v.position.z];
      uData.homePosition = [v.position.x, -0.4, v.position.z];
      uData.patrolTarget = undefined;
      uData.isAggroed = false;
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
      uData.encirclementRadius = (c.ai_behavior?.encirclement || 1.2) * 1.25;
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
      uData.level = level;
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

      // FIX: O(1) Set lookup instead of O(N) Array.includes()
      if (!activeIndicesSetRef.current.has(poolIdx)) {
        activeIndicesSetRef.current.add(poolIdx);
        activeIndicesRef.current.push(poolIdx);
      }

      unitIndexRef.current.set(u.id, u);
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

      let simDelta = delta * (settingsRef.current.timeScale || 1.0);
      if (simDelta > 0.064) simDelta = 0.064; // FIX: Cap maximum delta to prevent teleporting and fast-forward catch up
      simulationTimeRef.current += simDelta * 1000;
      const simNow = simulationTimeRef.current;
      const settings = settingsRef.current;
      const state = useStore.getState();
      const weather = state.weather;
      const isFeverTime = state.isFeverTime;
      const feverSpeedMult = isFeverTime ? 2.0 : 1.0;
      const feverCooldownMult = isFeverTime ? 0.5 : 1.0;
      const weatherCfg = (WEATHER_CONFIG as any)[weather] || {};
      const weatherMults = weatherCfg.multipliers || {};

      // --- PLAYER CHARACTER POSITION (Direct Buffer - ZERO LAG) ---
      // Reading from PlayerInput.playerPosition directly bypasses Zustand state delay
      const playerCharPos = PlayerInput.playerPosition; 


      // --- QUEUED SPAWN PROCESSING ---
      // FIX: Use head pointer instead of shift() to avoid O(N) array mutation every frame.
      // Compact queue every 60 frames to reclaim memory.
      const queue = spawnQueueRef.current;
      const qHead = spawnQueueHeadRef.current;
      if (qHead < queue.length) {
        const req = queue[qHead];
        spawnQueueHeadRef.current = qHead + 1;
        if (req) {
          _executeSpawn(req.level, req.userName, req.type, req.isBoss, req.forcedClass, req.profileImage, req.forcedRarity, req.customPos);
        }
        // Compact: reclaim memory when head gets far ahead
        if (spawnQueueHeadRef.current > 32) {
          spawnQueueRef.current = queue.slice(spawnQueueHeadRef.current);
          spawnQueueHeadRef.current = 0;
        }
      }

      // --- TACTICAL SUPPORT EFFECTS ---
      const isMedicalSupply = state.medicalSupplyActive;
      const isLightning = state.orbitalLightningActive;


      let activeCount = 0;
      const eidArr = eidMap.current;
      const activeArr = _vActive;
      for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
        const eid = eidArr[i];
        if (eid !== -1 && activeArr[i]) activeCount++;
      }
      if (activeCount === 0 && gameStateRef.current !== "PLAYING") return; 
      
      // OPTIMIZATION: Reduce grid update frequency to once every 6 frames.
      if (frameCountRef.current % 6 === 0) {
        battleGrid.update(unitDataPoolRef.current, activeIndicesRef.current);
      }

      const PHYSICS_STEP = 0.016;
      physicsAccumulatorRef.current += simDelta;

      let steps = 0;
      const MAX_STEPS_PER_FRAME = 4; // Catch-up enabled: prevent slow-motion at start (4 steps = 64ms, perfectly matches max delta)
      while (
        physicsAccumulatorRef.current >= PHYSICS_STEP &&
        steps < MAX_STEPS_PER_FRAME
      ) {
        entityManager.update(PHYSICS_STEP);
        physicsAccumulatorRef.current -= PHYSICS_STEP;
        steps++;
      }

      // FIX: Discard remaining accumulator if we hit the limit, prevents "fast forward" visual catch-up
      if (physicsAccumulatorRef.current >= PHYSICS_STEP) {
        physicsAccumulatorRef.current =
          physicsAccumulatorRef.current % PHYSICS_STEP;
      }
      flushDamageBuffer(now);

      const eids = eidMap.current;
      const activeStates = _vActive;
      const uPool = unitPoolRef.current;
      const uiPool = unitDataPoolRef.current;
      const vPool = vehiclePoolRef.current;
      const activeIdxArray = activeIndicesRef.current;

      // FIX: Zero-allocation in-place compaction + rebuild O(1) Set in sync
      if (frameCountRef.current % 30 === 0) {
        let writeIdx = 0;
        activeIndicesSetRef.current.clear();
        for (let ri = 0; ri < activeIdxArray.length; ri++) {
          if (uPool[activeIdxArray[ri]].isActive) {
            activeIdxArray[writeIdx] = activeIdxArray[ri];
            activeIndicesSetRef.current.add(activeIdxArray[ri]);
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
        const v = vPool[i];
        // PRIMARY DEATH CHECK
        if (_vh[i] <= 0) {
          if (!u.isDying) {
            u.isDying = true;
            u.deathTime = simNow;
            uData.isDying = true;
            v.maxSpeed = 0;
            v.velocity.set(0, 0, 0);
            v.steering.behaviors.length = 0;
            if (v.manager === entityManager) {
              entityManager.remove(v);
            }

            if (u.isBoss) {
              // OPTIMIZATION: Removed freezeTimeRef = 200 to eliminate perceived lag on Boss death.
            }
          }

          // Cleanup after corpse despawn time
          if (simNow - (u.deathTime || 0) > CORPSE_DESPAWN_MS) {
            uData.position[1] = -100;
            _py[i] = -100;
            _vActive[i] = 0;
            u.isActive = false;
            uData.isActive = false;
            unitIndexRef.current.delete(u.id);
          }
          continue;
        }

        // --- MEDICAL SUPPLY: Heal player units within 10m of center (0,0,0) ---
        if (isMedicalSupply && u.type === 'player') {
          const distFromCenterSq = _px[i] * _px[i] + _pz[i] * _pz[i];
          if (distFromCenterSq < 100) { // 10m radius (10*10 = 100)
            const healCap = _vmh[i];
            const healed = Math.min(_vh[i] + healCap * 0.008, healCap); 
            _vh[i] = healed;
          }
        }

        // --- ORBITAL LIGHTNING: AOE Damage to ALL units (Player & Enemy) ---
        if (isLightning && Math.random() < 0.015) {
          // Deal 15% of max HP damage - not too painful, but noticeable
          const damage = _vmh[i] * 0.15;
          _vh[i] = Math.max(0, _vh[i] - damage);
          uData.isAggroed = true;
          
          // Add damage to queue for visual feedback
          accumulateDamage(u.id, damage, uData.position, "#93c5fd", simNow);
        } // PERFORMANCE: Spread 'Thinking' logic across 16 frames instead of 8.
        // This reduces the per-frame cost of spatial queries by 50% in high-density combat.

        const thinkThrottle =
          u.unitClass === "fighter"
            ? 120
            : u.unitClass === "assassin"
              ? 60
              : 180;
        const phaseOffset = i % 24;
        const isAggroed = uData.isAggroed;
        const frameCheck = isAggroed ? true : ((Math.floor(simNow / 16) + phaseOffset) % 24 === 0);

        if (
          (frameCheck || isAggroed) &&
          (!u.lastThinkTime || simNow - u.lastThinkTime > (isAggroed ? 16 : thinkThrottle))
        ) {
          u.lastThinkTime = simNow;
          const isFighter = u.unitClass === "fighter";
          const isAssassin = u.unitClass === "assassin";

          let bestScore = -1;
          let bestTargetId: string | undefined = undefined;




          // Removed base targeting - units now only target other units or player

          // ━━━ PLAYER CHARACTER TARGETING (Enemy units only) ━━━
          // Enemy units treat the player character as a high-priority target.
          // CRITICAL: Only target if ALREADY AGGROED or if player is super close
          if (u.type === "enemy" && playerCharPos) {
            const pcDx = _px[i] - playerCharPos[0];
            const pcDz = _pz[i] - playerCharPos[2];
            const pcDistSq = pcDx * pcDx + pcDz * pcDz;
            // If enemy is not aggroed, it only attacks if player is within 8 units (self-defense)
            // If aggroed, it can detect player from much further (map-wide: 300 units)
            const detectRangeSq = uData.isAggroed ? (500 * 500) : (8 * 8);

            if (uData.isAggroed || pcDistSq < detectRangeSq) {
              // Player character is a VERY high priority target for all enemy types
              // If aggroed, hard-lock to player character to emulate MMORPG behavior
              if (uData.isAggroed) {
                bestScore = Infinity;
                bestTargetId = "player-character";
              } else {
                const playerCharWeight = isAssassin ? 50.0 : isFighter ? 20.0 : 15.0;
                const pcScore = playerCharWeight / (pcDistSq + 0.1);
                if (pcScore > bestScore) {
                  bestScore = pcScore;
                  bestTargetId = "player-character";
                }
              }
            }
          }

          // If hard-locked onto the player, skip looking for other targets
          if (bestTargetId !== "player-character" || !uData.isAggroed) {

          const neighbors = battleGrid.queryRadius(
            uData.position[0],
            uData.position[2],
            isFighter || isAssassin ? 16 : 14,
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

            // PRIORITY DEFENSE: Heavily prioritize enemies attacking player char!
            if (potential.targetId === "player-character") {
              weight *= 30.0;
            }


            const score = weight / (dSq + 0.1);
            
            // If not aggroed, don't target other units unless they are attacking me
            if (!uData.isAggroed && potential.targetId !== u.id) continue;

            if (score > bestScore) {
              bestScore = score;
              bestTargetId = potential.id;
            }
          }
          } // End of skip-if-hard-locked block

          if (bestTargetId !== undefined) {
            u.targetId = bestTargetId;
            uData.status = "chasing";
          } else {
            // For enemies, if no target is found, don't default to base.
            // This will trigger the patrol behavior in the movement loop.
            if (u.type === "enemy") {
              u.targetId = undefined;
              uData.status = "idling";
            } else {
              u.targetId = undefined;
              uData.status = "idling";
            }
          }
        }

        const simFrame = Math.floor(simNow * 0.06); 
        const moveCheck = (simFrame + i) % 15 === 0; // PERFORMANCE: Spread collision/separation logic over 15 frames instead of 12.

        if (moveCheck && !u.isDying) {
          const sepWeight = 0.4;
          const neighbors = battleGrid.queryRadius(_px[i], _pz[i], 1.0);
          for (let j = 0; j < neighbors.length; j++) {
            const potential = neighbors[j];
            if (potential.id === u.id) continue;

            const dx = _px[i] - potential.position[0];
            const dz = _pz[i] - potential.position[2];
            const dSq = dx * dx + dz * dz;

            if (dSq < 0.8 && dSq > 0.001) {
              const dInv = 1.0 / Math.sqrt(dSq);
              v.velocity.x += (dx * dInv) * sepWeight;
              v.velocity.z += (dz * dInv) * sepWeight;
            }
          }
        }

        const dist = towerConfigRef.current.baseDistance ?? 24;
        const targetBaseZ = u.type === "player" ? -dist : dist;
        const isBaseTarget =
          false; // Never targeting base anymore
        const isPlayerCharTarget = u.targetId === "player-character";

        const isRanged = u.unitClass === "mage" || u.unitClass === "marksman"; // --- Skill/Buff Range Adjustment ---

        const skillRange = uData.isBuffed ? u.range * 1.5 : u.range;
        const rangeMult = isBaseTarget && isRanged ? 0.82 : 1.0;
        const effectiveRange = skillRange * rangeMult;
        const rangeSq = effectiveRange * effectiveRange;

        const baseInRange = false; // Bases are removed

        // --- PLAYER CHARACTER RANGE CHECK ---
        let playerCharInRange = false;
        if (isPlayerCharTarget && playerCharPos) {
          const pcDx = _px[i] - playerCharPos[0];
          const pcDz = _pz[i] - playerCharPos[2];
          // Optimization Point #2: 1.15x Range Boost specifically against the player
          // This ensures the monster swings its weapon just before touching the player's hitbox.
          const pcRangeSq = rangeSq * 1.15;
          playerCharInRange = (pcDx * pcDx + pcDz * pcDz) < pcRangeSq;
        }

        let currentTarget: ActiveUnit | undefined =
          u.targetId && !isBaseTarget && !isPlayerCharTarget
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
        const tData = tIdx >= 0 ? unitDataPoolRef.current[tIdx] : undefined; // ============================================================
        // ACTIVE SKILL SYSTEM (INNOVATION)
        // ============================================================

        const cfg = CLASS_CONFIG[u.unitClass];
        const cooldown = (cfg.skill_cooldown || 1000) * (1 - u.cooldownReduction);
        
        if (simNow - (uData.lastSkillTime || 0) >= cooldown && !u.isDying) {
          // 1. FIGHTER: Cyclone Slash (AOE around self)
          if (u.unitClass === "fighter") {
            const neighbors = battleGrid.queryRadius(
              _px[i],
              _pz[i],
              (cfg.skill_range || 10),
            );
            let enemyCount = 0;
            for (let n = 0; n < neighbors.length; n++) {
              if (neighbors[n].type !== u.type && !neighbors[n].isDying)
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
                s.color = u.type === "player" ? "#ffd700" : "#ff4400";
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
                    const tarUnit = unitIndexRef.current.get(tar.id);
                    if (tarUnit && tarUnit.isShield) {
                      accumulateDamage(tar.id, 0, tar.position, "#FFFFFF", simNow);
                    } else {
                      _vh[tnIdx] -= dmg;
                      accumulateDamage(tar.id, dmg, tar.position, "#fff", simNow);
                    }
                  }
                }
              }
            }
          } else if (u.unitClass === "mage" && (currentTarget || baseInRange)) {
            // 2. MAGE: Meteor Rain (Targeted AOE)
            uData.lastSkillTime = simNow;
            const pool = spellsRef.current;
            if (pool) {
              const tx = currentTarget
                ? tData!.position[0]
                : u.type === "player"
                  ? 0
                  : 0;
              const tz = currentTarget ? tData!.position[2] : targetBaseZ;
              const shardCount = 12; // LUXURY: 20 high-fidelity 3D ice shards

              for (let m = 0; m < shardCount; m++) {
                const s = pool[mageSpellPtr.current];
                s.active = true; // Rhythmic Staggering: Shards fall in waves

                const waveIndex = Math.floor(m / 5);
                s.startTime = simNow + waveIndex * 300 + Math.random() * 400; // High-altitude source

                s.fromX = tx + (Math.random() - 0.5) * 10;
                s.fromY = 25 + Math.random() * 15;
                s.fromZ = tz + (Math.random() - 0.5) * 10; // Precise landing with slight spread

                s.toX = tx + (Math.random() - 0.5) * 7;
                s.toY = currentTarget ? tData!.position[1] : 0;
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

                mageSpellPtr.current = (mageSpellPtr.current + 1) % pool.length;
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
              30, // Optimized radius (reduced from potential cfg.skill_range which could be 60+)
            );
            let bestTarget = null;
            let minDSq = Infinity;
            for (let t = 0; t < targets.length; t++) {
              const tar = targets[t];
              const dx = _px[i] - tar.position[0];
              const dz = _pz[i] - tar.position[2];
              const dSq = dx * dx + dz * dz;
              if (tar.type !== u.type && !tar.isDying && dSq < minDSq) {
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
              (uData as any).sniperTargetPoolIdx = bestTarget.poolIdx;
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
              tankSpellPtr.current = (tankSpellPtr.current + 1) % pool.length;
            }
          } else if (u.unitClass === "assassin") {
            // 5. ASSASSIN: Shadow Step (Teleport to Squishy)
            const targets = battleGrid.queryRadius(
              _px[i],
              _pz[i],
              40, // Capped radius for performance
            );
            let bestTarget = null;
            let minHp = Infinity;

            for (let tj = 0; tj < targets.length; tj++) {
              const t = targets[tj];
              if (
                t.type !== u.type &&
                (t.unitClass === "mage" || t.unitClass === "marksman") &&
                !t.isDying
              ) {
                if (t.hp < minHp) {
                  minHp = t.hp;
                  bestTarget = t;
                }
              }
            }

            if (bestTarget) {
              const targetU = unitIndexRef.current.get(bestTarget.id);
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
                    (assassinSpellPtr.current + 1) % pool.length;
                }

                const tx = bestTarget.position[0] + (Math.random() - 0.5) * 0.5;
                const tz =
                  bestTarget.position[2] + (u.type === "player" ? 1.5 : -1.5);

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
                    (assassinSpellPtr.current + 1) % pool.length;
                }

                u.untargetableUntil = simNow + 400;
                u.isCriticalReady = true;
                uData.status = "attacking";
              }
            }
          }
        } // --- ACTIVE SKILL UPDATES (Post-Initiation) ---

        if (uData.isBuffed && u.unitClass === "marksman" && !u.isDying) {
          uData.status = "attacking";
          u.isBuffed = true;
          const sCount = (uData as any).sniperCount || 0;
          const lastS = (uData as any).lastSniperTime || 0;
          const delay = sCount === 4 ? 1500 : 800; // Increased delay from 1000/500

          if (simNow - lastS > delay && sCount < 5) {
            (uData as any).sniperCount = sCount + 1;
            (uData as any).lastSniperTime = simNow;
            uData.lastAttackTime = simNow;

            const targetPoolIdx = (uData as any).sniperTargetPoolIdx;
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
              tPos = targetData.position as [number, number, number];
            } else {
              // Target mati, cari target baru terdekat
              const newTargets = battleGrid.queryRadius(_px[i], _pz[i], 35); // Optimized radius
              for (let t2 = 0; t2 < newTargets.length; t2++) {
                const nt = newTargets[t2];
                if (nt.type !== u.type && nt.isActive && !nt.isDying) {
                  tId = nt.id;
                  u.targetId = nt.id;
                  uData.targetId = nt.id;
                  (uData as any).sniperTargetId = nt.id;
                  (uData as any).sniperTargetPoolIdx = nt.poolIdx;
                  const ntData = unitDataPoolRef.current[nt.poolIdx];
                  if (ntData)
                    tPos = ntData.position as [number, number, number];
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
              mmSpellPtr.current = (mmSpellPtr.current + 1) % pool.length;

              if (tPoolIdx !== undefined && tPoolIdx >= 0) {
                const targetUnit = unitIndexRef.current.get(tId);
                const targetData = unitDataPoolRef.current[tPoolIdx];
                if (targetUnit && targetUnit.isShield) {
                  // IMMUNE — do NOT show damage number for clean UI
                } else if (targetUnit && targetData) {
                  // Balanced: 1.8x normal, 5.0x finisher
                  const dmg = u.attack * (sCount + 1 === 5 ? 5.0 : 1.8); // Sync _vh, u.hp, uData.hp all at once
                  const newHp = Math.max(0, _vh[tPoolIdx] - dmg);
                  _vh[tPoolIdx] = newHp;
                  targetUnit.hp = newHp;
                  targetData.hp = newHp;
                  accumulateDamage(tId, dmg, tPos, color, simNow);
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

        if (uData.isBuffed && simNow > ((uData as any).buffEndTime || 0)) {
          uData.isBuffed = false;
          u.isBuffed = false; // CRITICAL SYNC
        }
        if (uData.isRolling && simNow > ((uData as any).rollEndTime || 0))
          uData.isRolling = false;
        if (uData.isShield && simNow > ((uData as any).shieldEndTime || 0)) {
          uData.isShield = false;
          u.isShield = false;
        }

        // ━━━ PLAYER CHARACTER ATTACK ━━━
        // When enemy targets the player character and is in attack range, stop and deal damage.
        if (isPlayerCharTarget && playerCharPos && playerCharInRange) {
          uData.status = "attacking";
          v.maxSpeed = 0;
          
          // Optimization Point #4: 30% faster attack rate against player
          const currentCooldown = (u.attackCooldown * 0.7) * feverCooldownMult;

          // Optimization Point #3: Instant First Strike
          // If the enemy just reached the player, we ignore the initial cooldown delay
          const isFirstStrike = !uData.lastAttackTime;
          if (isFirstStrike || (simNow - (uData.lastAttackTime || 0) > currentCooldown)) {
            // Deal damage to player HP (stored in store as playerBaseHp for now)
            const dmg = u.attack * 0.5; // 50% damage to player character (balanced)
            playerBaseHpRef.current = Math.max(0, playerBaseHpRef.current - dmg);
            lastPlayerBaseDamageTime.current = simNow;
            accumulateDamage(
              "player-character",
              dmg,
              [playerCharPos[0], playerCharPos[1] + 1.5, playerCharPos[2]],
              towerConfigRef.current.enemy.color,
              simNow
            );
            uData.lastAttackTime = simNow;

            // Fire visual attack effect toward player character
            const teamColor = towerConfigRef.current.enemy.color;
            const fwdX = playerCharPos[0] - _px[i];
            const fwdZ = playerCharPos[2] - _pz[i];
            const fwdLen = Math.sqrt(fwdX * fwdX + fwdZ * fwdZ) || 1;
            if (u.unitClass === "marksman" || u.unitClass === "mage") {
              const pool = mmSpellsRef.current;
              const s = pool[mmSpellPtr.current];
              s.fromX = _px[i];
              s.fromY = uData.position[1] + 1.8;
              s.fromZ = _pz[i];
              s.toX = playerCharPos[0];
              s.toY = playerCharPos[1] + 1.2;
              s.toZ = playerCharPos[2];
              s.startTime = simNow;
              s.color = teamColor;
              s.active = true;
              s.progress = 0;
              s.isBullet = true;
              (s as any).bulletSpeed = 80.0;
              (s as any)._tIdx = undefined;
              mmSpellPtr.current = (mmSpellPtr.current + 1) % pool.length;
            } else {
              // Melee flash
              const pool = fighterSpellsRef.current;
              const s = pool[fighterSpellPtr.current];
              s.x = playerCharPos[0];
              s.y = 1.2;
              s.z = playerCharPos[2];
              s.targetX = playerCharPos[0];
              s.targetZ = playerCharPos[2];
              s.rotation = Math.atan2(fwdX / fwdLen, fwdZ / fwdLen);
              s.startTime = simNow;
              s.color = teamColor;
              s.active = true;
              s.progress = 0;
              (s as any).isCyclone = false;
              (s as any)._tIdx = undefined;
              fighterSpellPtr.current = (fighterSpellPtr.current + 1) % pool.length;
            }
          }
        } else if (isPlayerCharTarget && playerCharPos && !playerCharInRange) {
          // Chase player character
          uData.status = "chasing";
          const classWeatherMult = weatherMults[u.unitClass]?.move_speed_mult || 1.0;
          v.maxSpeed = u.speed * classWeatherMult * feverSpeedMult;
          const seek = v.steering.behaviors[0] as any;
          if (seek?.target) {
            seek.target.set(playerCharPos[0], 0, playerCharPos[2]);
          }
        } else if (currentTarget && tData) {
          const dxT = _px[i] - tData.position[0];
          const dzT = _pz[i] - tData.position[2];
          const dSq = dxT * dxT + dzT * dzT;

          if (dSq < rangeSq) {
            uData.status = "attacking";
            v.maxSpeed = (uData.isRolling ? u.speed * 4.0 : 0) * feverSpeedMult;
            const currentCooldown = u.attackCooldown * feverCooldownMult;
            if (simNow - (uData.lastAttackTime || 0) > currentCooldown) {
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
                tData.isAggroed = true;
                currentTarget.hp = _vh[tIdx];
                if (_vh[tIdx] <= 0) {
                  addKillEvent(
                    u.userName,
                    currentTarget.userName,
                    currentTarget.isBoss ? "boss" : "unit",
                    u.profileImage,
                    currentTarget.rarity,
                  );
                  updateStats(u.userName, u.type, 0, true);
                }
                updateStats(u.userName, u.type, dmg);
                accumulateDamage(
                  currentTarget.id,
                  dmg,
                  tData.position,
                  u.type === "player"
                    ? towerConfigRef.current.player.color
                    : towerConfigRef.current.enemy.color,
                  simNow
                );
                hits++;

                const searchRadius = u.unitClass === "mage" ? 3.5 : 2.5;
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

                  const pIdx = p.poolIdx;
                  if (pIdx >= 0) {
                    const pUnit = unitDataPoolRef.current[pIdx]; // REPLACED: Map lookup with direct array access
                    if (pUnit && pUnit.isShield) {
                      accumulateDamage(p.id, 0, p.position, "#FFFFFF", simNow);
                    } else if (pUnit) {
                      _vh[pIdx] -= dmg;
                      pUnit.hp = _vh[pIdx];
                      if (_vh[pIdx] <= 0) {
                        addKillEvent(
                          u.userName,
                          p.userName,
                          p.isBoss ? "boss" : "unit",
                          u.profileImage,
                          p.rarity,
                        );
                        updateStats(u.userName, u.type, 0, true);
                      }
                      updateStats(u.userName, u.type, dmg);
                      accumulateDamage(
                        p.id,
                        dmg,
                        p.position,
                        u.type === "player"
                          ? towerConfigRef.current.player.color
                          : towerConfigRef.current.enemy.color,
                        simNow
                      );
                      hits++;
                    }
                  }
                }
              } else if (
                u.unitClass === "fighter" &&
                (u.rarity === "epic" || u.rarity === "legendary")
              ) {
                // FIX: Reduced cleave from 0.3 to 0.25 for epic to reduce spatial query overhead at 30 units
                const cleavePerc = u.rarity === "legendary" ? 0.45 : 0.25;
                _vh[tIdx] -= dmg;
                tData.hp = _vh[tIdx];
                tData.isAggroed = true;
                currentTarget.hp = _vh[tIdx];
                if (_vh[tIdx] <= 0) {
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
                  u.type === "player"
                    ? towerConfigRef.current.player.color
                    : towerConfigRef.current.enemy.color,
                  simNow
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
                    const cpUnit = unitDataPoolRef.current[cIdx]; // REPLACED: Map lookup with direct array access
                    if (cpUnit && cpUnit.isShield) {
                      accumulateDamage(cp.id, 0, cp.position, "#FFFFFF", simNow);
                    } else if (cpUnit) {
                      const cDmg = dmg * cleavePerc;
                      _vh[cIdx] -= cDmg;
                      cpUnit.hp = _vh[cIdx];
                      if (_vh[cIdx] <= 0) {
                        addKillEvent(
                          u.userName,
                          cp.userName,
                          cpUnit.isBoss ? "boss" : "unit",
                          u.profileImage,
                          cpUnit.rarity,
                        );
                        updateStats(u.userName, u.type, cDmg);
                        accumulateDamage(
                          cp.id,
                          cDmg,
                          cp.position,
                          u.type === "player"
                            ? towerConfigRef.current.player.color
                            : towerConfigRef.current.enemy.color,
                          simNow
                        );
                        cleaveCount++;
                      }
                    }
                  }
                }
              } else {
                _vh[tIdx] -= dmg;
                tData.hp = _vh[tIdx];
                tData.isAggroed = true;
                currentTarget.hp = _vh[tIdx];
                if (_vh[tIdx] <= 0) {
                  addKillEvent(
                    u.userName,
                    currentTarget.userName,
                    currentTarget.isBoss ? "boss" : "unit",
                    u.profileImage,
                    currentTarget.rarity,
                  );
                  updateStats(u.userName, u.type, 0, true);
                }
                updateStats(u.userName, u.type, dmg);
                accumulateDamage(
                  currentTarget.id,
                  dmg,
                  tData.position,
                  u.type === "player"
                    ? towerConfigRef.current.player.color
                    : towerConfigRef.current.enemy.color,
                  simNow
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
                      (fighterSpellPtr.current + 1) % pool.length;
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
                      (tankSpellPtr.current + 1) % pool.length;
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
                      (mageSpellPtr.current + 1) % pool.length;

                    const aoeNearby = battleGrid.queryRadius(
                      tData.position[0],
                      tData.position[2],
                      3.5,
                    );
                    let aoeCount = 0;
                    for (
                      let aj = 0;
                      aj < aoeNearby.length && aoeCount < 3;
                      aj++
                    ) {
                      const ap = aoeNearby[aj];
                      if (
                        !ap.isActive ||
                        ap.type === u.type ||
                        ap.id === currentTarget.id
                      )
                        continue;
                      const as = pool[mageSpellPtr.current];
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
                        (mageSpellPtr.current + 1) % pool.length;
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
                      tIdx !== undefined ? vehiclePoolRef.current[tIdx] : null;
                    const bSpeed = 110.0; // Basic bullet speed
                    if (tVeh && tVeh.velocity.squaredLength() > 0.05) {
                      const dist = Math.sqrt(
                        (uData.position[0] - txP) ** 2 +
                        (uData.position[1] - tData.position[1]) ** 2 +
                        (uData.position[2] - tzP) ** 2,
                      );
                      const tHit = dist / bSpeed;
                      txP += tVeh.velocity.x * tHit;
                      tzP += tVeh.velocity.z * tHit;
                    }

                    const s = pool[mmSpellPtr.current];
                    s.fromX = uData.position[0] + fwdX * 2.5;
                    s.fromY = launchY;
                    s.fromZ = uData.position[2] + fwdZ * 2.5;
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
                    mmSpellPtr.current = (mmSpellPtr.current + 1) % pool.length;
                  }
                  break;
                }
                case "assassin": {
                  const pool = assassinSpellsRef.current;
                  if (pool) {
                    const s = pool[assassinSpellPtr.current];
                    s.x = tData.position[0];
                    s.y = 1.3;
                    s.z = tData.position[2];
                    s.startTime = simNow;
                    s.color = teamColor;
                    s.active = true;
                    s.progress = 0;
                    s.rarity = u.rarity || "common";
                    assassinSpellPtr.current =
                      (assassinSpellPtr.current + 1) % pool.length;
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
                  seek.target.set(tData.position[0], 0, tData.position[2]);
                }
              } else if (u.unitClass === "marksman") {
                const angleHash = ((i * 2654435761) >>> 0) % 360;
                const angle = angleHash * (Math.PI / 180);
                const orbitR = uData.encirclementRadius || 1.25;
                const ddx = _px[i] - tData.position[0];
                const ddz = _pz[i] - tData.position[2];
                if (ddx * ddx + ddz * ddz < 80 * 80) {
                  seek.target.set(
                    tData.position[0] + Math.cos(angle) * orbitR,
                    0,
                    tData.position[2] + Math.sin(angle) * orbitR,
                  );
                } else {
                  seek.target.set(tData.position[0], 0, tData.position[2]);
                }
              }
            } else if (isPlayerCharTarget && playerCharPos) {
               uData.status = "chasing";
               v.maxSpeed = u.speed * classWeatherMult * feverSpeedMult;
               const seek = v.steering.behaviors[0] as any;
               if (seek?.target) {
                 seek.target.set(playerCharPos[0], 0, playerCharPos[2]);
               }
            }
          }
        } else if (baseInRange) {
          uData.status = "attacking";
          v.maxSpeed = 0;
          const currentCooldown = u.attackCooldown * feverCooldownMult;
          if (simNow - (uData.lastAttackTime || 0) > currentCooldown) {
            const dmg = u.attack;
            updateStats(u.userName, u.type, dmg);
            if (u.type === "player") {
              enemyBaseHpRef.current -= dmg;
              lastEnemyBaseDamageTime.current = simNow;
              if (enemyBaseHpRef.current <= 0) {
                addKillEvent(u.userName, "ENEMY BASE", "base", u.profileImage, "legendary");
                updateStats(u.userName, u.type, 0, true);
                freezeTimeRef.current = 100;
              }
            } else {
              playerBaseHpRef.current -= dmg;
              lastPlayerBaseDamageTime.current = simNow;
              if (playerBaseHpRef.current <= 0) {
                addKillEvent(u.userName, "PLAYER BASE", "base", u.profileImage, "legendary");
                updateStats(u.userName, u.type, 0, true);
                freezeTimeRef.current = 100;
              }
            }
            accumulateDamage(
              undefined,
              dmg,
              [0, 2, targetBaseZ],
              u.type === "player"
                ? towerConfigRef.current.player.color
                : towerConfigRef.current.enemy.color,
              simNow
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
                  s.y = launchY;
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
                    (fighterSpellPtr.current + 1) % pool.length;
                }
                break;
              }
              case "tank": {
                const pool = tankSpellsRef.current;
                if (pool) {
                  const s = pool[tankSpellPtr.current];
                  s.x = tPos[0];
                  s.y = tPos[1] + 0.2;
                  s.z = tPos[2];
                  s.startTime = simNow;
                  s.color = teamColor;
                  s.active = true;
                  s.progress = 0;
                  s.isShield = false;
                  tankSpellPtr.current =
                    (tankSpellPtr.current + 1) % pool.length;
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
                      undefined;
                    s.startTime = simNow;
                    s.color = teamColor;
                    s.active = true;
                    s.progress = 0;
                    mageSpellPtr.current =
                      (mageSpellPtr.current + 1) % pool.length;
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
                    undefined;
                  s.startTime = simNow;
                  s.color = teamColor;
                  s.active = true;
                  s.progress = 0;
                  s.isBullet = true;
                  (s as any).isSniper = false; // RECYCLE
                  (s as any).isFinisher = false;
                  mmSpellPtr.current = (mmSpellPtr.current + 1) % pool.length;
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
                    (assassinSpellPtr.current + 1) % pool.length;
                }
                break;
              }
            }
          }
        } else {
          const isPatrolling = u.type === "enemy" && !u.targetId;
          
          if (!(uData.isBuffed && u.unitClass === "marksman")) {
            if (isPatrolling) {
              uData.status = "idling";
            } else if (uData.status !== "chasing" && uData.status !== "attacking") {
              uData.status = "marching";
            }
          }

          const classWeatherMult =
            weatherMults[u.unitClass]?.move_speed_mult || 1.0;
          const globalWeatherMult = weatherMults.globalSpeedMultiplier || 1.0;
          const baseSpeed =
            u.speed *
            (settings.globalSpeedMultiplier || 1.0) *
            classWeatherMult *
            globalWeatherMult;

          if (uData.status === "attacking") {
            v.maxSpeed = 0;
          } else {
            v.maxSpeed = baseSpeed * (uData.isRolling ? 4.0 : (isPatrolling ? 0.4 : 1.0)) * feverSpeedMult;
            // Boost speed slightly when chasing the player to make it more threatening
            if (uData.status === "chasing" && u.targetId === "player-character") {
              v.maxSpeed *= 1.25; 
            }
          }

          // --- DE-AGGRO LOGIC ---
          if (uData.isAggroed && u.targetId === "player-character" && playerCharPos) {
            const dx = _px[i] - playerCharPos[0];
            const dz = _pz[i] - playerCharPos[2];
            const distSq = dx * dx + dz * dz;
            const CHASE_LIMIT_SQ = 45 * 45; 
            if (distSq > CHASE_LIMIT_SQ) {
              uData.isAggroed = false;
              u.targetId = undefined;
              uData.status = "marching";
              uData.patrolTarget = undefined;
              uData.patrolWaitUntil = simNow + 2000; 
            }
          }
          
          const seek = v.steering.behaviors[0] as any;
          if (seek?.target) {
            if (isPatrolling) {
              // PATROL LOGIC: Pick a random point within 25m of home
              if (uData.patrolWaitUntil && simNow < uData.patrolWaitUntil) {
                v.maxSpeed = 0;
                uData.status = "idling";
              } else {
                if (uData.status === "idling") uData.status = "marching";
                
                if (!uData.patrolTarget) {
                  const angle = Math.random() * Math.PI * 2;
                  const dist = 4 + Math.random() * 24; 
                  const tx = Math.max(-45, Math.min(45, uData.homePosition[0] + Math.cos(angle) * dist));
                  const tz = Math.max(-45, Math.min(45, uData.homePosition[2] + Math.sin(angle) * dist));
                  
                  uData.patrolTarget = [tx, uData.homePosition[1], tz];
                  uData.patrolStartTime = simNow;
                }

                // Check if reached patrol target OR timed out (stuck protection)
                const dxP = _px[i] - uData.patrolTarget[0];
                const dzP = _pz[i] - uData.patrolTarget[2];
                const timeInPatrol = simNow - (uData.patrolStartTime || 0);
                
                if (dxP * dxP + dzP * dzP < 6.0 || timeInPatrol > 12000) { 
                  uData.patrolTarget = undefined; 
                  uData.patrolWaitUntil = simNow + 2000 + Math.random() * 3500; 
                  uData.status = "idling";
                } else {
                  seek.target.set(uData.patrolTarget[0], 0, uData.patrolTarget[2]);
                }
              }
            } else {
              // If chasing a specific target (like the player), use their position
              if (u.targetId === "player-character" && playerCharPos) {
                seek.target.set(playerCharPos[0], 0, playerCharPos[2]);
              } else if (u.targetId && u.targetId !== "player-base" && u.targetId !== "enemy-base") {
                const targetUnit = unitIndexRef.current.get(u.targetId);
                if (targetUnit) {
                  const tData = unitDataPoolRef.current[targetUnit.poolIdx];
                  seek.target.set(tData.position[0], 0, tData.position[2]);
                } else {
                  // Fallback to marching
                  const swagger = Math.sin(i * 8.0 + (uData.jitterOffset || 0)) * (uData.laneSwaggerAmp || 1.5);
                  seek.target.set(swagger, 0, targetBaseZ);
                }
              } else {
                // Marching behavior
                const swagger =
                  Math.sin(i * 8.0 + (uData.jitterOffset || 0)) *
                  (uData.laneSwaggerAmp || 1.5);
                seek.target.set(swagger, 0, targetBaseZ);
              }
            }
          }
        }

        {
          const rotSmooth = settings.rotationSmoothing || 0.12;
          const velSq = v.velocity.x ** 2 + v.velocity.z ** 2;
          if (
            (uData.status === "marching" || uData.status === "chasing" || uData.status === "idling" || uData.status === "attacking")
          ) {
            let targetRot = uData.rotation[1];
            let shouldRotate = false;
            let finalSmooth = rotSmooth;

            if (uData.status === "attacking") {
              // Face the attack target (Player or Unit)
              const isPlayerChar = u.targetId === "player-character";
              let tx2 = 0, tz2 = 0;
              let hasValidTargetPos = false;

              if (isPlayerChar && playerCharPos) {
                tx2 = playerCharPos[0];
                tz2 = playerCharPos[2];
                hasValidTargetPos = true;
              } else if (u.targetId) {
                const targetUnit = unitIndexRef.current.get(u.targetId);
                if (targetUnit) {
                  const td2 = uiPool[targetUnit.poolIdx];
                  if (td2 && td2.isActive) {
                    tx2 = td2.position[0];
                    tz2 = td2.position[2];
                    hasValidTargetPos = true;
                  }
                }
              }

              if (hasValidTargetPos) {
                targetRot = Math.atan2(tx2 - _px[i], tz2 - _pz[i]);
                shouldRotate = true;
                if (u.unitClass === "marksman" && uData.isBuffed) {
                  finalSmooth = 1.0; // Sniper instant turn
                }
              }
            } else if (velSq > 0.05) {
              targetRot = Math.atan2(v.velocity.x, v.velocity.z);
              shouldRotate = true;
            }

            if (shouldRotate) {
              let diff = targetRot - uData.rotation[1];
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              uData.rotation[1] += diff * Math.min(finalSmooth * 2, 1.0);
            }
          }
        }

        if (u.unitClass === "assassin" && u.targetId && !isBaseTarget) {
          const blinkCooldownS = 4000;
          const lastBlink = uData.lastBlinkTime || 0;

          if (simNow - lastBlink > blinkCooldownS) {
            const tIdx3 = currentTarget ? currentTarget.poolIdx : -1;
            const td3 = tIdx3 !== -1 ? uiPool[tIdx3] : null;

            if (
              td3 &&
              td3.isActive &&
              td3.id === u.targetId &&
              (td3.unitClass === "mage" || td3.unitClass === "marksman")
            ) {
              const ddx = _px[i] - td3.position[0];
              const ddz = _pz[i] - td3.position[2];
              const dSq2 = ddx * ddx + ddz * ddz;

              if (dSq2 < 36 && dSq2 > 4) {
                const targetForward = u.type === "player" ? -1.8 : 1.8;
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
                    (assassinSpellPtr.current + 1) % pool.length;
                }
              }
            }
          }
        }

        v.velocity.multiplyScalar(1.0 - 0.9 * simDelta); // Faster linear damping approximation

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

        const activeEnv = useStore.getState().environment;
        const mathElevation = getTerrainElevation(_px[i], _pz[i], activeEnv, towerConfigRef.current.baseDistance || 24) - 0.3;
        const targetHeight = getGroundHeight(_px[i], _pz[i], mathElevation);
        const maxStepDist = v.maxSpeed * simDelta * 1.2 + 0.02;
        const maxStepDistSq = maxStepDist * maxStepDist;

        if (moveDistSq > maxStepDistSq) {
          const ratio = maxStepDist / Math.sqrt(moveDistSq);
          _px[i] = oldX + dx * ratio;
          _pz[i] = oldZ + dz * ratio;
          v.position.set(_px[i], targetHeight, _pz[i]);
        } else {
          _px[i] = newX;
          _pz[i] = newZ;
          v.position.y = targetHeight;
        }

        uData.position[0] = _px[i];
        uData.position[1] = targetHeight;
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
          const aoeTargets = battleGrid.queryRadius(s.toX, s.toZ, aoeRadius);
          const attackPower = (s as any).attackPower || 100;
          const dmg = attackPower * ((s as any).iceDmgMult || 5.5); // Use ice mult or fallback
          const ownerType = (s as any).ownerType;

          for (let ti = 0; ti < aoeTargets.length; ti++) {
            const target = aoeTargets[ti];
            if (target.type === ownerType) continue;

            const tIdx = target.poolIdx;
            if (tIdx >= 0) {
              const tUnit = unitIndexRef.current.get(target.id);
              if (tUnit && tUnit.isShield) {
                accumulateDamage(target.id, 0, target.position, "#FFFFFF", simNow);
              } else {
                _vh[tIdx] -= dmg;
                const td = unitDataPoolRef.current[tIdx];
                if (td && tUnit) {
                  td.hp = _vh[tIdx];
                  td.isAggroed = true;
                  tUnit.hp = _vh[tIdx]; // Visual feedback for impact
                  accumulateDamage(
                    target.id,
                    dmg,
                    target.position,
                    ownerType === "player"
                      ? towerConfigRef.current.player.color
                      : towerConfigRef.current.enemy.color,
                    simNow
                  );
                }
              }
            }
          }
        }
      }

      if (playerBaseHpRef.current <= 0 && gameStateRef.current === "PLAYING") {
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
          if (gameStateRef.current === "LOST") {
            resetBattle();
          }
        }, 10000);
      }
      if (enemyBaseHpRef.current <= 0 && gameStateRef.current === "PLAYING") {
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
          if (gameStateRef.current === "WON") {
            resetBattle();
          }
        }, 10000);
      }

      if (simNow - lastStateUpdate.current > 250) {
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
          
        // Only update leaderboard arrays once per second to avoid O(N log N) sorting every 250ms
        if (simNow - (lastLeaderboardUpdate.current || 0) > 1000) {
          lastLeaderboardUpdate.current = simNow;
          const s = statsRef.current;
          
          let pKillsArray = [];
          for (const username in s.playerKills) {
            pKillsArray.push({ username, value: s.playerKills[username], image: s.profileImages[username] });
          }
          pKillsArray.sort((a, b) => b.value - a.value);
          if (pKillsArray.length > 5) pKillsArray.length = 5;

          let eKillsArray = [];
          for (const username in s.enemyKills) {
            eKillsArray.push({ username, value: s.enemyKills[username], image: s.profileImages[username] });
          }
          eKillsArray.sort((a, b) => b.value - a.value);
          if (eKillsArray.length > 5) eKillsArray.length = 5;

          useStore.getState().setTopKills(pKillsArray, eKillsArray);

          // Update damage stats for analytics (once per second to avoid GC pressure)
          useStore.setState(state => ({
            liveStats: {
              ...state.liveStats,
              playerDamage: { ...s.playerDamage },
              enemyDamage: { ...s.enemyDamage }
            }
          }));
        }
        
        if (killEventQueueRef.current.length > 0) {
          useStore.setState(state => {
            const newEvents = [...state.killEvents, ...killEventQueueRef.current];
            return { killEvents: newEvents.slice(-5) };
          });
          killEventQueueRef.current = [];
        }
      }
    },
    [entityManager, flushDamageBuffer, accumulateDamage, addKillEvent],
  );

  const spawnUnit = useCallback((level: number = 1, userName: string = "Guest", type: "player" | "enemy" = "player", isBoss: boolean = false, forcedClass?: any, profileImage?: string, forcedRarity?: UnitRarity, customPos?: [number, number, number]) => {
    spawnQueueRef.current.push({ level, userName, type, isBoss, forcedClass, profileImage, forcedRarity, customPos });
  }, []);

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
        return maxValue > 0 ? { username: maxUser, value: maxValue } : null;
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
          b.kills !== a.kills ? b.kills - a.kills : b.damage - a.damage,
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
          accumulateDamage(u.id, u.maxHp * 0.4, uiPool[i].position, "#FFFFFF", Date.now());
        }
      }
    },
    dealPlayerDamage: (targetId: string, damage: number, isCrit: boolean = false) => {
      const u = unitIndexRef.current.get(targetId);
      if (!u) return;
      const i = u.poolIdx;
      const uData = unitDataPoolRef.current[i];
      if (u.isDying || u.hp <= 0) return;

      const newHp = Math.max(0, _vh[i] - damage);
      _vh[i] = newHp;
      u.hp = newHp;
      uData.hp = newHp;
      
      // INSTANT AGGRO: Target the player character directly
      uData.isAggroed = true;
      uData.targetId = "player-character";
      u.targetId = "player-character";
      uData.patrolWaitUntil = 0; // Break out of idle patrol
      u.lastThinkTime = 0; // Force immediate re-evaluation of steering

      accumulateDamage(targetId, damage, uData.position, isCrit ? "#ff0000" : "#ffaa00", simulationTimeRef.current);
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
    // ── Profiler passthrough refs (read-only, zero cost) ──────────────────
    spawnQueueRef,
    unitDataPoolRef,
  };
};
