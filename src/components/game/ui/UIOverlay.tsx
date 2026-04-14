import { TowerConfig } from "@/src/hooks/battle/useBattleSystem";
import { Maximize2, Minimize2, Palette, Settings2, Sword, Zap, Trophy, Users, MessageSquare, Gift, CheckCircle2, Camera, Loader2, AlertTriangle, Target, ChevronRight, CloudRain, Wind, CloudLightning, Sun, Shield } from "lucide-react";
import React, { useState } from "react";
import { MVPScreen } from "../../ui/MVPScreen";
import { useStore } from "@/src/state/useStore";
import { WEATHER_CONFIG } from "@/src/core/logic/combat/constants";
import Link from "next/link";

interface UIOverlayProps {
  towerConfig: TowerConfig;
  setTowerConfig: React.Dispatch<React.SetStateAction<TowerConfig>>;
  onSpawn: () => void;
  onStart: () => void;
  onConnect: (username: string) => void;
  connected: boolean;
  loading?: boolean;
  error?: string | null;
  onRestart: () => void;
  isCinematic: boolean;
  onToggleCinematic: () => void;
  showChat: boolean;
  onToggleChat: () => void;
  mvpData: {
    topDamage: { username: string; value: number } | null;
    topSpawner: { username: string; value: number } | null;
    playerTopHit: { username: string; value: number } | null;
    enemyTopHit: { username: string; value: number } | null;
  };
  testingMode: boolean;
  onToggleTesting: () => void;
  onDownloadReplay: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  updateSettingsRef?: (settings: any) => void;
  standalone?: boolean;
}

// Optimization: Memoize KillFeed to prevent full UI re-renders
const MemoizedKillFeed = React.memo(({ killEvents, towerConfig }: { killEvents: any[], towerConfig: any }) => {
  return (
    <div className="absolute top-20 md:top-28 left-4 md:left-6 w-56 md:w-72 flex flex-col gap-1 md:gap-1.5 items-start pointer-events-none z-[1100] select-none touch-none">
      {killEvents.slice(-3).map((event) => event && event.id && (
        <div key={event.id} className="animate-in slide-in-from-left-4 fade-in duration-500 bg-zinc-950/95 px-3 py-1.5 rounded-xl border border-white/10 flex items-center gap-3 shadow-xl">
          <span className="text-white font-black italic text-[10px] tracking-tighter" style={{ color: towerConfig.player.color }}>{event.killer}</span>
          <Sword className="w-3 h-3 text-rose-500" />
          <span className="text-white/60 font-bold text-[9px] tracking-tight">{event.victim}</span>
        </div>
      ))}
    </div>
  );
});

