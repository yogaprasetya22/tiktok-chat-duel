import { TowerConfig } from "@/src/hooks/battle/useBattleSystem";
import {
  Settings2, Sword, Zap, Trophy, Users, MessageSquare, Gift,
  CheckCircle2, Camera, Loader2, AlertTriangle, ChevronRight,
  CloudRain, Wind, CloudLightning, Sun, Shield, X, MessageCircle,
  Activity, RefreshCw, Target
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
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
    top5?: Array<{
      username: string;
      kills: number;
      damage: number;
      spawns: number;
      profileImage?: string;
    }>;
  };
  testingMode: boolean;
  onToggleTesting: () => void;
  displayMessages: any[];
  downloadPerfLogs: () => void;
  clearVFXCache: () => void;
}

const StatusIndicators = React.memo(({ connected }: { connected: boolean }) => {
  const [fps, setFps] = useState(0);
  const [ping, setPing] = useState(0);
  const frameCount = useRef(0);
  const lastTime = useRef(performance.now());

  useEffect(() => {
    let frameId: number;
    const updateStats = () => {
      frameCount.current++;
      const now = performance.now();
      const elapsed = now - lastTime.current;

      if (elapsed >= 1000) {
        setFps(Math.round((frameCount.current * 1000) / elapsed));
        frameCount.current = 0;
        lastTime.current = now;
        
        // Mock ping based on connection
        if (connected) {
          setPing(Math.floor(20 + Math.random() * 30));
        } else {
          setPing(0);
        }
      }
      frameId = requestAnimationFrame(updateStats);
    };

    updateStats();
    return () => cancelAnimationFrame(frameId);
  }, [connected]);

  return (
    <div className="absolute top-3 left-3 flex gap-2 pointer-events-none select-none z-50">
      <div className="hud-glass rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/5">
        <Activity className={`w-3 h-3 ${fps < 30 ? 'text-rose-500' : fps < 55 ? 'text-amber-500' : 'text-emerald-500'}`} />
        <span className="text-[10px] font-black tabular-nums text-white/90">{fps} <span className="text-[7px] text-white/40 uppercase tracking-tighter">fps</span></span>
      </div>
      <div className="hud-glass rounded-lg px-2 py-1 flex items-center gap-1.5 border border-white/5">
        <Zap className={`w-3 h-3 ${ping > 100 ? 'text-rose-500' : 'text-emerald-500'}`} />
        <span className="text-[10px] font-black tabular-nums text-white/90">{ping} <span className="text-[7px] text-white/40 uppercase tracking-tighter">ms</span></span>
      </div>
    </div>
  );
});

// ============================================
// SUB-COMPONENTS (Memoized for performance)
// ============================================

const KillFeed = React.memo(({ killEvents, towerConfig }: { killEvents: any[], towerConfig: any }) => (
  <div className="absolute top-16 left-3 w-48 md:w-56 flex flex-col gap-1 pointer-events-none select-none">
    {killEvents.slice(-3).map((event) => event?.id && (
      <div key={event.id} className="animate-slide-up hud-glass rounded-lg px-2.5 py-1.5 flex items-center gap-2">
        <span className="text-[9px] font-black italic tracking-tight truncate" style={{ color: towerConfig.player.color }}>{event.killer}</span>
        <Sword className="w-2.5 h-2.5 text-rose-500 flex-shrink-0" />
        <span className="text-[9px] font-bold text-white/50 truncate">{event.victim}</span>
      </div>
    ))}
  </div>
));

