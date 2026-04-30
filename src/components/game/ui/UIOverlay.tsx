import { TowerConfig } from "@/src/hooks/battle/useBattleSystem";
import { GiftBinding } from "@/src/core/domain/unit.types";
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
import { GIFT_FORMATIONS, lookupGiftByKeyword, GIFT_DICTIONARY } from "@/src/core/logic/gift/giftDictionary";
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
    <div className={`absolute top-56 ${isPlayer ? 'left-3' : 'right-3'} w-32 md:w-44 select-none`}>
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
                  <div className={`w-4 h-4 md:w-5 md:h-5 rounded flex items-center justify-center font-black text-[7px] md:text-[8px] ${i === 0 ? 'text-white animate-pulse' : 'text-white/30 bg-white/5'
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

const Scoreboard = React.memo(({ towerConfig }: { towerConfig: TowerConfig }) => {
  const playerWins = useStore(s => s.playerWins);
  const enemyWins = useStore(s => s.enemyWins);
  const armyCounts = useStore(s => s.armyCounts);

  const totalArmy = Math.max(1, armyCounts.player + armyCounts.enemy);
  const tensionPercent = (armyCounts.player / totalArmy) * 100;

  return (
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center z-40 pointer-events-none select-none w-full max-w-[320px]">
      <div className="w-full bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-2.5">
          {/* Team A Score */}
          <div className="flex flex-col items-start min-w-0 max-w-[40%]">
            <span className="text-[11px] md:text-[13px] font-black uppercase text-indigo-400 tracking-widest mb-0.5 truncate w-full">
              {towerConfig?.player.name || "TEAM A"}
            </span>
            <span className="text-2xl font-black italic text-white leading-none drop-shadow-md">{playerWins}</span>
          </div>

          <div className="px-3 flex flex-col items-center justify-center">
            <span className="text-[10px] font-black italic text-white/30 tracking-tighter">VS</span>
          </div>

          {/* Team B Score */}
          <div className="flex flex-col items-end min-w-0 max-w-[40%] text-right">
            <span className="text-[11px] md:text-[13px] font-black uppercase text-rose-400 tracking-widest mb-0.5 truncate w-full">
              {towerConfig?.enemy.name || "TEAM B"}
            </span>
            <span className="text-2xl font-black italic text-white leading-none drop-shadow-md">{enemyWins}</span>
          </div>
        </div>

        {/* Tension Bar (Tarik Tambang) */}
        <div className="h-2 w-full bg-black/60 flex relative">
          <div className="h-full bg-indigo-500 transition-all duration-500 ease-out relative" style={{ width: `${tensionPercent}%`, boxShadow: '0 0 8px rgba(99,102,241,0.6)' }} />
          <div className="h-full bg-rose-500 transition-all duration-500 ease-out relative" style={{ width: `${100 - tensionPercent}%`, boxShadow: '0 0 8px rgba(244,63,94,0.6)' }} />
        </div>
      </div>
    </div>
  );
});

const FeverTimeOverlay = React.memo(() => {
  const isFeverTime = useStore(s => s.isFeverTime);
  if (!isFeverTime) return null;
  return (
    <div className="absolute inset-0 pointer-events-none z-30 flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0 bg-red-600/10 animate-pulse mix-blend-overlay" />
      <div className="absolute top-1/4 animate-bounce-slow">
        <h1 className="text-6xl md:text-8xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-red-600 drop-shadow-[0_0_30px_rgba(220,38,38,0.8)] uppercase tracking-tighter">
          🔥 FEVER TIME 🔥
        </h1>
        <p className="text-center text-white/90 font-black tracking-[0.3em] uppercase text-sm mt-2 drop-shadow-md">
          2x Speed & Attack!
        </p>
      </div>
    </div>
  );
});

// Unit class descriptions shown in CMD panels
const UNIT_ABILITIES: Record<string, { icon: string; desc: string; skill: string }> = {
  fighter: { icon: '⚔️', desc: 'Pejuang garis depan', skill: 'Cyclone Slash' },
  tank: { icon: '🛡️', desc: 'Benteng pertahanan', skill: 'Fortress Guard' },
  mage: { icon: '✨', desc: 'Serangan jarak jauh', skill: 'Meteor Rain' },
  marksman: { icon: '🎯', desc: 'Sniper dari belakang', skill: 'Tactical Combo' },
  assassin: { icon: '🗡️', desc: 'Pembunuh cepat & licik', skill: 'Shadow Step' },
};

const RARITY_COLOR: Record<string, string> = {
  common: '#94a3b8', elite: '#60a5fa', epic: '#c084fc', legendary: '#fbbf24',
};



// Single compact unit info panel — right side, above leaderboard
const UnitInfoPanel = React.memo(({ towerConfig }: { towerConfig: TowerConfig }) => {
  const pKey = towerConfig.player.commentKeyword;
  const eKey = towerConfig.enemy.commentKeyword;

  return (
    // Menggunakan left-3 dan right-3 agar memenuhi layar, justify-between memisahkan elemen, items-end meratakan bawah
    <div className="absolute bottom-30 left-3 right-3 pointer-events-none select-none flex justify-between items-end">

      {/* KIRI: Unit Guide */}
      <div className="w-48 md:w-56 bg-black/50 backdrop-blur-md rounded-xl border border-white/10 shadow-xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5 bg-gradient-to-r from-amber-500/20 to-transparent">
          <Sword className="w-3 h-3 text-amber-400" />
          <span className="text-[9px] font-black text-white uppercase tracking-widest">Nama Unit</span>
        </div>
        <div className="px-2.5 py-2 flex flex-col gap-1.5">
          {Object.entries(UNIT_ABILITIES).map(([cls, info]) => (
            <div key={cls} className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-[12px] shadow-inner border border-white/5">
                {info.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[9px] font-black text-white capitalize tracking-wide">{cls}</span>
                  <span className="text-[7px] font-bold text-amber-400/80 uppercase">{info.skill}</span>
                </div>
                <div className="text-[8px] text-white/40 leading-tight">{info.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* KANAN: How to Spawn Guide */}
      <div className="w-48 md:w-56 bg-black/50 backdrop-blur-md rounded-xl border border-white/10 shadow-xl overflow-hidden">

        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5 bg-gradient-to-r from-blue-500/20 to-transparent">
          <Zap className="w-3 h-3 text-blue-400" />
          <span className="text-[9px] font-black text-white uppercase tracking-widest">Cara Main</span>
        </div>
        <div className="p-2.5 flex flex-col gap-2">
          {/* Chat Guide */}
          <div>
            <p className="text-[8px] font-bold text-blue-300 mb-1 flex items-center gap-1">
              <MessageSquare className="w-2.5 h-2.5" /> VIA CHAT
            </p>
            <div className="bg-white/5 rounded-lg p-1.5 border border-white/5">
              <p className="text-[13px] text-white/60 leading-relaxed">
                Ketik <span className="text-white font-black">[{pKey}/{eKey}]</span> + <span className="text-white font-black">Nama Unit</span>
              </p>
              <p className="mt-1 text-[10px] text-white/60 uppercase tracking-widest">Contoh: <span className="text-white/60 uppercase tracking-widest">[{pKey} tank] / [{eKey} mage]</span></p>
            </div>
          </div>
          {/* Gift Guide */}
          <div>
            <p className="text-[8px] font-bold text-pink-400 mb-1 flex items-center gap-1">
              <Gift className="w-2.5 h-2.5" /> VIA GIFT (GACHA)
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/20 rounded-lg px-2 py-1">
                <span className="text-[8px] text-amber-200/80 font-bold">1 COIN</span>
                <span className="text-[8px] text-white font-black">MINI GACHA ✨</span>
              </div>
              <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg px-2 py-1">
                <span className="text-[8px] text-purple-200/80 font-bold">&gt;5 COIN</span>
                <span className="text-[8px] text-white font-black">SUPER GACHA 🔥</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
});


const RouletteOverlay = React.memo(() => {
  const rouletteEvent = useStore(s => s.rouletteEvent);
  const [spinState, setSpinState] = useState<"hidden" | "spinning" | "result">("hidden");

  useEffect(() => {
    if (rouletteEvent) {
      setSpinState("spinning");
      const timer = setTimeout(() => {
        setSpinState("result");
        setTimeout(() => setSpinState("hidden"), 1000); // Hide after 1s of showing result
      }, 2000); // 2s spin
      return () => clearTimeout(timer);
    }
  }, [rouletteEvent]);

  if (spinState === "hidden" || !rouletteEvent) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="flex flex-col items-center">
        <h2 className="text-2xl md:text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-500 drop-shadow-[0_0_20px_rgba(252,211,77,0.8)] uppercase tracking-widest mb-4">
          ROULETTE GACHA
        </h2>
        <div className={`w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-yellow-500 shadow-[0_0_30px_rgba(234,179,8,0.6)] flex items-center justify-center overflow-hidden relative bg-black/60`}>
          {spinState === "spinning" ? (
            <div className="w-full h-full border-4 border-dashed border-white rounded-full animate-[spin_0.2s_linear_infinite] opacity-50" />
          ) : (
            <span className="text-5xl animate-bounce">🎁</span>
          )}
          <div className="absolute inset-0 bg-gradient-to-tr from-yellow-500/20 to-transparent mix-blend-overlay" />
        </div>
        <p className="mt-4 text-white font-black uppercase tracking-widest text-sm bg-black/50 px-4 py-1 rounded-full">
          {spinState === "spinning" ? "Spinning..." : "LOCKED IN!"}
        </p>
      </div>
    </div>
  );
});

const VictoryWipe = React.memo(({ state }: { state: string }) => {
  if (state === 'PLAYING' || state === 'SETUP') return null;

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      {/* Intense Initial Flash */}
      <div className="absolute inset-0 bg-white animate-flash-out" />

      {/* Colored Mood Overlay */}
      <div className={`absolute inset-0 ${state === 'WON' ? 'bg-indigo-600/40' : 'bg-rose-600/40'} backdrop-blur-[4px] animate-fade-in`}
        style={{ animationDelay: '0.2s' }} />

      {/* Dynamic Scanlines / Glitch */}
      <div className="absolute inset-0 opacity-30">
        <div className="w-full h-1/2 bg-gradient-to-b from-white/0 via-white/20 to-white/0 absolute top-0 animate-glitch-line-1" />
        <div className="w-full h-1/2 bg-gradient-to-b from-white/0 via-white/10 to-white/0 absolute bottom-0 animate-glitch-line-2" />
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

      {/* ── Gift Info Bar: horizontal strip above HP bars ──────────────────── */}
      {(() => {
        const playerGifts = towerConfig.player.giftBindings || [];
        const enemyGifts = towerConfig.enemy.giftBindings || [];

        if (playerGifts.length === 0 && enemyGifts.length === 0) return null;

        // Fungsi bantuan untuk merender setiap item gift agar kode tidak berulang
        const renderGiftItem = (b: GiftBinding, i: number, teamColor: string) => {
          const formation = GIFT_FORMATIONS[b.formationId];
          if (!formation) return null;
          return (
            <div
              key={i}
              className="flex items-center gap-1.5 bg-black/75 backdrop-blur-sm rounded-lg px-2 py-1 border flex-shrink-0"
              style={{ borderColor: `${teamColor}55` }}
            >
              {/* Team dot */}
              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor }} />
              {/* Gift name */}
              {(() => {
                const giftDef = lookupGiftByKeyword(b.keyword);
                return giftDef?.picture ? (
                  <div className="flex items-center gap-1">
                    <img src={giftDef.picture} alt={b.keyword} className="w-7 h-7 object-contain drop-shadow-md" />
                  </div>
                ) : (
                  <span className="text-pink-400 text-[9px] font-black">🎁</span>
                );
              })()}
              {/* Formation name */}
              {/* <span className="text-amber-300 text-[9px] font-black max-w-[50px] truncate">{formation.name}</span> */}
              {/* Units breakdown */}
              <div className="flex items-center gap-1">
                {formation.rules.map((r, ri) => (
                  <span key={ri} className="text-[8px] font-bold whitespace-nowrap" style={{ color: RARITY_COLOR[r.rarity] }}>
                    {UNIT_ABILITIES[r.unitClass]?.icon}{r.count}
                  </span>
                ))}
              </div>
            </div>
          );
        };

        return (
          <div className="flex items-center justify-between px-36 w-full -mb-10 gap-4">

            {/* Container Kiri: Enemy */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {enemyGifts.map((b, i) => renderGiftItem(b, i, towerConfig.enemy.color))}
            </div>

            {/* Container Kanan: Player */}
            <div className="flex items-center gap-1.5 flex-wrap justify-end text-right">
              {playerGifts.map((b, i) => renderGiftItem(b, i, towerConfig.player.color))}
            </div>

          </div>
        );
      })()}

      <div className="grid grid-cols-2 gap-2 md:gap-4">
        {/* Team A */}
        <div>
          <div className="flex items-end justify-between mb-1">
            <div>
              <div className="flex items-center gap-1 mb-0.5">
                <Shield className="w-2.5 h-2.5 text-indigo-400" />
                <span className="text-[14px] md:text-[18px] uppercase tracking-widest text-white/50 font-black truncate max-w-[70px] md:max-w-none">
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
                <span className="text-[14px] md:text-[18px] text-indigo-400 not-italic ml-0.5">HP</span>
              </span>
            </div>
            <div className="flex items-center gap-1 px-1.5 py-0.5 hud-glass rounded text-[12px] font-black text-indigo-300">
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
            <div className="flex items-center gap-1 px-1.5 py-0.5 hud-glass rounded text-[12px] font-black text-rose-300">
              <Users className="w-2 h-2" /> {armyCounts.enemy}
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 mb-0.5">
                {towerConfig?.enemy.score !== undefined && towerConfig.enemy.score > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[6px] font-black border border-rose-500/30 mr-1">
                    ★ {towerConfig.enemy.score}
                  </span>
                )}
                <span className="text-[14px] md:text-[18px] uppercase tracking-widest text-white/50 font-black truncate max-w-[70px] md:max-w-none">
                  {towerConfig?.enemy.name}
                </span>
                <Shield className="w-2.5 h-2.5 text-rose-400" />
              </div>
              <span className="text-base md:text-xl font-black italic text-white tabular-nums leading-none">
                <span className="text-[14px] md:text-[18px] text-rose-400 not-italic mr-0.5">HP</span>
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
          {/* Autocomplete Datalist for Setup Screen */}
          <datalist id="gift-suggestions">
            {Object.keys(GIFT_DICTIONARY).map((giftName) => (
              <option key={giftName} value={giftName} />
            ))}
          </datalist>
          <div className="w-full max-w-lg hud-glass rounded-3xl p-5 md:p-10 shadow-[0_0_80px_-20px_rgba(99,102,241,0.25)] relative overflow-hidden animate-fade-in-scale">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-indigo-600/8 blur-[100px] rounded-full -z-10" />

            <div className="flex flex-col items-center text-center gap-3 mb-6">
              <div className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 ring-1 ring-white/10 backdrop-blur-md shadow-xl animate-pulse-slow">
                <Settings2 className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white italic drop-shadow-lg">
                  Setup <span className="text-indigo-500">Battle</span>
                </h2>
                <p className="text-zinc-400 text-[10px] uppercase font-black tracking-[0.3em]">Step {step} of 3</p>
              </div>
              <div className="flex gap-2 w-full max-w-[200px] mt-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all duration-700 ${step >= i ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]' : 'bg-white/5'}`} />
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
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> Comment Keyword</label>
                      <input type="text" value={towerConfig.player.commentKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, commentKeyword: e.target.value } }))}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-blue-500/30" placeholder="indo" />
                    </div>
                  </div>

                  {/* DYNAMIC GIFT RULES - TEAM A */}
                  <div className="space-y-2 mt-3 bg-black/20 p-2.5 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1"><Gift className="w-3 h-3 text-pink-400" /> Gift Rules</label>
                      <button
                        onClick={() => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, giftBindings: [...(prev.player.giftBindings || []), { keyword: '', formationId: Object.keys(GIFT_FORMATIONS)[0] }] } }))}
                        className="px-2.5 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/40 rounded-md text-[8px] font-black uppercase transition-colors"
                      >+ Add</button>
                    </div>
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {(towerConfig.player.giftBindings || []).map((binding, idx) => (
                        <div key={idx} className="flex gap-1.5 items-center bg-black/40 p-1.5 rounded-lg border border-white/5">
                          <input type="text" value={binding.keyword} placeholder="gift name"
                            list="gift-suggestions"
                            onChange={(e) => {
                              const newBindings = [...towerConfig.player.giftBindings];
                              newBindings[idx].keyword = e.target.value;
                              setTowerConfig(prev => ({ ...prev, player: { ...prev.player, giftBindings: newBindings } }));
                            }}
                            className="w-[35%] bg-transparent border-b border-white/10 text-[10px] text-white focus:outline-none focus:border-blue-500/50 px-1 placeholder:text-zinc-600" />
                          <span className="text-[8px] text-zinc-500">➔</span>
                          <select value={binding.formationId}
                            onChange={(e) => {
                              const newBindings = [...towerConfig.player.giftBindings];
                              newBindings[idx].formationId = e.target.value;
                              setTowerConfig(prev => ({ ...prev, player: { ...prev.player, giftBindings: newBindings } }));
                            }}
                            className="flex-1 bg-transparent text-[10px] text-white focus:outline-none border-b border-white/10 focus:border-blue-500/50 appearance-none px-1">
                            {Object.entries(GIFT_FORMATIONS).map(([key, form]) => (
                              <option key={key} value={key} className="bg-zinc-900 text-white">{form.name}</option>
                            ))}
                          </select>
                          <button onClick={() => {
                            const newBindings = [...towerConfig.player.giftBindings];
                            newBindings.splice(idx, 1);
                            setTowerConfig(prev => ({ ...prev, player: { ...prev.player, giftBindings: newBindings } }));
                          }} className="text-zinc-500 hover:text-rose-500 transition-colors p-1"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      {(!towerConfig.player.giftBindings || towerConfig.player.giftBindings.length === 0) && (
                        <p className="text-[8px] text-zinc-500 italic text-center py-2">No gift rules configured.</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Camera className="w-2.5 h-2.5" /> Flag Image URL</label>
                    <input type="text" value={towerConfig.player.flagUrl || ''}
                      onChange={(e) => setTowerConfig(prev => ({ ...prev, player: { ...prev.player, flagUrl: e.target.value } }))}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-[10px] font-bold focus:outline-none focus:border-blue-500/30" placeholder="https://..." />
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
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> Comment Keyword</label>
                      <input type="text" value={towerConfig.enemy.commentKeyword}
                        onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, commentKeyword: e.target.value } }))}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-red-500/30" placeholder="malay" />
                    </div>
                  </div>

                  {/* DYNAMIC GIFT RULES - TEAM B */}
                  <div className="space-y-2 mt-3 bg-black/20 p-2.5 rounded-xl border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1"><Gift className="w-3 h-3 text-pink-400" /> Gift Rules</label>
                      <button
                        onClick={() => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, giftBindings: [...(prev.enemy.giftBindings || []), { keyword: '', formationId: Object.keys(GIFT_FORMATIONS)[0] }] } }))}
                        className="px-2.5 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded-md text-[8px] font-black uppercase transition-colors"
                      >+ Add</button>
                    </div>
                    <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {(towerConfig.enemy.giftBindings || []).map((binding, idx) => (
                        <div key={idx} className="flex gap-1.5 items-center bg-black/40 p-1.5 rounded-lg border border-white/5">
                          <input type="text" value={binding.keyword} placeholder="gift name"
                            list="gift-suggestions"
                            onChange={(e) => {
                              const newBindings = [...towerConfig.enemy.giftBindings];
                              newBindings[idx].keyword = e.target.value;
                              setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, giftBindings: newBindings } }));
                            }}
                            className="w-[35%] bg-transparent border-b border-white/10 text-[10px] text-white focus:outline-none focus:border-red-500/50 px-1 placeholder:text-zinc-600" />
                          <span className="text-[8px] text-zinc-500">➔</span>
                          <select value={binding.formationId}
                            onChange={(e) => {
                              const newBindings = [...towerConfig.enemy.giftBindings];
                              newBindings[idx].formationId = e.target.value;
                              setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, giftBindings: newBindings } }));
                            }}
                            className="flex-1 bg-transparent text-[10px] text-white focus:outline-none border-b border-white/10 focus:border-red-500/50 appearance-none px-1">
                            {Object.entries(GIFT_FORMATIONS).map(([key, form]) => (
                              <option key={key} value={key} className="bg-zinc-900 text-white">{form.name}</option>
                            ))}
                          </select>
                          <button onClick={() => {
                            const newBindings = [...towerConfig.enemy.giftBindings];
                            newBindings.splice(idx, 1);
                            setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, giftBindings: newBindings } }));
                          }} className="text-zinc-500 hover:text-rose-500 transition-colors p-1"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ))}
                      {(!towerConfig.enemy.giftBindings || towerConfig.enemy.giftBindings.length === 0) && (
                        <p className="text-[8px] text-zinc-500 italic text-center py-2">No gift rules configured.</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1"><Camera className="w-2.5 h-2.5" /> Flag Image URL</label>
                    <input type="text" value={towerConfig.enemy.flagUrl || ''}
                      onChange={(e) => setTowerConfig(prev => ({ ...prev, enemy: { ...prev.enemy, flagUrl: e.target.value } }))}
                      className="w-full bg-black/40 border border-white/5 rounded-xl px-3 py-2.5 text-[10px] font-bold focus:outline-none focus:border-red-500/30" placeholder="https://..." />
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

          {/* Fever Time Overlay */}
          <FeverTimeOverlay />

          {/* Roulette Overlay */}
          <RouletteOverlay />

          {/* TOP SCOREBOARD (Persistent) */}
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-2xl px-4">
            <Scoreboard towerConfig={towerConfig} />
          </div>

          {/* Weather Indicator — Top Center (Below Scoreboard) */}
          {gameState === 'PLAYING' && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-10 pointer-events-none animate-fade-in-scale">
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

          {/* Unit Info Panel — right side, above leaderboard */}
          {gameState === 'PLAYING' && <UnitInfoPanel towerConfig={towerConfig} />}

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
            <>
              <VictoryWipe state={gameState} />
              <MVPScreen data={mvpData} onRestart={onRestart} isVictory={gameState === "WON"} />
            </>
          )}
        </>
      )}
    </>
  );
};