// Optimization: Memoize Leaderboard to prevent full UI re-renders
const MemoizedLeaderboard = React.memo(({ stats, team, color, name }: { stats: any, team: 'player' | 'enemy', color: string, name: string }) => {
  const isPlayer = team === 'player';
  const kills = isPlayer ? stats.playerKills : stats.enemyKills;
  
  return (
    <div className={`absolute top-24 md:top-28 ${isPlayer ? 'left-2 md:left-6' : 'right-2 md:right-6'} w-36 md:w-56 pointer-events-auto z-[1100] select-none touch-none`}>
      <div className={`bg-black/60 backdrop-blur-md rounded-xl md:rounded-3xl border border-white/5 p-2 md:p-4 shadow-xl space-y-2 md:space-y-4 animate-in ${isPlayer ? 'slide-in-from-left-8' : 'slide-in-from-right-8'} duration-1000 group/board hover:bg-black/80 transition-colors`}>
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          {isPlayer ? (
            <>
              <div className="flex items-center gap-1.5 md:gap-2">
                <Trophy className="w-3 md:w-4 h-3 md:h-4 text-indigo-400" />
                <span className="text-[9px] md:text-[11px] font-black text-white/80 uppercase tracking-widest">{name}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 md:gap-2">
                <span className="text-[9px] md:text-[11px] font-black text-white/80 uppercase tracking-widest">{name}</span>
                <Trophy className="w-3 md:w-4 h-3 md:h-4" style={{ color: color }} />
              </div>
            </>
          )}
        </div>
        
        <div className="space-y-4">
          {Object.entries(kills || {})
            .sort(([, a]: any, [, b]: any) => b - a)
            .slice(0, 5)
            .map(([username, value], i) => (
            <div key={username} className={`flex items-center justify-between group animate-in ${isPlayer ? 'slide-in-from-left-4' : 'slide-in-from-right-4'} fade-in`} style={{ animationDelay: `${i * 100}ms` }}>
              {isPlayer ? (
                <>
                  <div className="flex items-center gap-1.5 md:gap-3">
                    <div className={`w-5 h-5 md:w-7 md:h-7 rounded-md md:rounded-lg flex items-center justify-center font-black italic text-[9px] md:text-xs text-white/40 border border-white/5 ${
                      i === 0 ? 'animate-pulse shadow-lg' : 'bg-white/5'
                    }`}
                    style={{ backgroundColor: i === 0 ? `${color}44` : undefined, borderColor: i === 0 ? color : undefined, color: i === 0 ? '#fff' : undefined }}>
                      {i + 1}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-[10px] md:text-xs font-black text-white/70 group-hover:text-white truncate max-w-[60px] md:max-w-[100px] tracking-tight transition-colors">{username}</span>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-0.5">
                      <span className="text-[10px] md:text-xs font-black italic tracking-tighter" style={{ color: i === 0 ? color : '#ffffffaa' }}>{(value as number)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-0.5">
                      <span className="text-[10px] md:text-xs font-black italic tracking-tighter" style={{ color: i === 0 ? color : '#ffffffaa' }}>{(value as number)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-3 flex-1 justify-end min-w-0">
                      <div className="flex flex-col items-end min-w-0">
                        <span className="text-[10px] md:text-xs font-black text-white/70 group-hover:text-white truncate max-w-[60px] md:max-w-[100px] text-right tracking-tight transition-colors">{username}</span>
                      </div>
                    <div className={`w-5 h-5 md:w-7 md:h-7 rounded-md md:rounded-lg flex items-center justify-center font-black italic text-[9px] md:text-xs text-white/40 border border-white/5 flex-shrink-0 ${
                      i === 0 ? 'animate-pulse shadow-lg' : 'bg-white/5'
                    }`}
                    style={{ backgroundColor: i === 0 ? `${color}44` : undefined, borderColor: i === 0 ? color : undefined, color: i === 0 ? '#fff' : undefined }}>
                      {i + 1}
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
          {Object.keys(kills || {}).length === 0 && (
            <div className="py-2 text-center opacity-10">
              <p className="text-[8px] uppercase tracking-[0.2em] text-white font-black">Empty...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const TowerHPBars = React.memo(({ towerConfig }: { towerConfig: TowerConfig }) => {
  const playerBaseHp = useStore(s => s.playerBaseHp);
  const enemyBaseHp = useStore(s => s.enemyBaseHp);
  const armyCounts = useStore(s => s.armyCounts);

  const pWidth = (playerBaseHp / (towerConfig?.baseHp || 1000)) * 100;
  const eWidth = (enemyBaseHp / (towerConfig?.baseHp || 1000)) * 100;

  return (
    <div className="grid grid-cols-2 gap-4 md:gap-8 px-3 md:px-4 w-full select-none touch-none">
      {/* Team A HP */}
      <div className="relative group">
        <div className="flex justify-between items-end mb-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-1 md:gap-2 mb-0.5">
               <Shield className="w-2.5 md:w-3 h-2.5 md:h-3 text-indigo-400" />
               <span className="text-[7px] md:text-[9px] uppercase tracking-[0.2em] text-white/50 font-black truncate max-w-[80px] md:max-w-none">{towerConfig?.player.name} BASE</span>
            </div>
            <span className="text-xl md:text-3xl font-black italic text-white tracking-tighter tabular-nums drop-shadow-2xl">
              {playerBaseHp.toLocaleString()} <span className="text-[8px] md:text-[10px] text-indigo-400 not-italic uppercase tracking-tighter opacity-80">HP</span>
            </span>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-500/10 rounded-md border border-indigo-500/20 mb-1">
               <Users className="w-2.5 h-2.5 text-indigo-400" />
               <span className="text-[9px] font-black text-indigo-300">{armyCounts.player} UNITS</span>
            </div>
          </div>
        </div>
        <div className="h-4 bg-zinc-950/90 rounded-full border border-white/5 p-1 overflow-hidden relative shadow-inner">
          <div 
            className="h-full rounded-full transition-all duration-700 ease-out relative"
            style={{ 
              width: `${pWidth}%`, 
              backgroundColor: towerConfig?.player.color,
              boxShadow: `0 0 20px ${towerConfig?.player.color}44`
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50" />
          </div>
        </div>
      </div>

      {/* Team B HP */}
      <div className="relative group">
        <div className="flex justify-between items-end mb-2">
           <div className="flex flex-col items-start px-2 py-0.5 bg-rose-500/10 rounded-md border border-rose-500/20 mb-1">
              <div className="flex items-center gap-1.5">
                 <Users className="w-2.5 h-2.5 text-rose-400" />
                 <span className="text-[9px] font-black text-rose-300">{armyCounts.enemy} UNITS</span>
              </div>
           </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 md:gap-2 mb-0.5">
               <span className="text-[7px] md:text-[9px] uppercase tracking-[0.2em] text-white/50 font-black truncate max-w-[80px] md:max-w-none">{towerConfig?.enemy.name} BASE</span>
               <Shield className="w-2.5 md:w-3 h-2.5 md:h-3 text-rose-400" />
            </div>
            <span className="text-xl md:text-3xl font-black italic text-white tracking-tighter tabular-nums drop-shadow-2xl">
               <span className="text-[8px] md:text-[10px] text-rose-400 not-italic uppercase tracking-tighter opacity-80">HP</span> {enemyBaseHp.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="h-4 bg-zinc-950/90 rounded-full border border-white/5 p-1 overflow-hidden relative shadow-inner">
          <div 
            className="h-full rounded-full transition-all duration-700 ease-out relative ml-auto"
            style={{ 
              width: `${eWidth}%`, 
              backgroundColor: towerConfig?.enemy.color,
              boxShadow: `0 0 20px ${towerConfig?.enemy.color}44`
            }}
          >
             <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50" />
          </div>
        </div>
      </div>
    </div>
  );
});

export const UIOverlay = ({
  towerConfig,
  setTowerConfig,
  onStart,
  onConnect,
  connected,
  loading,
  error,
  onRestart,
  isCinematic,
  onToggleCinematic,
  showChat,
  onToggleChat,
  mvpData,
  testingMode,
  onToggleTesting,
  isFullscreen,
  onToggleFullscreen,
  standalone,
}: UIOverlayProps) => {
  const gameState = useStore(s => s.gameState);
  const killEvents = useStore(s => s.killEvents);
  const liveStats = useStore(s => s.liveStats);
  const isSettingsOpen = useStore(s => s.isSettingsOpen);
  const setIsSettingsOpen = useStore(s => s.setIsSettingsOpen);
  const settings = useStore(s => s.settings);
  const weather = useStore(s => s.weather);
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));
  const toggleFullscreen = () => {
    const container = document.getElementById('game-canvas-container');
    if (!container) return;

    // Use Virtual Fullscreen AND Native for maximum compatibility
    onToggleFullscreen();

    const doc = document as any;
    const element = container as any;

    if (!doc.fullscreenElement && !doc.webkitFullscreenElement) {
      if (element.requestFullscreen) {
        element.requestFullscreen().catch(() => {});
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      }
    } else {
      if (doc.exitFullscreen) {
        doc.exitFullscreen();
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
    }
  };

  return (
    <div className={`${standalone ? 'relative w-full' : 'absolute inset-0 pointer-events-none'} flex flex-col justify-between z-[1000] select-none touch-none ${isFullscreen ? 'p-0' : 'p-3 md:p-6'}`}>

      {/* Fullscreen & Camera Controls - Top Right - HIDDEN DURING SETUP */}
      {gameState !== 'SETUP' && (
        <div className="absolute top-3 md:top-6 right-3 md:right-6 flex flex-wrap justify-end gap-1.5 md:gap-2 pointer-events-auto z-[1000]">
          <button 
            onClick={onToggleTesting}
            className={`p-2 md:p-3 rounded-lg md:rounded-xl border border-white/10 transition-all ${testingMode ? 'bg-amber-500 text-white shadow-[0_0_15px_rgba(245,158,11,0.5)]' : 'bg-zinc-900/80 text-white/50 hover:text-white'}`}
            title="Testing Mode (Auto-Spawn)"
          >
            <Zap className={`w-4 md:w-5 h-4 md:h-5 ${testingMode ? 'animate-pulse' : ''}`} />
          </button>
          <button 
            onClick={onToggleChat}
            className={`p-2 md:p-3 rounded-lg md:rounded-xl border border-white/10 transition-all ${showChat ? 'bg-pink-500 text-white shadow-[0_0_15px_rgba(236,72,153,0.5)]' : 'bg-zinc-900/80 text-white/50 hover:text-white'}`}
            title={showChat ? "Hide Comments" : "Show Comments"}
          >
            <MessageSquare className="w-4 md:w-5 h-4 md:h-5" />
          </button>
          <button 
            onClick={onToggleCinematic}
            className={`p-2 md:p-3 rounded-lg md:rounded-xl border border-white/10 transition-all ${isCinematic ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-zinc-900/80 text-white/50 hover:text-white'}`}
            title="Film Mode"
          >
            <Camera className="w-4 md:w-5 h-4 md:h-5" />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 md:p-3 rounded-lg md:rounded-xl border border-white/10 transition-all shadow-xl ${isSettingsOpen ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-zinc-900/80 text-white/50 hover:text-white'}`}
            title="Update Configuration"
          >
            <Settings2 className="w-4 md:w-5 h-4 md:h-5" />
          </button>
          <Link
            href="/training"
            className="p-2 md:p-3 bg-rose-500/10 hover:bg-rose-500/20 rounded-lg md:rounded-xl border border-rose-500/20 text-rose-500 transition-all shadow-xl group"
            title="Dedicated Training Arena"
          >
            <Target className="w-4 md:w-5 h-4 md:h-5 group-hover:scale-110 transition-transform" />
          </Link>
          <button 
            onClick={toggleFullscreen}
            className={`p-2 md:p-3 rounded-lg md:rounded-xl border border-white/10 transition-all ${isFullscreen ? 'bg-zinc-100 text-zinc-950' : 'bg-zinc-950/80 text-white/50 hover:text-white'}`}
            title="Fullscreen Canvas"
          >
            {isFullscreen ? <Minimize2 className="w-4 md:w-5 h-4 md:h-5" /> : <Maximize2 className="w-4 md:w-5 h-4 md:h-5" />}
          </button>
        </div>
      )}


      {/* Setup Modal Wizard - SUPREME Z-INDEX */}
      {gameState === "SETUP" && (
        <div className={`${standalone ? 'relative w-full p-0 flex flex-col items-center justify-center' : 'fixed inset-0 z-[2000] flex items-center justify-center p-3 md:p-12 bg-zinc-950/98 animate-in fade-in duration-500'} pointer-events-auto select-none touch-none`}>
          <div className={`w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-3xl md:rounded-[40px] p-6 md:p-16 shadow-[0_0_100px_-20px_rgba(79,70,229,0.3)] space-y-6 md:space-y-10 relative overflow-hidden ${standalone ? 'm-0' : ''}`}>
            {/* Background Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full -z-10" />

            {/* Wizard Header */}
            <div className="flex flex-col items-center text-center gap-4">
              <div className="p-4 bg-indigo-500/20 rounded-3xl text-indigo-400 ring-8 ring-indigo-500/5">
                <Settings2 className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl font-black uppercase tracking-tighter text-white italic">Setup Battle</h2>
                <p className="text-zinc-500 text-xs uppercase font-bold tracking-[0.2em]">Step {step} of 3 • Configuration</p>
              </div>
              <div className="flex gap-2 w-full max-w-[200px] mt-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-500 ${step >= i ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-zinc-800'}`} />
                ))}
              </div>
            </div>

            {/* Step 1: TikTok Connection */}
            {step === 1 && (
              <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                <div className="space-y-4">
                  <label className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center justify-center gap-2">
                    <Users className="w-4 h-4" /> Live Interface Sync
                  </label>
                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1 group">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-zinc-600 group-focus-within:text-indigo-400 transition-colors">
                        <span className="text-lg font-black italic">@</span>
                      </div>
                      <input 
                        type="text" 
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`w-full bg-zinc-950 border-2 rounded-2xl px-12 py-5 text-lg font-bold focus:outline-none transition-all placeholder:text-zinc-800 ${!username ? 'border-amber-500/20' : 'border-white/5 focus:border-indigo-500/50'}`}
                        placeholder="your_tiktok_username"
                      />
                      {!username && (
                        <div className="absolute -bottom-6 left-2 flex items-center gap-1 text-[9px] font-black text-amber-500/60 uppercase tracking-widest animate-pulse">
                          <AlertTriangle className="w-3 h-3" /> Please enter username
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => onConnect(username)}
                      disabled={loading}
                      className={`px-8 rounded-2xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 flex items-center justify-center min-w-[140px] ${connected ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-600/20'}`}
                    >
                      {loading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>SYNCING...</span>
                        </div>
                      ) : (
                        connected ? <CheckCircle2 className="w-6 h-6 mx-auto" /> : "Connect Sync"
                      )}
                    </button>
                  </div>
                  <div className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${connected ? 'bg-green-500/10 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : error ? 'bg-rose-500/10 border-rose-500/20' : 'bg-zinc-950/50 border-white/5'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.8)]' : error ? 'bg-rose-500' : 'bg-zinc-800'}`} />
                      <span className={`text-[10px] uppercase font-black tracking-[0.2em] ${connected ? 'text-green-400' : error ? 'text-rose-400' : 'text-zinc-500'}`}>
                        {loading ? "Establishing connection to TikTok..." : connected ? "Status: Live Sync Active" : "Status: Offline - Connection Optional"}
                      </span>
                    </div>
                    {error && (
                      <div className="text-[9px] font-bold text-rose-500/80 uppercase tracking-widest animate-bounce mt-1">
                        Error: {error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 text-center md:text-left">
                    <label className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                      <Zap className="w-4 h-4" /> Global Tower Stats
                    </label>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Base Health Points (HP)</label>
                      <input 
                        type="number" 
                        value={towerConfig.baseHp}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, baseHp: parseInt(e.target.value) || 1000 }))}
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500/30"
                        placeholder="Default: 1000"
                      />
                    </div>
                  </div>

                  <div className="space-y-4 text-center md:text-left">
                    <label className="text-sm font-black text-zinc-400 uppercase tracking-widest flex items-center justify-center md:justify-start gap-2">
                      <Users className="w-4 h-4 shadow-lg" /> Battle Density
                    </label>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Max Units Per Team</label>
                      <input 
                        type="number" 
                        value={towerConfig.maxUnits}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, maxUnits: parseInt(e.target.value) || 25 }))}
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-indigo-500/30"
                        placeholder="Default: 25"
                      />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={nextStep}
                  disabled={!username}
                  className={`w-full py-6 font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98] ${!username ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed grayscale' : 'bg-white text-zinc-950 hover:bg-zinc-200'}`}
                >
                  Configure Team A <Sword className="w-5 h-5" />
                </button>

                <div className="pt-4 border-t border-white/5">
                   <Link 
                     href="/training"
                     className="w-full py-4 bg-zinc-800/50 hover:bg-zinc-800 rounded-2xl flex items-center justify-between px-6 group transition-all"
                   >
                     <div className="flex items-center gap-4">
                        <div className="p-2 bg-rose-500/20 rounded-xl text-rose-500">
                           <Target className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                           <span className="block text-[8px] font-black text-rose-500/60 uppercase tracking-widest">Solo Analysis</span>
                           <h4 className="text-xs font-black text-white uppercase tracking-tight">Enter Dedicated Training Arena</h4>
                        </div>
                     </div>
                     <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                   </Link>
                </div>
              </div>
            )}

            {/* Step 2: Team A Config */}
            {step === 2 && (
              <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                <div className="p-8 bg-blue-500/5 rounded-[32px] border border-blue-500/10 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-blue-400 uppercase tracking-tighter italic flex items-center gap-3">
                      <Palette className="w-5 h-5 shadow-lg" /> Pihak A Configuration
                    </h3>
                    <button 
                      onClick={() => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, active: !prev.player.active } }))}
                      className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest transition-all ${towerConfig.player.active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}
                    >
                      {towerConfig.player.active ? "ACTIVE" : "DISABLED"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Team Label</label>
                      <input 
                        type="text" 
                        value={towerConfig.player.name}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, name: e.target.value } }))}
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-blue-500/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Theme Color</label>
                      <div className="flex gap-3 items-center bg-zinc-950 border-2 border-white/5 rounded-2xl px-3 py-2">
                        <input 
                          type="color" 
                          value={towerConfig.player.color}
                          onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, color: e.target.value } }))}
                          className="w-full h-10 bg-transparent cursor-pointer rounded-lg"
                        />
                        <span className="text-xs font-mono text-zinc-500">{towerConfig.player.color.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Chat Keyword
                      </label>
                      <input 
                        type="text" 
                        value={towerConfig.player.commentKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, commentKeyword: e.target.value } }))}
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-blue-500/30"
                        placeholder="e.g. indo"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <Gift className="w-3 h-3" /> Gift Keyword
                      </label>
                      <input 
                        type="text" 
                        value={towerConfig.player.giftKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, giftKeyword: e.target.value } }))}
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-blue-500/30"
                        placeholder="e.g. rose"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={prevStep} className="flex-1 py-5 bg-zinc-800 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-700 transition-all active:scale-[0.98]">Back</button>
                  <button onClick={nextStep} className="flex-[2] py-5 bg-white text-zinc-950 font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-200 transition-all shadow-xl active:scale-[0.98]">Continue to B</button>
                </div>
              </div>
            )}

            {/* Step 3: Team B Config */}
            {step === 3 && (
              <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
                <div className="p-8 bg-red-500/5 rounded-[32px] border border-red-500/10 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-red-400 uppercase tracking-tighter italic flex items-center gap-3">
                      <Palette className="w-5 h-5 shadow-lg" /> Pihak B Configuration
                    </h3>
                    <button 
                      onClick={() => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, active: !prev.enemy.active } }))}
                      className={`px-4 py-1.5 rounded-full text-xs font-black tracking-widest transition-all ${towerConfig.enemy.active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}
                    >
                      {towerConfig.enemy.active ? "ACTIVE" : "DISABLED"}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Team Label</label>
                      <input 
                        type="text" 
                        value={towerConfig.enemy.name}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, name: e.target.value } }))}
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-red-500/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Theme Color</label>
                      <div className="flex gap-3 items-center bg-zinc-950 border-2 border-white/5 rounded-2xl px-3 py-2">
                        <input 
                          type="color" 
                          value={towerConfig.enemy.color}
                          onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, color: e.target.value } }))}
                          className="w-full h-10 bg-transparent cursor-pointer rounded-lg"
                        />
                        <span className="text-xs font-mono text-zinc-500">{towerConfig.enemy.color.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Chat Keyword
                      </label>
                      <input 
                        type="text" 
                        value={towerConfig.enemy.commentKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, commentKeyword: e.target.value } }))}
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-red-500/30"
                        placeholder="e.g. malay"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                        <Gift className="w-3 h-3" /> Gift Keyword
                      </label>
                      <input 
                        type="text" 
                        value={towerConfig.enemy.giftKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, giftKeyword: e.target.value } }))}
                        className="w-full bg-zinc-950 border-2 border-white/5 rounded-2xl px-5 py-4 text-sm font-bold focus:outline-none focus:border-red-500/30"
                        placeholder="e.g. coffee"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button onClick={prevStep} className="flex-1 py-5 bg-zinc-800 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-zinc-700 transition-all active:scale-[0.98]">Back</button>
                  <button 
                    onClick={onStart} 
                    disabled={loading}
                    className={`flex-[2] py-5 font-black uppercase tracking-widest rounded-2xl transition-all shadow-2xl text-lg active:scale-[0.98] flex items-center justify-center gap-3 ${loading ? 'bg-zinc-800 text-zinc-500' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-600/30'}`}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        WAITING FOR SYNC...
                      </>
                    ) : (
                      <>
                        {!connected && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                        Launch Battle <Sword className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {gameState !== "SETUP" && (
        <div className="mt-auto pointer-events-auto">
          <div className="flex-1 flex flex-col gap-4">
            {/* Modern Tower HP Bars */}
            <TowerHPBars towerConfig={towerConfig} />

            {/* --- TOP-LEVEL HUD (Outside Canvas Layer) --- */}
            {gameState === 'PLAYING' && (
              <div className="absolute inset-x-0 top-0 h-full pointer-events-none p-8 flex flex-col items-center">
                
                {/* 1. TOP CENTER: Centered HUD Region */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-auto z-[1200]">
                  {/* Weather Indicator (Kill Counter hidden for now) */}
                  <div className="mt-3 flex flex-col items-center animate-in slide-in-from-top-4 duration-1000">
                    <div className="bg-zinc-950/90 px-4 py-1.5 rounded-2xl border border-white/5 flex items-center gap-3">
                       {weather === 'CLEAR' && <Sun className="w-4 h-4 text-yellow-400" />}
                       {weather === 'RAIN' && <CloudRain className="w-4 h-4 text-blue-400" />}
                       {weather === 'STORM' && <Wind className="w-4 h-4 text-slate-400" />}
                       {weather === 'THUNDER' && <CloudLightning className="w-4 h-4 text-purple-400" />}
                       
                       <div className="flex flex-col">
                          <span className="text-[10px] font-black uppercase tracking-widest text-white">
                             Cuaca: {(WEATHER_CONFIG as any)[weather].name}
                          </span>
                          <span className="text-[8px] font-bold text-white/50 uppercase tracking-tight">
                             {(WEATHER_CONFIG as any)[weather].boostText}
                          </span>
                       </div>
                    </div>
                  </div>
                </div>

                {/* 2. TOP LEFT: Compact Kill Feed */}
                <MemoizedKillFeed killEvents={killEvents} towerConfig={towerConfig} />

                 {/* 2. LEFT & RIGHT: Leaderboards (Hidden in Potato Mode) */}
                {!settings.potatoMode && (
                  <>
                    <MemoizedLeaderboard stats={liveStats} team="player" color={towerConfig.player.color} name={towerConfig.player.name} />
                    <MemoizedLeaderboard stats={liveStats} team="enemy" color={towerConfig.enemy.color} name={towerConfig.enemy.name} />
                  </>
                )}
              </div>
            )}

            {/* Victory/Defeat Indicator Overlay - Centered in middle of HUD/Canvas area */}
            {(gameState === "WON" || gameState === "LOST") && (
              <MVPScreen 
                data={mvpData} 
                onRestart={onRestart} 
                isVictory={gameState === "WON"} 
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
