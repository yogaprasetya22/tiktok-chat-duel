'use client';

import { useState, useEffect } from "react";
import { useBattleSystem } from "@/src/hooks/battle/useBattleSystem";
import { useStore } from "@/src/state/useStore";
import { GameCanvas } from "@/src/components/game/GameCanvas";
import { Play, ShieldCheck, Sparkles, Settings, ShoppingBag, Mail } from "lucide-react";

export default function SealMPage() {
  const [mounted, setMounted] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    towerConfig,
    unitRegistry,
    updateSimulation,
    damageQueue,
    settingsRef,
    simTimeRef,
    vehicles,
    unitIndex,
    spellsRef,
    mmSpellsRef,
    fighterSpellsRef,
    tankSpellsRef,
    assassinSpellsRef,
    downloadPerfLogs,
    clearVFXCache,
  } = useBattleSystem();

  useEffect(() => {
    setMounted(true);
    useStore.getState().setGameMode('TRAINING'); 
  }, []);

  const handleStartGame = () => {
    setLoading(true);
    
    // IMMEDIATE request for pointer lock (Browser Security Requirement)
    document.querySelector('canvas')?.focus();
    document.querySelector('canvas')?.requestPointerLock();
    
    // Simulate a premium loading feel
    setTimeout(() => {
      setGameStarted(true);
      setLoading(false);
    }, 1200);
  };

  if (!mounted) return null;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black font-sans">
      
      {/* 1. Underlying Game Layer (Always Mounted) */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${gameStarted ? 'opacity-100' : 'opacity-30'}`}>
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
          settingsRef={settingsRef}
          simTimeRef={simTimeRef}
          vehicles={vehicles}
          unitIndex={unitIndex}
          spellsRef={spellsRef}
          mmSpellsRef={mmSpellsRef}
          fighterSpellsRef={fighterSpellsRef}
          tankSpellsRef={tankSpellsRef}
          assassinSpellsRef={assassinSpellsRef}
          downloadPerfLogs={downloadPerfLogs}
          clearVFXCache={clearVFXCache}
        />

        {/* HUD (Visible only when started) */}
        {gameStarted && (
           <>
            <div className="absolute top-6 left-6 z-10 pointer-events-none animate-in fade-in duration-1000">
                <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-4 rounded-2xl flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-400 flex items-center justify-center overflow-hidden border-2 border-white/20">
                        <img src="/api/placeholder/100/100" alt="Chef Icon" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none mb-1">Clover Knight</p>
                        <p className="text-xl font-black text-white italic tracking-tighter leading-none">SEAL CHEF V1.0</p>
                    </div>
                </div>
            </div>
            <div className="absolute bottom-6 right-6 z-10 pointer-events-none text-right">
                <p className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em]">Mous Look: Enabled | Movement: WASD</p>
            </div>
           </>
        )}
      </div>

      {/* 2. Splash / Start Overlay */}
      {!gameStarted && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
            {/* Background Image Layer */}
            <div className="absolute inset-0">
                <img 
                    src="/assets-model/seal_m_splash.png" 
                    alt="Seal M Splash"
                    className="w-full h-full object-cover opacity-80"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
            </div>

            {/* Interaction Layer */}
            <div className="relative z-10 flex flex-col items-center justify-end h-full pb-20 w-full max-w-4xl px-10">
                <div className="flex flex-col items-center space-y-8 animate-in fade-in slide-in-from-bottom-10 duration-1000">
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-2 rounded-full mb-4">
                        <p className="text-white text-xs font-black uppercase tracking-[0.3em] flex items-center gap-3">
                            <Sparkles className="w-4 h-4 text-yellow-400" />
                                Premium 3D Experience
                            <Sparkles className="w-4 h-4 text-yellow-400" />
                        </p>
                    </div>

                    <button
                        onClick={handleStartGame}
                        disabled={loading}
                        className="group relative flex flex-col items-center justify-center"
                    >
                        <div className="absolute -inset-4 bg-cyan-500/30 rounded-[3rem] blur-2xl group-hover:bg-cyan-500/50 transition-all duration-500 animate-pulse" />
                        <div className="relative bg-gradient-to-b from-cyan-400 to-blue-600 px-16 py-6 rounded-[2rem] border-4 border-white shadow-[0_15px_40px_rgba(0,0,0,0.4)] transform transition-transform group-hover:scale-105 group-active:scale-95 flex items-center gap-4">
                            {loading ? (
                                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <Play className="w-8 h-8 text-white fill-white" />
                                    <span className="text-white text-3xl font-black italic tracking-tighter uppercase drop-shadow-md">
                                        START GAME
                                    </span>
                                </>
                            )}
                        </div>
                    </button>

                    <div className="flex gap-4 mt-12 overflow-x-auto max-w-full pb-4 scrollbar-hide">
                        {[
                            { icon: Settings, label: 'Settings' },
                            { icon: ShoppingBag, label: 'Shop' },
                            { icon: ShieldCheck, label: 'Profile' },
                            { icon: Mail, label: 'Mail' }
                        ].map((item, i) => (
                            <div key={i} className="flex flex-col items-center gap-2 group cursor-pointer">
                                <div className="w-14 h-14 bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center transition-all group-hover:-translate-y-1">
                                    <item.icon className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-tighter text-white/60 group-hover:text-white transition-colors">{item.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* 3. Global Loading / Transition Overlay */}
      {loading && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-6" />
          <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.5em] animate-pulse">Syncing Battle Data...</p>
        </div>
      )}

      {/* 4. Pause / Esc Overlay (In-game) */}
      {gameStarted && mounted && typeof document !== 'undefined' && !document.pointerLockElement && (
          <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
              <div className="relative group p-1 rounded-[2.5rem] bg-gradient-to-b from-white/20 to-transparent border border-white/10 shadow-3xl">
                <div className="bg-zinc-900/90 backdrop-blur-2xl px-12 py-10 rounded-[2.2rem] text-center space-y-6 shadow-2xl animate-in zoom-in-95 duration-300 pointer-events-auto">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-1 bg-cyan-500/50 rounded-full mb-2 animate-pulse" />
                        <p className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.5em]">System Paused</p>
                      </div>
                      
                      <h2 className="text-white text-4xl font-black italic uppercase tracking-tighter leading-none drop-shadow-lg">
                        READY TO <span className="text-cyan-400">FLIGHT?</span>
                      </h2>
                      
                      <p className="text-white/40 text-xs font-medium max-w-[200px] mx-auto leading-relaxed">
                        Control has been disconnected. Click anywhere to re-sync.
                      </p>

                      <button 
                          onClick={() => document.querySelector('canvas')?.requestPointerLock()}
                          className="relative w-full group overflow-hidden"
                      >
                          <div className="absolute -inset-1 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                          <div className="relative bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-white font-black py-5 px-8 rounded-2xl transition-all flex items-center justify-center gap-3">
                              <Play className="w-5 h-5 fill-white" />
                              <span className="uppercase tracking-widest text-sm">Resume Control</span>
                          </div>
                      </button>
                      
                      <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest pt-4">
                        Press ESC again to release
                      </p>
                </div>
              </div>
          </div>
      )}
    </div>
  );
}
