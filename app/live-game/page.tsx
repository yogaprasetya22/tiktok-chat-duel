'use client';

import { useEffect, useState, useRef, useMemo } from "react";
import { useTikTokLive } from "@/src/lib/hooks";
import { useBattleSystem } from "@/src/hooks/battle/useBattleSystem";
import { useStore } from "@/src/state/useStore";
import { GIFT_FORMATIONS } from "@/src/core/logic/gift/giftDictionary";
import { GameCanvas } from "@/src/components/game/GameCanvas";
import { UIOverlay } from "@/src/components/game/ui/UIOverlay";
import { useControls, button, folder, Leva } from "leva";
import { cinematicState } from "@/src/state/cinematicState";

export default function GamePage() {
  const [mounted, setMounted] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [activeUsername, setActiveUsername] = useState("");
  const [testingMode, setTestingMode] = useState(false);
  const likeCounterRef = useRef<number>(0);
  const cumulativeLikesRef = useRef<number>(0);

  useEffect(() => { setMounted(true); }, []);

  const { messages, connected, error, loading } = useTikTokLive(activeUsername);

  const {
    towerConfig, setTowerConfig,
    spawnUnit, resetBattle, getMVPData,
    setMapObstacles, mapObstacles, debug, unitRegistry,
    triggerAirstrike, updateSimulation,
    damageQueue, settingsRef, simTimeRef,
    vehicles, unitIndex,
    spellsRef, mmSpellsRef, fighterSpellsRef, tankSpellsRef, assassinSpellsRef,
    compBuffers,
  } = useBattleSystem();

  const gameState = useStore(s => s.gameState);
  const gameMode = useStore(s => s.gameMode);
  const isSettingsOpen = useStore(s => s.isSettingsOpen);

  // --- Leva Deployment Controls (Training Mode) ---
  useControls("deployment", {
    "Deployment": folder({
      "Spawn Fighter": button(() => spawnUnit(1, "Training", "player", false, "fighter")),
      "Spawn Tank": button(() => spawnUnit(1, "Training", "player", false, "tank")),
      "Spawn Mage": button(() => spawnUnit(1, "Training", "player", false, "mage")),
      "Spawn Marksman": button(() => spawnUnit(1, "Training", "player", false, "marksman")),
      "Spawn Assassin": button(() => spawnUnit(1, "Training", "player", false, "assassin")),
      "Spawn Target Dummy": button(() => spawnUnit(1, "Training", "enemy", true, "fighter")),
    }, { render: () => gameMode === 'TRAINING' }),
    "Arena": folder({
      "Clear All Units": button(() => resetBattle()),
    }, { render: () => gameMode === 'TRAINING' }),
  }, [gameMode, spawnUnit, resetBattle]);

  // --- Cinematic Camera Leva Controls ---
  useControls("Cinematic Camera", {
    "Normal Angles": folder({
      "Angle 1": folder({
        x1: { value: cinematicState.angles[0].x, min: -100, max: 100, onChange: (v) => cinematicState.angles[0].x = v },
        y1: { value: cinematicState.angles[0].y, min: 2, max: 80, onChange: (v) => cinematicState.angles[0].y = v },
        z1: { value: cinematicState.angles[0].z, min: -100, max: 100, onChange: (v) => cinematicState.angles[0].z = v },
      }, { collapsed: true }),
      "Angle 2": folder({
        x2: { value: cinematicState.angles[1].x, min: -100, max: 100, onChange: (v) => cinematicState.angles[1].x = v },
        y2: { value: cinematicState.angles[1].y, min: 2, max: 80, onChange: (v) => cinematicState.angles[1].y = v },
        z2: { value: cinematicState.angles[1].z, min: -100, max: 100, onChange: (v) => cinematicState.angles[1].z = v },
      }, { collapsed: true }),
      "Angle 3": folder({
        x3: { value: cinematicState.angles[2].x, min: -100, max: 100, onChange: (v) => cinematicState.angles[2].x = v },
        y3: { value: cinematicState.angles[2].y, min: 2, max: 80, onChange: (v) => cinematicState.angles[2].y = v },
        z3: { value: cinematicState.angles[2].z, min: -100, max: 100, onChange: (v) => cinematicState.angles[2].z = v },
      }, { collapsed: true }),
      "Angle 4": folder({
        x4: { value: cinematicState.angles[3].x, min: -100, max: 100, onChange: (v) => cinematicState.angles[3].x = v },
        y4: { value: cinematicState.angles[3].y, min: 2, max: 80, onChange: (v) => cinematicState.angles[3].y = v },
        z4: { value: cinematicState.angles[3].z, min: -100, max: 100, onChange: (v) => cinematicState.angles[3].z = v },
      }, { collapsed: true }),
      "Angle 5": folder({
        x5: { value: cinematicState.angles[4].x, min: -100, max: 100, onChange: (v) => cinematicState.angles[4].x = v },
        y5: { value: cinematicState.angles[4].y, min: 2, max: 80, onChange: (v) => cinematicState.angles[4].y = v },
        z5: { value: cinematicState.angles[4].z, min: -100, max: 100, onChange: (v) => cinematicState.angles[4].z = v },
      }, { collapsed: true }),
      "Angle 6": folder({
        x6: { value: cinematicState.angles[5].x, min: -100, max: 100, onChange: (v) => cinematicState.angles[5].x = v },
        y6: { value: cinematicState.angles[5].y, min: 2, max: 80, onChange: (v) => cinematicState.angles[5].y = v },
        z6: { value: cinematicState.angles[5].z, min: -100, max: 100, onChange: (v) => cinematicState.angles[5].z = v },
      }, { collapsed: true }),
    }),
    "Siege Angles": folder({
      defenderY: { value: cinematicState.siege.defenderY, min: 5, max: 60, onChange: (v) => cinematicState.siege.defenderY = v },
      defenderDist: { value: cinematicState.siege.defenderDist, min: 5, max: 80, onChange: (v) => cinematicState.siege.defenderDist = v },
      frontalY: { value: cinematicState.siege.frontalY, min: 5, max: 60, onChange: (v) => cinematicState.siege.frontalY = v },
      frontalDist: { value: cinematicState.siege.frontalDist, min: 5, max: 80, onChange: (v) => cinematicState.siege.frontalDist = v },
    }, { collapsed: true })
  });

  // --- Auto-Spawn Logic (Testing Mode) ---
  const countsRef = useRef({ player: 0, enemy: 0 });
  useEffect(() => {
    const unsub = useStore.subscribe((state) => {
      countsRef.current = state.armyCounts;
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!testingMode || gameState !== "PLAYING" || gameMode === "TRAINING") return;
    const intervalId = setInterval(() => {
      const { player, enemy } = countsRef.current;
      const isPlayerUnderdog = player < enemy - 10;
      const isEnemyUnderdog = enemy < player - 10;

      const spawnForTeam = (side: "player" | "enemy") => {
        const config = side === "player" ? towerConfig.player : towerConfig.enemy;
        if (!config.active) return;
        if (side === "player" && isEnemyUnderdog && player > 25) return;
        if (side === "enemy" && isPlayerUnderdog && enemy > 25) return;
        const isUnderdog = (side === "player" && isPlayerUnderdog) || (side === "enemy" && isEnemyUnderdog);
        const count = isUnderdog ? 2 : 1;
        for (let i = 0; i < count; i++) spawnUnit(1, config.name, side);
      };

      const now = Date.now();
      if (Math.floor(now / 200) % 2 === 0) spawnForTeam("player");
      else spawnForTeam("enemy");
    }, 200);
    return () => clearInterval(intervalId);
  }, [testingMode, gameState, spawnUnit, towerConfig, gameMode]);

  // --- 100% Accurate Event Processing & Queue System (Fast Track) ---
  const processedIdsRef = useRef<Set<string>>(new Set());
  const priorityQueueRef = useRef<Array<() => void>>([]); // HIGH PRIORITY: Gifts
  const standardQueueRef = useRef<Array<() => void>>([]); // STANDARD: Chat/Likes

  // Queue Consumer: Processes spawns gradually with Priority Fast-Track
  useEffect(() => {
    if (gameState !== "PLAYING" || gameMode === "TRAINING") return;
    
    const intervalId = setInterval(() => {
      // FAST TRACK LOGIC: Always check priority queue (Gifts) first
      if (priorityQueueRef.current.length > 0) {
        // Process gifts faster (5 units per batch) to make them feel impactful
        const batch = priorityQueueRef.current.splice(0, 5);
        batch.forEach(spawnAction => spawnAction());
      } 
      // Only process standard chat queue if no gifts are waiting
      else if (standardQueueRef.current.length > 0) {
        const batch = standardQueueRef.current.splice(0, 3);
        batch.forEach(spawnAction => spawnAction());
      }
    }, 50);

    return () => clearInterval(intervalId);
  }, [gameState, gameMode]);

  // --- TikTok Event Processing ---
  useEffect(() => {
    if (messages.length === 0 || gameMode === "TRAINING") return;
    
    // 100% Accurate Deduplication
    const newMessages = messages.filter((msg: any) => !processedIdsRef.current.has(msg.id));
    if (newMessages.length === 0) return;

    newMessages.forEach((msg: any) => {
      processedIdsRef.current.add(msg.id);
      
      // Prevent memory leak in Set
      if (processedIdsRef.current.size > 2000) {
        const iterator = processedIdsRef.current.values();
        for (let i = 0; i < 1000; i++) {
          const val = iterator.next().value;
          if (val) processedIdsRef.current.delete(val);
        }
      }

      // Helper to enqueue a spawn (Priority Support)
      const queueSpawn = (count: number, side: "player"|"enemy", isBoss: boolean, unitClass: any, rarity: any, isPriority: boolean = false) => {
        const targetQueue = isPriority ? priorityQueueRef.current : standardQueueRef.current;
        for (let i = 0; i < count; i++) {
          targetQueue.push(() => {
            spawnUnit(1, msg.username, side, isBoss, unitClass, msg.profileImage, rarity);
          });
        }
      };

      // 1. TACTICAL SUPPORT LOGIC (Likes)
      if (msg.type === "like") {
        cumulativeLikesRef.current += (msg.likeCount || 1);
        if (cumulativeLikesRef.current - likeCounterRef.current >= 500) {
          likeCounterRef.current += 500;
          const roll = Math.random();
          if (roll < 0.33) useStore.getState().triggerFeverTime();
          else if (roll < 0.66) useStore.getState().triggerOrbitalLightning();
          else useStore.getState().triggerMedicalSupply();
        }
      }

      // 2. SPAWN LOGIC VIA CHAT
      const processSpawn = (side: "player" | "enemy") => {
        const config = side === "player" ? towerConfig.player : towerConfig.enemy;
        if (!config.active) return;
        
        if (msg.type !== "chat") return;
        const cleanComment = msg.comment.toLowerCase().replace(/\s+/g, "");
        const baseKey = config.commentKeyword.toLowerCase().replace(/\s+/g, "");
        
        const ALL_CLASSES = ["fighter", "tank", "mage", "marksman", "assassin"] as const;
        const randomRarity = () => Math.random() < 0.7 ? "common" : "elite";
        
        let spawnedClass: any = undefined;
        let isMatch = false;

        if (cleanComment === baseKey) {
          spawnedClass = ALL_CLASSES[Math.floor(Math.random() * ALL_CLASSES.length)];
          isMatch = true;
        } else if (cleanComment === `${baseKey}fighter`) { spawnedClass = "fighter"; isMatch = true; }
          else if (cleanComment === `${baseKey}tank`) { spawnedClass = "tank"; isMatch = true; }
          else if (cleanComment === `${baseKey}mage`) { spawnedClass = "mage"; isMatch = true; }
          else if (cleanComment === `${baseKey}marksman` || cleanComment === `${baseKey}mm`) { spawnedClass = "marksman"; isMatch = true; }
          else if (cleanComment === `${baseKey}assassin`) { spawnedClass = "assassin"; isMatch = true; }

        if (isMatch) {
          queueSpawn(1, side, false, spawnedClass, randomRarity());
        }
      };

      // 3. SPAWN LOGIC VIA GIFT (100% Guarantee Queue)
      const processGiftSpawn = () => {
        if (msg.type !== "gift") return;

        const giftNameLower = (msg.giftName || "").toLowerCase();

        // ROULETTE TRIGGER
        if (giftNameLower.includes("game controller")) {
          const side = Math.random() > 0.5 ? "player" : "enemy";
          useStore.getState().triggerRoulette(msg.username, side);
          return;
        }

        const findMatch = (side: "player" | "enemy") => {
          const config = side === "player" ? towerConfig.player : towerConfig.enemy;
          if (!config.active || !config.giftBindings?.length) return null;
          for (const binding of config.giftBindings) {
            if (binding.keyword && giftNameLower.includes(binding.keyword.toLowerCase())) {
              return { side, binding };
            }
          }
          return null;
        };

        const match = findMatch("player") || findMatch("enemy");
        if (!match) return;

        const { side, binding } = match;
        const formation = GIFT_FORMATIONS[binding.formationId];
        
        if (formation) {
          for (const rule of formation.rules) {
            const isBoss = rule.unitClass === "boss" || rule.rarity === "legendary";
            // Safely queue ALL units for this gift with Priority Fast-Track
            queueSpawn(rule.count, side, isBoss, rule.unitClass === "boss" ? undefined : rule.unitClass, rule.rarity, true);
          }
          // Immediate UI feedback for the donor
          useStore.getState().triggerGacha(msg.username, side, "GIFT REWARD", formation.name);
        }
      };

      processSpawn("player");
      processSpawn("enemy");
      processGiftSpawn();
    });
  }, [messages, spawnUnit, towerConfig, gameMode, triggerAirstrike]);

  // --- Roulette Execution Logic ---
  const rouletteEvent = useStore(s => s.rouletteEvent);
  useEffect(() => {
    if (!rouletteEvent) return;
    
    // Wait 3 seconds for UI spinning animation
    const timer = setTimeout(() => {
      const outcomes = ["airstrike", "jackpot", "zonk"];
      const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
      const { username, team } = rouletteEvent;
      const enemyTeam = team === "player" ? "enemy" : "player";
      
      if (outcome === "airstrike") {
        triggerAirstrike(enemyTeam);
      } else if (outcome === "jackpot") {
        spawnUnit(10, username, team, false, "assassin");
      } else if (outcome === "zonk") {
        // Zonk: spawn enemies for the opposing team!
        spawnUnit(5, username, enemyTeam, false, "fighter");
      }
      
      useStore.getState().clearRoulette();
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [rouletteEvent, spawnUnit, triggerAirstrike]);

  const displayMessages = useMemo(() => messages.slice(-50).reverse(), [messages]);

  if (!mounted) {
    return (
      <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden touch-none select-none bg-[#3E3024] flex items-center justify-center">
        <div className="text-[#B5A642] uppercase font-black tracking-[0.3em] animate-pulse text-sm">
          Initializing Battle Engine...
        </div>
      </div>
    );
  }

  const mvpData = getMVPData();

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden touch-none select-none bg-[#3E3024]">
      {/* ===== LAYER 0: Three.js Canvas (always full-screen) ===== */}
      <div className="absolute inset-0 w-full h-full z-0">
        <GameCanvas
          towerConfig={towerConfig}
          setTowerConfig={setTowerConfig}
          isCinematic={isCinematic}
          setMapObstacles={setMapObstacles}
          mapObstacles={mapObstacles}
          debug={debug}
          unitRegistry={unitRegistry}
          updateSimulation={updateSimulation}
          damageQueue={damageQueue}
          settingsRef={settingsRef}
          simTimeRef={simTimeRef}
          vehicles={vehicles}
          unitIndex={unitIndex}
          spellsRef={spellsRef}
          mmSpellsRef={mmSpellsRef}
          fighterSpellsRef={fighterSpellsRef}
          tankSpellsRef={tankSpellsRef}
          assassinSpellsRef={assassinSpellsRef}
          compBuffers={compBuffers}
        />
      </div>

      {/* ===== LAYER 1: HUD Overlay (HTML on top of canvas) ===== */}
      <div className="absolute inset-0 z-10 pointer-events-none p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)]">
        <UIOverlay
          towerConfig={towerConfig}
          setTowerConfig={setTowerConfig}
          onSpawn={() => spawnUnit(1, "Owner", "player")}
          onStart={resetBattle}
          onConnect={(user: string) => setActiveUsername(user)}
          connected={connected}
          loading={loading}
          error={error}
          onRestart={resetBattle}
          isCinematic={isCinematic}
          onToggleCinematic={() => setIsCinematic(!isCinematic)}
          showChat={showChat}
          onToggleChat={() => setShowChat(!showChat)}
          mvpData={mvpData}
          testingMode={testingMode}
          onToggleTesting={() => setTestingMode(!testingMode)}
          displayMessages={displayMessages}
        />
      </div>

      {/* ===== LAYER 2: Unified Settings Panel (Leva) ===== */}
      <div className="fixed top-20 right-4 z-[9999] pointer-events-auto">
        <Leva 
          hidden={!isSettingsOpen && gameMode !== 'TRAINING'}
          theme={{
            colors: {
              accent1: '#6366f1', accent2: '#4f46e5', accent3: '#4338ca',
              elevation1: '#09090bee', elevation2: '#18181bee', elevation3: '#27272aee'
            },
            radii: { xs: '8px', sm: '12px', lg: '20px' }
          }}
          collapsed={false}
          titleBar={{ title: "Engine Console", drag: true }}
        />
      </div>

    </div>
  );
}
