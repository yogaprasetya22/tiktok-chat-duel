'use client';

import { useEffect, useState, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTikTokLive } from "../../lib/hooks";
import { useBattleSystem } from "../../hooks/useBattleSystem";
import { useStore } from "../../hooks/useStore";
import { GameCanvas } from "../../components/game/GameCanvas";
import { UIOverlay } from "../../components/game/UIOverlay";
import { BattleMonitor } from "../../components/game/BattleMonitor";
import { Brain, MessageCircle, Heart, Gift, Radio, Shield, Sword, Skull, BarChart3, Activity, X } from "lucide-react";

export default function GamePage() {
  const [mounted, setMounted] = useState(false);
  const [isCinematic, setIsCinematic] = useState(false);
  const [showChat, setShowChat] = useState(true);
  const [showMonitor, setShowMonitor] = useState(false);
  const [targetUsername, setTargetUsername] = useState("");
  const [activeUsername, setActiveUsername] = useState("");
  const [testingMode, setTestingMode] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const lastProcessedId = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { messages, connected, error, loading, disconnect } = useTikTokLive(activeUsername);

  const {
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
    syncPerformance,
    unitRegistry,
    stats,
    replayStats,
    downloadReplay,
  } = useBattleSystem();

  const gameState = useStore(s => s.gameState);
  const armyCounts = useStore(s => s.armyCounts);

  // Mode Testing: Rapid Spawn (0.2s) with Underdog Priority
  const countsRef = useRef({ player: 0, enemy: 0 });
  useEffect(() => {
    countsRef.current = { player: armyCounts.player, enemy: armyCounts.enemy };
  }, [armyCounts]);

  useEffect(() => {
    if (!testingMode || gameState !== "PLAYING") return;

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
    if (messages.length === 0) return;

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
    onDownloadReplay: downloadReplay,
    isFullscreen,
    onToggleFullscreen: () => setIsFullscreen(!isFullscreen),
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
            <button
              onClick={disconnect}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <Radio className="w-3 h-3 animate-pulse" />
              Disconnect
            </button>
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
                  <GameCanvas
                    activeUnits={activeUnits}
                    towerConfig={towerConfig}
                    damageTexts={damageTexts}
                    isCinematic={isCinematic}
                    setMapObstacles={setMapObstacles}
                    mapObstacles={mapObstacles}
                    debug={debug}
                    unitRegistry={unitRegistry}
                    syncPerformance={syncPerformance}
                    isFullscreen={isFullscreen}
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

      {/* Floating Battle Monitor Toggle */}
      <button
        onClick={() => setShowMonitor(!showMonitor)}
        className="fixed bottom-6 right-6 z-[1000] p-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-2xl shadow-indigo-500/20 transition-all active:scale-95 group border border-white/20"
      >
        <div className="flex items-center gap-2">
          {showMonitor ? <X size={20} /> : <BarChart3 size={20} />}
          <span className="text-xs font-black uppercase tracking-widest overflow-hidden max-w-0 group-hover:max-w-[100px] transition-all duration-300">
            Monitor
          </span>
        </div>
      </button>

      {showMonitor && (
        <BattleMonitor 
          rawData={replayStats} 
          mode="live"
          onClose={() => setShowMonitor(false)} 
        />
      )}
    </div>
  );
}
