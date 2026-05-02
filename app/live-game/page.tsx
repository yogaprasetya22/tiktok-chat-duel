'use client';

import { useEffect, useState, useRef, useMemo } from "react";
import { useTikTokLive } from "@/src/lib/hooks";
import { useBattleSystem } from "@/src/hooks/battle/useBattleSystem";
import { useStore } from "@/src/state/useStore";
import { GIFT_FORMATIONS } from "@/src/core/logic/gift/giftDictionary";
import { GameCanvas } from "@/src/components/game/GameCanvas";
import { UIOverlay } from "@/src/components/game/ui/UIOverlay";
import { useControls, button, folder, Leva } from "leva";

export default function GamePage() {
  const [mounted, setMounted] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [activeUsername, setActiveUsername] = useState("");
  const [testingMode, setTestingMode] = useState(false);
  const lastProcessedId = useRef<string | null>(null);
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
    downloadPerfLogs, clearVFXCache, compBuffers,
  } = useBattleSystem();

  const gameState = useStore(s => s.gameState);
  const gameMode = useStore(s => s.gameMode);

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

  // --- TikTok Event Processing ---
  useEffect(() => {
    if (messages.length === 0 || gameMode === "TRAINING") return;
    let startIndex = -1;
    if (lastProcessedId.current) {
      startIndex = messages.findIndex((m: any) => m.id === lastProcessedId.current);
    }
    const newMessages = messages.slice(startIndex + 1);
    if (newMessages.length === 0) return;
    lastProcessedId.current = newMessages[newMessages.length - 1].id;

    newMessages.forEach((msg: any) => {
      // 1. TACTICAL SUPPORT LOGIC (Likes → random effect every 500 likes)
      if (msg.type === "like") {
        cumulativeLikesRef.current += (msg.likeCount || 1);
        if (cumulativeLikesRef.current - likeCounterRef.current >= 500) {
          likeCounterRef.current += 500;
          // Randomly pick 1 of 3 tactical effects
          const roll = Math.random();
          if (roll < 0.33) {
            useStore.getState().triggerFeverTime();
          } else if (roll < 0.66) {
            useStore.getState().triggerOrbitalLightning();
          } else {
            useStore.getState().triggerMedicalSupply();
          }
        }
      }

      // 2. SPAWN LOGIC VIA CHAT (Team specific)
      const processSpawn = (side: "player" | "enemy") => {
        const config = side === "player" ? towerConfig.player : towerConfig.enemy;
        if (!config.active) return;
        
        if (msg.type !== "chat") return;
        // Anti-typo parser: remove all spaces, lowercase
        const cleanComment = msg.comment.toLowerCase().replace(/\s+/g, "");
        const baseKey = config.commentKeyword.toLowerCase().replace(/\s+/g, "");
        
        const ALL_CLASSES = ["fighter", "tank", "mage", "marksman", "assassin"] as const;
        // 70% common, 30% elite for basic chat spawns
        const randomRarity = () => Math.random() < 0.7 ? "common" : "elite";
        
        let spawnedClass: any = undefined;
        let isMatch = false;

        if (cleanComment === baseKey) {
          // Keyword only → random class
          spawnedClass = ALL_CLASSES[Math.floor(Math.random() * ALL_CLASSES.length)];
          isMatch = true;
        } else if (cleanComment === `${baseKey}fighter`) {
          spawnedClass = "fighter"; isMatch = true;
        } else if (cleanComment === `${baseKey}tank`) {
          spawnedClass = "tank"; isMatch = true;
        } else if (cleanComment === `${baseKey}mage`) {
          spawnedClass = "mage"; isMatch = true;
        } else if (cleanComment === `${baseKey}marksman` || cleanComment === `${baseKey}mm`) {
          spawnedClass = "marksman"; isMatch = true;
        } else if (cleanComment === `${baseKey}assassin`) {
          spawnedClass = "assassin"; isMatch = true;
        }

        if (isMatch) {
          spawnUnit(1, msg.username, side, false, spawnedClass, msg.profileImage, randomRarity());
        }
      };

      // 3. SPAWN LOGIC VIA GIFT (Exclusive team pools — 1 gift → 1 team)
      const processGiftSpawn = () => {
        if (msg.type !== "gift") return;

        const giftNameRaw = msg.giftName || "";
        const giftNameLower = giftNameRaw.toLowerCase();

        // ROULETTE TRIGGER (Game Controller) — triggers randomly for one team
        if (giftNameLower.includes("game controller")) {
          const side = Math.random() > 0.5 ? "player" : "enemy";
          useStore.getState().triggerRoulette(msg.username, side);
          return;
        }

        // Helper: find which pool a gift belongs to and which team it triggers
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

        // Check player pool FIRST, then enemy — no overlap
        const match = findMatch("player") || findMatch("enemy");
        if (!match) return;

        const { side, binding } = match;

        const formation = GIFT_FORMATIONS[binding.formationId];
        if (formation) {
          for (const rule of formation.rules) {
            const isBoss = rule.unitClass === "boss" || rule.rarity === "legendary";
            for (let i = 0; i < rule.count; i++) {
              spawnUnit(1, msg.username, side, isBoss, rule.unitClass === "boss" ? undefined : rule.unitClass, msg.profileImage, rule.rarity);
            }
          }
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
          downloadPerfLogs={downloadPerfLogs}
          clearVFXCache={clearVFXCache}
        />
      </div>

      {/* ===== LAYER 2: Leva Debug (Training Mode Only) ===== */}
      {gameMode === 'TRAINING' && (
        <div className="fixed bottom-4 left-4 z-[60] pointer-events-auto w-72">
          <Leva theme={{
            colors: {
              elevation1: '#18181b', elevation2: '#27272a', elevation3: '#3f3f46',
              highlight1: '#6366f1', highlight2: '#818cf8', highlight3: '#4f46e5',
            }
          }} />
        </div>
      )}

    </div>
  );
}