const Leaderboard = React.memo(({ team, color, name }: { team: 'player' | 'enemy', color: string, name: string }) => {
  const isPlayer = team === 'player';
  const liveStats = useStore(s => s.liveStats);
  const kills = isPlayer ? liveStats.playerKills : liveStats.enemyKills;
  const profileImages = liveStats.profileImages || {};

  return (
    <div className={`absolute top-44 ${isPlayer ? 'left-3' : 'right-3'} w-32 md:w-44 select-none`}>
      <div className="hud-glass rounded-xl p-2 md:p-3 space-y-2 animate-fade-in-scale">
        <div className="flex items-center gap-1.5 border-b border-white/5 pb-1.5">
          <Trophy className="w-3 h-3" style={{ color }} />
          <span className="text-[8px] md:text-[9px] font-black text-white/70 uppercase tracking-widest truncate">{name}</span>
        </div>
        <div className="space-y-1.5">
          {Object.entries(kills || {})
            .sort(([, a]: any, [, b]: any) => b - a)
            .slice(0, 5)
            .map(([username, value], i) => (
              <div key={username} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <div className={`w-4 h-4 md:w-5 md:h-5 rounded flex items-center justify-center font-black text-[7px] md:text-[8px] ${
                    i === 0 ? 'text-white animate-pulse' : 'text-white/30 bg-white/5'
                  }`}
                  style={i === 0 ? { backgroundColor: `${color}44`, borderColor: color, border: '1px solid' } : {}}>
                    {i + 1}
                  </div>
                  {profileImages[username] && (
                    <div className="w-3.5 h-3.5 rounded-full overflow-hidden border border-black/50 flex-shrink-0">
                      <img src={profileImages[username]} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <span className="text-[8px] md:text-[9px] font-black text-white/60 truncate uppercase">{username}</span>
                </div>
                <span className="text-[9px] md:text-[10px] font-black italic pl-1" style={{ color: i === 0 ? color : '#ffffff88' }}>
                  {value as number}
                </span>
              </div>
            ))}
          {Object.keys(kills || {}).length === 0 && (
            <p className="text-[7px] uppercase tracking-[0.15em] text-white/20 font-black text-center py-1">Empty...</p>
          )}
        </div>
      </div>
    </div>
  );
});

const TowerHPBars = React.memo(({ towerConfig }: { towerConfig: TowerConfig }) => {
  const [playerBaseHp, setPlayerHp] = useState(useStore.getState().playerBaseHp);
  const [enemyBaseHp, setEnemyHp] = useState(useStore.getState().enemyBaseHp);
  const [armyCounts, setArmyCounts] = useState(useStore.getState().armyCounts);

  useEffect(() => {
    const unsub = useStore.subscribe((state) => {
      setPlayerHp(state.playerBaseHp);
      setEnemyHp(state.enemyBaseHp);
      setArmyCounts(state.armyCounts);
    });
    return unsub;
  }, []);

  const pWidth = (playerBaseHp / (towerConfig?.baseHp || 1000)) * 100;
  const eWidth = (enemyBaseHp / (towerConfig?.baseHp || 1000)) * 100;

  return (
    <div className="absolute bottom-3 left-3 right-3 pointer-events-none select-none">
      <div className="grid grid-cols-2 gap-2 md:gap-4">
        {/* Team A */}
        <div>
          <div className="flex items-end justify-between mb-1">
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <Shield className="w-2.5 h-2.5 text-indigo-400" />
                <span className="text-[7px] md:text-[8px] uppercase tracking-widest text-white/50 font-black truncate max-w-[70px] md:max-w-none">
                  {towerConfig?.player.name}
                </span>
                {towerConfig?.player.score !== undefined && towerConfig.player.score > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[6px] font-black border border-indigo-500/30 ml-1">
                    ★ {towerConfig.player.score}
                  </span>
                )}
              </div>
              <span className="text-base md:text-xl font-black italic text-white tabular-nums leading-none">
                {playerBaseHp.toLocaleString()}
                <span className="text-[7px] md:text-[8px] text-indigo-400 not-italic ml-0.5">HP</span>
              </span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 hud-glass rounded text-[7px] font-black text-indigo-300">
              <Users className="w-2 h-2" /> {armyCounts.player}
            </div>
          </div>
          <div className="h-2.5 md:h-3 bg-black/60 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out relative"
              style={{ width: `${pWidth}%`, backgroundColor: towerConfig?.player.color, boxShadow: `0 0 12px ${towerConfig?.player.color}44` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
            </div>
          </div>
        </div>

        {/* Team B */}
        <div>
          <div className="flex items-end justify-between mb-1">
            <div className="flex items-center gap-1 px-1.5 py-0.5 hud-glass rounded text-[7px] font-black text-rose-300">
              <Users className="w-2 h-2" /> {armyCounts.enemy}
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 mb-0.5">
                {towerConfig?.enemy.score !== undefined && towerConfig.enemy.score > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[6px] font-black border border-rose-500/30 mr-1">
                    ★ {towerConfig.enemy.score}
                  </span>
                )}
                <span className="text-[7px] md:text-[8px] uppercase tracking-widest text-white/50 font-black truncate max-w-[70px] md:max-w-none">
                  {towerConfig?.enemy.name}
                </span>
                <Shield className="w-2.5 h-2.5 text-rose-400" />
              </div>
              <span className="text-base md:text-xl font-black italic text-white tabular-nums leading-none">
                <span className="text-[7px] md:text-[8px] text-rose-400 not-italic mr-0.5">HP</span>
                {enemyBaseHp.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="h-2.5 md:h-3 bg-black/60 rounded-full overflow-hidden border border-white/5">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out relative ml-auto"
              style={{ width: `${eWidth}%`, backgroundColor: towerConfig?.enemy.color, boxShadow: `0 0 12px ${towerConfig?.enemy.color}44` }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

const ChatOverlay = React.memo(({ messages, onClose }: { messages: any[], onClose: () => void }) => (
  <div className="absolute top-14 right-3 bottom-16 w-64 md:w-72 pointer-events-auto select-none animate-fade-in-scale">
    <div className="hud-glass rounded-2xl h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-white/80">Live Chat</span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md transition-colors">
          <X className="w-3 h-3 text-white/40" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scroll-smooth flex flex-col justify-end">
        <div className="space-y-1.5 flex flex-col">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center py-20">
              <p className="text-[9px] text-zinc-600 font-bold italic">Waiting for messages...</p>
            </div>
          ) : (
            messages.slice(-15).map((msg) => (
              <div key={msg.id} className="bg-black/30 p-2 rounded-lg flex gap-2 animate-slide-up border border-white/5 backdrop-blur-md">
                <div className="w-5 h-5 rounded-full bg-zinc-800 flex-shrink-0 flex items-center justify-center overflow-hidden border border-white/10">
                  {msg.profileImage ? (
                    <img src={msg.profileImage} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[7px] font-bold text-zinc-600">{msg.username[0].toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[8px] font-black text-indigo-400 uppercase truncate">{msg.username}</p>
                  <p className={`text-[10px] font-medium break-words leading-tight ${msg.type === 'gift' ? 'text-pink-400 font-black' : 'text-zinc-300'}`}>
                    {msg.comment}
                  </p>
                </div>
              </div>
            ))
          )}
          {/* Intersection anchor for bottom anchoring */}
          <div className="h-0" />
        </div>
      </div>
    </div>
  </div>
));

// ============================================
// MAIN UI OVERLAY
// ============================================

export const UIOverlay = ({
  towerConfig, setTowerConfig,
  onStart, onConnect,
  connected, loading, error,
  onRestart, isCinematic, onToggleCinematic,
  showChat, onToggleChat,
  mvpData, testingMode, onToggleTesting,
  displayMessages, downloadPerfLogs, clearVFXCache,
}: UIOverlayProps) => {

  const gameState = useStore(s => s.gameState);
  const killEvents = useStore(s => s.killEvents);
  const isSettingsOpen = useStore(s => s.isSettingsOpen);
  const setIsSettingsOpen = useStore(s => s.setIsSettingsOpen);
  const settings = useStore(s => s.settings);
  const weather = useStore(s => s.weather);
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState("");

  const nextStep = () => setStep(s => Math.min(s + 1, 3));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  return (
    <>
      {/* ======== SETUP WIZARD (Modal over canvas) ======== */}
      {gameState === "SETUP" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 pointer-events-auto">
          <div className="w-full max-w-lg hud-glass rounded-3xl p-5 md:p-10 shadow-[0_0_80px_-20px_rgba(99,102,241,0.25)] relative overflow-hidden animate-fade-in-scale">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-600/8 blur-[100px] rounded-full -z-10" />

            {/* Header */}
            <div className="flex flex-col items-center text-center gap-3 mb-6">
              <div className="p-3 bg-indigo-500/15 rounded-2xl text-indigo-400 ring-4 ring-indigo-500/5">
                <Settings2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white italic">Setup Battle</h2>
                <p className="text-zinc-500 text-[9px] uppercase font-bold tracking-[0.2em] mt-1">Step {step} of 3</p>
              </div>
              <div className="flex gap-1.5 w-full max-w-[160px]">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`flex-1 h-1 rounded-full transition-all duration-500 ${step >= i ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-zinc-800'}`} />
                ))}
              </div>
            </div>

            {/* Step 1: TikTok Connection */}
            {step === 1 && (
              <div className="space-y-5 animate-slide-up">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                    <Users className="w-3 h-3" /> Live Interface Sync
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-zinc-600">
                        <span className="text-sm font-black italic">@</span>
                      </div>
                      <input
                        type="text" value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={`w-full bg-black/40 border rounded-xl px-9 py-3.5 text-sm font-bold focus:outline-none transition-all placeholder:text-zinc-800 ${!username ? 'border-amber-500/20' : 'border-white/5 focus:border-indigo-500/40'}`}
                        placeholder="tiktok_username"
                      />
                    </div>
                    <button
                      onClick={() => onConnect(username)} disabled={loading}
                      className={`px-6 py-3.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all active:scale-95 ${connected ? 'bg-green-500/15 text-green-400 border border-green-500/20' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : connected ? <CheckCircle2 className="w-5 h-5 mx-auto" /> : "Sync"}
                    </button>
                  </div>

                  <div className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border transition-all ${connected ? 'bg-green-500/8 border-green-500/15' : error ? 'bg-rose-500/8 border-rose-500/15' : 'bg-black/20 border-white/5'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500 animate-pulse shadow-[0_0_6px_rgba(34,197,94,0.8)]' : error ? 'bg-rose-500' : 'bg-zinc-800'}`} />
                    <span className={`text-[8px] uppercase font-black tracking-widest ${connected ? 'text-green-400' : error ? 'text-rose-400' : 'text-zinc-600'}`}>
                      {loading ? "Connecting..." : connected ? "Live Sync Active" : "Offline"}
                    </span>
                  </div>
                  {error && <p className="text-[8px] font-bold text-rose-500/70 uppercase tracking-widest text-center">{error}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Base HP</label>
                    <input
                      type="number" value={towerConfig.baseHp}
                      onChange={(e) => setTowerConfig(prev => ({ ...prev, baseHp: parseInt(e.target.value) || 1000 }))}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500/30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Max Units</label>
                    <input
                      type="number" value={towerConfig.maxUnits}
                      onChange={(e) => setTowerConfig(prev => ({ ...prev, maxUnits: parseInt(e.target.value) || 20 }))}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500/30"
                    />
                  </div>
                </div>

                <button
                  onClick={nextStep} disabled={!username}
                  className={`w-full py-4 font-black uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${!username ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed' : 'bg-white text-zinc-950 hover:bg-zinc-200'}`}
                >
                  Configure Team A <Sword className="w-4 h-4" />
                </button>

                <Link
                  href="/training"
                  className="w-full py-3 bg-black/30 hover:bg-black/50 rounded-xl flex items-center justify-between px-4 transition-all group border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-rose-500/15 rounded-lg text-rose-500"><Target className="w-3 h-3" /></div>
                    <span className="text-[9px] font-black text-white/60 uppercase tracking-wider">Training Arena</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-zinc-700 group-hover:text-white/50 group-hover:translate-x-0.5 transition-all" />
                </Link>
              </div>
            )}

            {/* Step 2: Team A Config */}
            {step === 2 && (
              <div className="space-y-5 animate-slide-up">
                <div className="p-4 md:p-5 bg-blue-500/5 rounded-2xl border border-blue-500/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-blue-400 uppercase tracking-tighter italic flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Pihak A
                    </h3>
                    <button
                      onClick={() => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, active: !prev.player.active } }))}
                      className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest transition-all ${towerConfig.player.active ? 'bg-green-500/15 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}
                    >
                      {towerConfig.player.active ? "ACTIVE" : "OFF"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Team Name</label>
                      <input type="text" value={towerConfig.player.name}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, name: e.target.value } }))}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-500/30" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Color</label>
                      <div className="flex gap-2 items-center bg-black/40 border border-white/5 rounded-xl px-2 py-1">
                        <input type="color" value={towerConfig.player.color}
                          onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, color: e.target.value } }))}
                          className="w-full h-8 bg-transparent cursor-pointer rounded" />
                        <span className="text-[8px] font-mono text-zinc-600">{towerConfig.player.color.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> Keyword</label>
                      <input type="text" value={towerConfig.player.commentKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, commentKeyword: e.target.value } }))}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-500/30" placeholder="indo" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Gift className="w-2.5 h-2.5" /> Gift</label>
                      <input type="text" value={towerConfig.player.giftKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, giftKeyword: e.target.value } }))}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-500/30" placeholder="rose" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={prevStep} className="flex-1 py-3.5 bg-zinc-800/60 text-white font-black uppercase tracking-widest text-[9px] rounded-xl hover:bg-zinc-700/60 transition-all active:scale-[0.98]">Back</button>
                  <button onClick={nextStep} className="flex-[2] py-3.5 bg-white text-zinc-950 font-black uppercase tracking-widest text-[9px] rounded-xl hover:bg-zinc-200 transition-all active:scale-[0.98]">Continue to B</button>
                </div>
              </div>
            )}

            {/* Step 3: Team B Config */}
            {step === 3 && (
              <div className="space-y-5 animate-slide-up">
                <div className="p-4 md:p-5 bg-red-500/5 rounded-2xl border border-red-500/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-red-400 uppercase tracking-tighter italic flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Pihak B
                    </h3>
                    <button
                      onClick={() => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, active: !prev.enemy.active } }))}
                      className={`px-3 py-1 rounded-full text-[8px] font-black tracking-widest transition-all ${towerConfig.enemy.active ? 'bg-green-500/15 text-green-400' : 'bg-zinc-800 text-zinc-500'}`}
                    >
                      {towerConfig.enemy.active ? "ACTIVE" : "OFF"}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Team Name</label>
                      <input type="text" value={towerConfig.enemy.name}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, name: e.target.value } }))}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-red-500/30" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Color</label>
                      <div className="flex gap-2 items-center bg-black/40 border border-white/5 rounded-xl px-2 py-1">
                        <input type="color" value={towerConfig.enemy.color}
                          onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, color: e.target.value } }))}
                          className="w-full h-8 bg-transparent cursor-pointer rounded" />
                        <span className="text-[8px] font-mono text-zinc-600">{towerConfig.enemy.color.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> Keyword</label>
                      <input type="text" value={towerConfig.enemy.commentKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, commentKeyword: e.target.value } }))}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-red-500/30" placeholder="malay" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Gift className="w-2.5 h-2.5" /> Gift</label>
                      <input type="text" value={towerConfig.enemy.giftKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, giftKeyword: e.target.value } }))}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-red-500/30" placeholder="coffee" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={prevStep} className="flex-1 py-3.5 bg-zinc-800/60 text-white font-black uppercase tracking-widest text-[9px] rounded-xl hover:bg-zinc-700/60 transition-all active:scale-[0.98]">Back</button>
                  <button
                    onClick={onStart} disabled={loading}
                    className={`flex-[2] py-3.5 font-black uppercase tracking-widest text-xs rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${loading ? 'bg-zinc-800 text-zinc-500' : 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-xl shadow-indigo-600/20'}`}
                  >
                    {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> WAITING...</> : <>{!connected && <AlertTriangle className="w-3 h-3 text-amber-500" />} Launch Battle <Sword className="w-4 h-4" /></>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======== IN-GAME HUD ======== */}
      {gameState !== "SETUP" && (
        <>
          {/* Action Buttons — Top Right */}
          <div className="absolute top-3 right-3 flex flex-wrap justify-end gap-1.5 pointer-events-auto z-20">
            <button onClick={onToggleTesting}
              className={`p-2 rounded-lg hud-glass transition-all ${testingMode ? 'bg-amber-500/30 text-white shadow-[0_0_10px_rgba(245,158,11,0.4)]' : 'text-white/40 hover:text-white'}`}
              title="Testing Mode">
              <Zap className={`w-4 h-4 ${testingMode ? 'animate-pulse' : ''}`} />
            </button>
            <button onClick={onToggleChat}
              className={`p-2 rounded-lg hud-glass transition-all ${showChat ? 'bg-pink-500/30 text-white shadow-[0_0_10px_rgba(236,72,153,0.4)]' : 'text-white/40 hover:text-white'}`}
              title="Toggle Chat">
              <MessageSquare className="w-4 h-4" />
            </button>
            <button onClick={onToggleCinematic}
              className={`p-2 rounded-lg hud-glass transition-all ${isCinematic ? 'bg-indigo-500/30 text-white' : 'text-white/40 hover:text-white'}`}
              title="Film Mode">
              <Camera className="w-4 h-4" />
            </button>
            <button onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-2 rounded-lg hud-glass transition-all ${isSettingsOpen ? 'bg-indigo-500/30 text-white' : 'text-white/40 hover:text-white'}`}
              title="Settings">
              <Settings2 className="w-4 h-4" />
            </button>
          </div>

          {/* Settings Panel — Bottom Left */}
          {isSettingsOpen && (
            <div className="absolute bottom-16 left-3 z-30 pointer-events-auto w-56 md:w-72 animate-fade-in-scale">
              <div className="hud-glass rounded-2xl p-3 space-y-2">
                <button onClick={downloadPerfLogs}
                  className="w-full py-2 bg-indigo-500/8 hover:bg-indigo-500/15 border border-indigo-500/20 rounded-xl flex items-center justify-center gap-2 text-indigo-400 transition-all">
                  <Activity className="w-3 h-3" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Download Perf Report</span>
                </button>
                <button onClick={clearVFXCache}
                  className="w-full py-2 bg-rose-500/8 hover:bg-rose-500/15 border border-rose-500/20 rounded-xl flex items-center justify-center gap-2 text-rose-400 transition-all">
                  <RefreshCw className="w-3 h-3" />
                  <span className="text-[8px] font-black uppercase tracking-widest">Clear VFX Cache</span>
                </button>
              </div>
            </div>
          )}

          {/* Weather Indicator — Top Center */}
          {gameState === 'PLAYING' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none animate-fade-in-scale">
              <div className="hud-glass rounded-xl px-3 py-1.5 flex items-center gap-2">
                {weather === 'CLEAR' && <Sun className="w-3.5 h-3.5 text-yellow-400" />}
                {weather === 'RAIN' && <CloudRain className="w-3.5 h-3.5 text-blue-400" />}
                {weather === 'STORM' && <Wind className="w-3.5 h-3.5 text-slate-400" />}
                {weather === 'THUNDER' && <CloudLightning className="w-3.5 h-3.5 text-purple-400" />}
                <div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-white block leading-tight">
                    {(WEATHER_CONFIG as any)[weather].name}
                  </span>
                  <span className="text-[7px] font-bold text-white/40 uppercase tracking-tight block leading-tight">
                    {(WEATHER_CONFIG as any)[weather].boostText}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Status Indicators — Top Left Corner */}
          <StatusIndicators connected={connected} />

          {/* Kill Feed — Top Left */}
          <KillFeed killEvents={killEvents} towerConfig={towerConfig} />

          {/* Leaderboards — Sides */}
          {gameState === 'PLAYING' && !settings.potatoMode && (
            <>
              <Leaderboard team="player" color={towerConfig.player.color} name={towerConfig.player.name} />
              <Leaderboard team="enemy" color={towerConfig.enemy.color} name={towerConfig.enemy.name} />
            </>
          )}

          {/* HP Bars — Bottom */}
          <TowerHPBars towerConfig={towerConfig} />

          {/* Chat Overlay — Right Side */}
          {showChat && <ChatOverlay messages={displayMessages} onClose={onToggleChat} />}

          {/* Victory/Defeat Screen */}
          {(gameState === "WON" || gameState === "LOST") && (
            <MVPScreen data={mvpData} onRestart={onRestart} isVictory={gameState === "WON"} />
          )}
        </>
      )}
    </>
  );
};
