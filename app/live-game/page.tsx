'use client';

import { useEffect, useState, useRef, useMemo } from "react";
import { useTikTokLive } from "@/src/lib/hooks";
import { useBattleSystem } from "@/src/hooks/battle/useBattleSystem";
import { useStore } from "@/src/state/useStore";
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
      const processSpawn = (side: "player" | "enemy") => {
        const config = side === "player" ? towerConfig.player : towerConfig.enemy;
        if (!config.active) return;
        const comment = msg.comment.toLowerCase();
        const commentKey = config.commentKeyword.toLowerCase();
        const giftKey = config.giftKeyword.toLowerCase();

        if (msg.type === "chat") {
          const matches = config.commentType === "exact" ? comment === commentKey : comment.includes(commentKey);
          if (matches) spawnUnit(1, msg.username, side, false, undefined, msg.profileImage);
        } else if (msg.type === "gift") {
          const giftName = msg.giftName?.toLowerCase() || "";
          const isMegaGift = giftName.includes("lion") || giftName.includes("universe") || (msg.diamondCount || 0) >= 100;
          if (isMegaGift) spawnUnit(5, msg.username, side, true, undefined, msg.profileImage);
          else if (giftName.includes(giftKey)) spawnUnit(Math.min(5, Math.ceil((msg.diamondCount || 0) / 5) || 3), msg.username, side, false, undefined, msg.profileImage);
        }
      };

      if (msg.type === "like") {
        cumulativeLikesRef.current += (msg.likeCount || 1);
        if (cumulativeLikesRef.current - likeCounterRef.current >= 1000) {
          likeCounterRef.current += 1000;
          triggerAirstrike(Math.random() > 0.5 ? "player" : "enemy");
        }
      }
      processSpawn("player");
      processSpawn("enemy");
    });
  }, [messages, spawnUnit, towerConfig, gameMode, triggerAirstrike]);

  const displayMessages = useMemo(() => messages.slice(-50).reverse(), [messages]);

  if (!mounted) {
    return (
      <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden touch-none select-none bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-700 uppercase font-black tracking-[0.3em] animate-pulse text-sm">
          Initializing Battle Engine...
        </div>
      </div>
    );
  }

  const mvpData = getMVPData();

  return (
    <div className="fixed inset-0 w-screen h-[100dvh] overflow-hidden touch-none select-none bg-zinc-950">
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
