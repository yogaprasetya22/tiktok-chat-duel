'use client';

import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTikTokLive } from "../../lib/hooks";
import { useBattleSystem } from "../../hooks/useBattleSystem";
import { useStore } from "../../hooks/useStore";
import { GameCanvas } from "../../components/game/GameCanvas";
import { UIOverlay } from "../../components/game/UIOverlay";
import { Brain, MessageCircle, Heart, Gift, Radio, Shield, Sword, Skull, X, Zap, Target, RefreshCw } from "lucide-react";
import { useControls, button, folder, Leva } from "leva";

export default function GamePage() {
  const [mounted, setMounted] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [targetUsername, setTargetUsername] = useState("");
  const [activeUsername, setActiveUsername] = useState("");
  const [testingMode, setTestingMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastProcessedId = useRef<string | null>(null);
  const likeCounterRef = useRef<number>(0);
  const cumulativeLikesRef = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { messages, connected, error, loading, disconnect } = useTikTokLive(activeUsername);

  const {
    towerConfig,
    setTowerConfig,
    updateSettingsRef,
    spawnUnit,
    resetBattle,
    getMVPData,
    setMapObstacles,
    mapObstacles,
    debug,
    setDebug,
    unitRegistry,
    stats,
    triggerAirstrike,
    updateSimulation,
    damageQueue,
    settingsRef,
    simTimeRef,
    vehicles,
    unitIndex,
    spellsRef,
    downloadPerfLogs,
    clearVFXCache,
  } = useBattleSystem();



  const gameState = useStore(s => s.gameState);
  const armyCounts = useStore(s => s.armyCounts);
  const gameMode = useStore(s => s.gameMode);
  const setGameMode = useStore(s => s.setGameMode);

  // --- Leva Deployment Controls (Only in Training) ---
  useControls(
    "deployment",
    {
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
    },
    [gameMode, spawnUnit, resetBattle]
  );

  // Mode Testing: Rapid Spawn (0.2s) with Underdog Priority
  const countsRef = useRef({ player: 0, enemy: 0 });
  useEffect(() => {
    countsRef.current = { player: armyCounts.player, enemy: armyCounts.enemy };
  }, [armyCounts]);

  useEffect(() => {
    if (!testingMode || gameState !== "PLAYING" || gameMode === "TRAINING") return;

    const intervalId = setInterval(() => {
      const { player, enemy } = countsRef.current;
      const isPlayerUnderdog = player < enemy - 10;
      const isEnemyUnderdog = enemy < player - 10;

      const spawnForTeam = (side: "player" | "enemy") => {
        const config = side === "player" ? towerConfig.player : towerConfig.enemy;
        if (!config.active) return;

        // Auto-pause for side that dominates
        if (side === "player" && isEnemyUnderdog && player > 25) return;
        if (side === "enemy" && isPlayerUnderdog && enemy > 25) return;

        // Underdog gets faster reinforcement (3 units)
        const isUnderdog = (side === "player" && isPlayerUnderdog) || (side === "enemy" && isEnemyUnderdog);
        const count = isUnderdog ? 2 : 1; 

        for (let i = 0; i < count; i++) {
          spawnUnit(1, config.name, side);
        }
      };

      // Rapid Fire: 0.2s logic (Alternating sides for visual flow)
      const now = Date.now();
      if (Math.floor(now / 200) % 2 === 0) {
        spawnForTeam("player");
      } else {
        spawnForTeam("enemy");
      }
    }, 200); // 0.2s Mega Rapid Spawn

    return () => clearInterval(intervalId);
  }, [testingMode, gameState, spawnUnit, towerConfig]);

  // Process ALL new TikTok Events for Auto-Battle Spawning
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
          const matches = config.commentType === "exact"
            ? comment === commentKey
            : comment.includes(commentKey);

          if (matches) {
            spawnUnit(1, msg.username, side);
          }
        } else if (msg.type === "gift") {
          const giftName = msg.giftName?.toLowerCase() || "";

          // MEGA BOSS SPAWN: High value gifts
          const isMegaGift = giftName.includes("lion") || giftName.includes("universe") || (msg.diamondCount || 0) >= 100;

          if (isMegaGift) {
            spawnUnit(5, msg.username, side, true);
          } else if (giftName.includes(giftKey)) {
            spawnUnit(Math.min(5, Math.ceil((msg.diamondCount || 0) / 5) || 3), msg.username, side);
          }
        }
      };

      if (msg.type === "like") {
        cumulativeLikesRef.current += (msg.likeCount || 1);
        if (cumulativeLikesRef.current - likeCounterRef.current >= 1000) {
            // ENGAGEMENT MILESTONE: TRIGGER AIRSTRIKE
            likeCounterRef.current += 1000;
            // Balance: Damage both sides to keep it chaotic, or just randomize
            triggerAirstrike(Math.random() > 0.5 ? "player" : "enemy");
        }
      }

      processSpawn("player");
      processSpawn("enemy");
    });
  }, [messages, spawnUnit, towerConfig]);

  const displayMessages = useMemo(() => messages.slice(-50).reverse(), [messages]);

  if (!mounted) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-800 uppercase font-black tracking-[0.3em] animate-pulse">Initializing Battle...</div>;
  }

  const mvpData = getMVPData();

  const overlayProps = {
    towerConfig,
    setTowerConfig,
    onSpawn: () => spawnUnit(1, "Owner", "player"),
    onStart: resetBattle,
    onConnect: (user: string) => setActiveUsername(user),
    connected,
    loading,
    error,
    onRestart: resetBattle,
    isCinematic,
    onToggleCinematic: () => setIsCinematic(!isCinematic),
    showChat,
    onToggleChat: () => setShowChat(!showChat),
    mvpData,
    testingMode,
    onToggleTesting: () => setTestingMode(!testingMode),
    onDownloadReplay: () => {}, // Disabled
    isFullscreen,
    onToggleFullscreen: () => setIsFullscreen(!isFullscreen),
    updateSettingsRef,
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white selection:bg-indigo-500/30 selection:text-indigo-200">
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-8">

        {/* Header Section */}
        <header className={`flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5 transition-all duration-500 ${gameState !== 'SETUP' ? 'opacity-50 hover:opacity-100 scale-95 origin-top' : ''}`}>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Brain className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase">
                {towerConfig.player.name} vs {towerConfig.enemy.name}
              </h1>
            </div>
            {gameState === 'SETUP' && (
              <p className="text-zinc-500 font-medium text-[10px] uppercase tracking-widest flex items-center gap-2">
                <Radio className={`w-3 h-3 ${connected ? 'text-green-500 animate-pulse' : 'text-zinc-700'}`} />
                {connected ? `Connected to @${activeUsername}` : 'Waiting for connection...'}
              </p>
            )}
          </div>

          {connected && (
             <div className="flex items-center gap-3">
               <button
                 onClick={() => {
                   const newMode = gameMode === 'BATTLE' ? 'TRAINING' : 'BATTLE';
                   setGameMode(newMode);
                   if (newMode === 'TRAINING') resetBattle();
                 }}
                 className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                   gameMode === 'TRAINING' 
                   ? 'bg-amber-500/10 border-amber-500/50 text-amber-500 hover:bg-amber-500/20' 
                   : 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/20'
                 }`}
               >
                 <Zap className={`w-3 h-3 ${gameMode === 'TRAINING' ? 'animate-pulse' : ''}`} />
                 {gameMode === 'TRAINING' ? 'Exit Training' : 'Mode Latihan'}
               </button>
               <button
                 onClick={disconnect}
                 className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
               >
                 <Radio className="w-3 h-3 animate-pulse" />
                 Disconnect
               </button>
             </div>
          )}
        </header>

        {/* Main Content Area */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          <div className={`${showChat && !isFullscreen ? 'lg:col-span-8' : 'lg:col-span-12'} flex flex-col gap-6 transition-all duration-500`}>
                
            {/* 1. STANDALONE SETUP (Outside Canvas) */}
            {gameState === 'SETUP' && !isFullscreen && (
              <div className="animate-in slide-in-from-top-4 duration-500">
                <UIOverlay {...overlayProps} standalone={true} />
              </div>
            )}

                <div 
                  id="game-canvas-container" 
                  className={`group overflow-hidden transition-all duration-700 ${
                    isFullscreen ? 'fixed inset-0 z-[9999] bg-black rounded-none h-screen w-screen' : 
                    `relative w-full rounded-2xl ${gameState === 'PLAYING' ? 'h-[calc(100vh-200px)]' : (gameState === 'SETUP' ? 'h-[300px] opacity-40 grayscale blur-sm' : 'h-[600px]')}`
                  }`}
                >
                  {gameMode === 'TRAINING' && (
                    <div className="absolute bottom-6 left-6 z-[1200] pointer-events-auto">
                       <Leva theme={{
                          colors: {
                             elevation1: '#18181b', elevation2: '#27272a', elevation3: '#3f3f46',
                             highlight1: '#6366f1', highlight2: '#818cf8', highlight3: '#4f46e5',
                          }
                       }} />
                    </div>
                  )}
                  <GameCanvas
                    towerConfig={towerConfig}
                    setTowerConfig={setTowerConfig}
                    isCinematic={isCinematic}
                    setMapObstacles={setMapObstacles}
                    mapObstacles={mapObstacles}
                    debug={debug}
                    unitRegistry={unitRegistry}
                    isFullscreen={isFullscreen}
                    updateSimulation={updateSimulation}
                    damageQueue={damageQueue}
                    settingsRef={settingsRef}
                    simTimeRef={simTimeRef}
                    vehicles={vehicles}
                    unitIndex={unitIndex}
                    spellsRef={spellsRef}
                    downloadPerfLogs={downloadPerfLogs}
                    clearVFXCache={clearVFXCache}
                  />


    
                  <div className="absolute inset-0 pointer-events-none z-[100]">
                    {(gameState !== 'SETUP' || isFullscreen) && (
                      <UIOverlay {...overlayProps} standalone={false} />
                    )}

                  </div>
                </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900/30 p-4 rounded-xl border border-white/5 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase">{towerConfig.player.name}</span>
                  <p className="text-sm font-medium text-zinc-300">"{towerConfig.player.commentKeyword}" / {towerConfig.player.giftKeyword}</p>
                </div>
              </div>
              <div className="bg-zinc-900/30 p-4 rounded-xl border border-white/5 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-400">
                  <Skull className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase">{towerConfig.enemy.name}</span>
                  <p className="text-sm font-medium text-zinc-300">"{towerConfig.enemy.commentKeyword}" / {towerConfig.enemy.giftKeyword}</p>
                </div>
              </div>
              <div className="bg-zinc-900/30 p-4 rounded-xl border border-white/5 flex gap-4 items-center">
                <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-xs font-bold text-zinc-500 uppercase">Live Stream</span>
                  <p className="text-sm font-medium text-zinc-300">Syncing @{activeUsername || '...'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Live Comments Feed */}
          {showChat && (
            <div className="lg:col-span-4 h-full animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="bg-zinc-900/50 backdrop-blur-xl p-6 rounded-3xl border border-white/10 shadow-2xl h-[calc(100vh-200px)] flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-pink-500/20 rounded-xl text-pink-400">
                      <MessageCircle className="w-5 h-5 animate-pulse" />
                    </div>
                    <h2 className="text-xl font-black italic tracking-tight uppercase underline decoration-pink-500/30">Live Comments</h2>
                  </div>
                  <span className="px-2 py-0.5 bg-zinc-800 rounded text-[10px] font-bold text-zinc-500">{displayMessages.length}/50</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
                  {displayMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                      <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-600">
                        <MessageCircle className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-zinc-500 font-medium italic">Waiting for interactions...</p>
                    </div>
                  ) : (
                    displayMessages.map((msg) => (
                      <div key={msg.id} className="bg-zinc-950/50 p-3 rounded-xl border border-white/5 flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10">
                          {msg.profileImage ? (
                            <img src={msg.profileImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-zinc-600">{msg.username[0].toUpperCase()}</span>
                          )}
                        </div>
                        <div className="space-y-0.5 min-w-0 flex-1">
                          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-wider truncate">{msg.username}</p>
                          <p className={`text-sm font-medium ${msg.type === 'gift' ? 'text-pink-400' : 'text-zinc-300'} break-words`}>
                            {msg.comment}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

    </div>
  );
}
