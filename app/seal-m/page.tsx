'use client';

import { useState, useEffect } from "react";
import { useBattleSystem } from "@/src/hooks/battle/useBattleSystem";
import { useStore } from "@/src/state/useStore";
import { GameCanvas } from "@/src/components/game/GameCanvas";
import { Play, ShieldCheck, Sparkles, Settings, ShoppingBag, Mail, Pause, RotateCcw } from "lucide-react";

export default function SealMPage() {
  const [mounted, setMounted] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  // Track pointer lock via events – prevents false-positive pause overlay
  const [isPointerLocked, setIsPointerLocked] = useState(false);

  const {
    towerConfig,
    unitRegistry,
    updateSimulation,
    damageQueue,
    settingsRef,
    simTimeRef,
    spellsRef,
    mmSpellsRef,
    fighterSpellsRef,
    tankSpellsRef,
    assassinSpellsRef,
    downloadPerfLogs,
    clearVFXCache,
    compBuffers,
    spawnUnit,
  } = useBattleSystem();



  useEffect(() => {
    setMounted(true);
    useStore.getState().setGameMode('TRAINING');
  }, []);

  // ── Track pointer lock status via browser events (not polling) ──
  useEffect(() => {
    const onLockChange = () => {
      setIsPointerLocked(!!document.pointerLockElement);
    };
    const onLockError = () => {
      setIsPointerLocked(false);
    };

    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    return () => {
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
    };
  }, []);

  const handleStartGame = () => {
    setLoading(true);
    // Set game state BEFORE requesting pointer lock
    useStore.getState().setGameState("PLAYING");

    // Short delay to ensure DOM is ready, then request lock
    setTimeout(() => {
      setGameStarted(true);
      setLoading(false);
      // Request pointer lock after the game is shown
      setTimeout(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.focus();
          canvas.requestPointerLock();
        }
      }, 300);
    }, 1200);
  };

  const handleResume = () => {
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.requestPointerLock();
    }
  };

  const handleRestart = () => {
    setGameStarted(false);
    setIsPointerLocked(false);
    useStore.getState().setGameState("SETUP");
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  };

  if (!mounted) return null;

  // Pause overlay: show ONLY when game is started AND pointer has been locked before but is now lost
  const showPauseOverlay = gameStarted && !isPointerLocked;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans">



      {/* 1. Game Canvas Layer (always mounted, fades in) */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${gameStarted ? 'opacity-100' : 'opacity-25 pointer-events-none'}`}>
        <GameCanvas
          towerConfig={towerConfig}
          isCinematic={false}
          setMapObstacles={() => { }}
          mapObstacles={[]}
          debug={false}
          unitRegistry={unitRegistry}
          isFullscreen={true}
          updateSimulation={updateSimulation}
          damageQueue={damageQueue}
          spawnUnit={spawnUnit}
          settingsRef={settingsRef}
          simTimeRef={simTimeRef}
          spellsRef={spellsRef}
          mmSpellsRef={mmSpellsRef}
          fighterSpellsRef={fighterSpellsRef}
          tankSpellsRef={tankSpellsRef}
          assassinSpellsRef={assassinSpellsRef}
          downloadPerfLogs={downloadPerfLogs}
          clearVFXCache={clearVFXCache}
          compBuffers={compBuffers}
        />

        {/* In-game HUD */}
        {gameStarted && (
          <>
            <div className="absolute top-6 left-6 z-10 pointer-events-none animate-in fade-in duration-1000">
              <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-3 rounded-2xl flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center border border-white/20 shadow-lg shadow-cyan-500/20">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-white/40 uppercase tracking-widest leading-none mb-0.5">Seal M</p>
                  <p className="text-sm font-black text-white italic tracking-tighter leading-none">Clover Knight</p>
                </div>
              </div>
            </div>
            <div className="absolute bottom-6 right-6 z-10 pointer-events-none text-right space-y-1">
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">WASD / Arrow · Move</p>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Mouse · Look Around</p>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">F / E · Attack | ESC · Pause</p>
            </div>
            {/* Restart button */}
            <button
              onClick={handleRestart}
              className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-auto bg-black/40 hover:bg-black/70 backdrop-blur-xl border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 text-white/40 hover:text-white text-[10px] font-black uppercase tracking-widest transition-all opacity-0 hover:opacity-100"
              title="Restart"
            >
              <RotateCcw className="w-3 h-3" />
              Restart
            </button>
          </>
        )}
      </div>

      {/* 2. Splash / Start Screen */}
      {!gameStarted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* Background */}
          <div className="absolute inset-0">
            <img
              src="/assets-model/seal_m_splash.png"
              alt="Seal M Splash"
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/50" />
          </div>

          {/* UI */}
          <div className="relative z-10 flex flex-col items-center justify-end h-full pb-16 w-full max-w-lg px-8">
            <div className="flex flex-col items-center gap-6 animate-in fade-in slide-in-from-bottom-8 duration-700">

              {/* Badge */}
              <div className="bg-cyan-500/20 backdrop-blur-md border border-cyan-500/30 px-5 py-1.5 rounded-full">
                <p className="text-cyan-300 text-[10px] font-black uppercase tracking-[0.3em] flex items-center gap-2">
                  <Sparkles className="w-3 h-3" />
                  Free Roam · 3D Open World
                  <Sparkles className="w-3 h-3" />
                </p>
              </div>

              {/* Title */}
              <div className="text-center">
                <h1 className="text-6xl font-black text-white italic tracking-tighter drop-shadow-2xl leading-none">
                  SEAL M
                </h1>
                <p className="text-white/50 text-sm font-bold tracking-[0.3em] uppercase mt-2">Clover Knight · Chapter 1</p>
              </div>

              {/* Start Button */}
              <button
                onClick={handleStartGame}
                disabled={loading}
                className="group relative w-full max-w-xs"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-2xl blur opacity-50 group-hover:opacity-90 transition duration-500" />
                <div className="relative bg-gradient-to-b from-cyan-400 to-blue-700 px-10 py-5 rounded-2xl border border-white/20 shadow-2xl transform transition group-hover:scale-[1.02] group-active:scale-95 flex items-center justify-center gap-4">
                  {loading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Play className="w-7 h-7 text-white fill-white" />
                      <span className="text-white text-2xl font-black italic tracking-tighter uppercase">
                        Mulai Main
                      </span>
                    </>
                  )}
                </div>
              </button>

              {/* Menu icons */}
              <div className="flex gap-4 mt-2">
                {[
                  { icon: Settings, label: 'Settings' },
                  { icon: ShoppingBag, label: 'Shop' },
                  { icon: ShieldCheck, label: 'Profile' },
                  { icon: Mail, label: 'Mail' }
                ].map((item, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5 group cursor-pointer">
                    <div className="w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center transition-all group-hover:-translate-y-1">
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-tighter text-white/50 group-hover:text-white transition-colors">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div className="text-center">
            <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.4em] animate-pulse">Loading World...</p>
            <p className="text-white/30 text-[10px] font-medium mt-1 tracking-widest uppercase">Growing 300 trees ·  Building terrain</p>
          </div>
        </div>
      )}

      {/* 4. Pause Overlay — only when truly paused (pointer lock lost) */}
      {showPauseOverlay && (
        <div className="absolute inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-zinc-900/95 border border-white/10 px-12 py-10 rounded-3xl text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-300 max-w-sm w-full mx-4">
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center mb-2">
                <Pause className="w-6 h-6 text-cyan-400" />
              </div>
              <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.4em]">Game Paused</p>
              <h2 className="text-white text-3xl font-black italic uppercase tracking-tighter leading-none mt-1">
                PAUSED
              </h2>
              <p className="text-white/40 text-xs font-medium max-w-[180px] mx-auto leading-relaxed mt-1">
                Cursor unlocked. Click below to resume.
              </p>
            </div>

            <button
              onClick={handleResume}
              className="relative w-full group overflow-hidden"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-xl blur opacity-40 group-hover:opacity-80 transition duration-500" />
              <div className="relative bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-white font-black py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-3 text-sm uppercase tracking-widest">
                <Play className="w-4 h-4 fill-white" />
                Resume Game
              </div>
            </button>

            <button
              onClick={handleRestart}
              className="w-full py-3 text-white/30 hover:text-white/70 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3 h-3" />
              Exit to Main Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
