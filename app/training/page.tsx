'use client';

import { useEffect, useState } from "react";
import { useBattleSystem } from "@/src/hooks/battle/useBattleSystem";
import { useStore } from "@/src/state/useStore";
import { GameCanvas } from "@/src/components/game/GameCanvas";
import { TrainingAnalytics } from "@/src/components/game/ui/TrainingAnalytics";
import { Target, RefreshCw, ChevronLeft, Swords, Activity, Zap } from "lucide-react";
import Link from "next/link";
import { useControls, button, folder, Leva } from "leva";


export default function TrainingPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Force TRAINING mode on this page
    useStore.getState().setGameMode('TRAINING');
  }, []);

  const {
    towerConfig,
    setTowerConfig,
    updateSettingsRef,
    spawnUnit,
    resetBattle,
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
    compBuffers,
  } = useBattleSystem();



  const liveStats = useStore(s => s.liveStats);

  // --- Leva Deployment Controls ---
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
        "Spawn Enemy Fighter": button(() => spawnUnit(1, "Training", "enemy", false, "fighter")),
        "Spawn Enemy Tank": button(() => spawnUnit(1, "Training", "enemy", false, "tank")),
        "Spawn Enemy Mage": button(() => spawnUnit(1, "Training", "enemy", false, "mage")),
        "Spawn Enemy Marksman": button(() => spawnUnit(1, "Training", "enemy", false, "marksman")),
        "Spawn Enemy Assassin": button(() => spawnUnit(1, "Training", "enemy", false, "assassin")),
      }),
      "Arena": folder({
        "Clear All Units": button(() => resetBattle()),
      }),

      "Simulation Settings": folder({
        "Game Speed": { value: settingsRef.current.timeScale, min: 0.1, max: 5.0, step: 0.1, onChange: (v) => updateSettingsRef({ timeScale: v }) },
        "Unit Move Speed": { value: settingsRef.current.globalSpeedMultiplier, min: 0.2, max: 3.0, step: 0.1, onChange: (v) => updateSettingsRef({ globalSpeedMultiplier: v }) },
        "Unit HP Scale": { value: settingsRef.current.globalHpMultiplier, min: 0.5, max: 10.0, step: 0.5, onChange: (v) => updateSettingsRef({ globalHpMultiplier: v }) },
        "Lane Swagger": { value: settingsRef.current.laneSwaggerAmp || 1.5, min: 0, max: 4.0, step: 0.1, onChange: (v) => updateSettingsRef({ laneSwaggerAmp: v }) },
        "Attack Cooldown": { value: settingsRef.current.globalAttackCooldown, min: 100, max: 5000, step: 100, onChange: (v) => updateSettingsRef({ globalAttackCooldown: v }) },
      }),
    },
    { collapsed: false }
  );


  if (!mounted) {
    return (
      <div className=" select-none touch-none min-h-screen bg-zinc-950 flex flex-col items-center justify-center space-y-6">
        <div className=" select-none touch-none p-4 bg-indigo-500/10 rounded-3xl animate-pulse">
          <Swords className=" select-none touch-none w-12 h-12 text-indigo-500" />
        </div>
        <div className=" select-none touch-none text-zinc-500 font-black uppercase tracking-[0.4em] text-xs">Loading Training Arena...</div>
      </div>
    );
  }

  return (
    <div className=" select-none touch-none min-h-screen bg-black text-white overflow-hidden flex flex-col">
      <div className=" select-none touch-none absolute bottom-0 left-0 z-[9999] pointer-events-auto">
        <Leva theme={{
          colors: {
            elevation1: '#18181b', // zinc-900
            elevation2: '#27272a', // zinc-800
            elevation3: '#3f3f46', // zinc-700
            highlight1: '#6366f1', // indigo-500
            highlight2: '#818cf8', // indigo-400
            highlight3: '#4f46e5', // indigo-600
          }
        }} />
      </div>

      {/* Premium Training Header */}
      <header className=" select-none touch-none px-8 py-6 bg-zinc-900/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between z-[100]">
        <div className=" select-none touch-none flex items-center gap-6">
          <Link
            href="/game"
            className=" select-none touch-none p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-400 hover:text-white transition-all group"
          >
            <ChevronLeft className=" select-none touch-none w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </Link>
          <div className=" select-none touch-none h-10 w-px bg-white/5" />
          <div className=" select-none touch-none space-y-1">
            <div className=" select-none touch-none flex items-center gap-3">
              <div className=" select-none touch-none p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Target className=" select-none touch-none w-5 h-5" />
              </div>
              <h1 className=" select-none touch-none text-2xl font-black italic tracking-tighter uppercase leading-none">Training Grounds</h1>
            </div>
            <p className=" select-none touch-none text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] flex items-center gap-2">
              <Activity className=" select-none touch-none w-3 h-3 text-emerald-500 animate-pulse" />
              Advanced Unit Diagnostics Active
            </p>
          </div>
        </div>

        <div className=" select-none touch-none flex items-center gap-4">
          <div className=" select-none touch-none px-6 py-3 bg-zinc-800/50 rounded-2xl border border-white/5 hidden md:flex items-center gap-4">
            <div className=" select-none touch-none flex items-center gap-2">
              <Zap className=" select-none touch-none w-4 h-4 text-amber-500" />
              <span className=" select-none touch-none text-xs font-black text-white tabular-nums">SIMULATION READY</span>
            </div>
          </div>
          <button
            onClick={() => window.location.reload()}
            className=" select-none touch-none p-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl text-rose-500 transition-all flex items-center gap-2 text-xs font-black uppercase tracking-widest"
          >
            <RefreshCw className=" select-none touch-none w-4 h-4" /> Full Reset
          </button>
        </div>
      </header>

      {/* Main Training Arena Layout */}
      <main className=" select-none touch-none flex-1 relative flex overflow-hidden">

        {/* Left: Engine & Canvas */}
        <div className=" select-none touch-none flex-1 relative">
          <GameCanvas
            towerConfig={towerConfig}
            setTowerConfig={setTowerConfig}
            isCinematic={false}
            setMapObstacles={() => { }}
            mapObstacles={[]}
            debug={true} // Always show debug in training
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

        {/* Right: Real-time Analytics Sidebar */}
        <aside className=" select-none touch-none w-96 bg-zinc-950 border-l border-white/5 p-8 overflow-y-auto z-[50] space-y-10">
          <TrainingAnalytics
            playerDamage={liveStats.playerDamage}
            simulationTime={simTimeRef.current || 0}
            onReset={resetBattle}
            onDownload={() => { }}
          />

          <div className=" select-none touch-none mt-10 pt-10 border-t border-white/5 space-y-6">
            <h4 className=" select-none touch-none text-[10px] font-black text-zinc-500 uppercase tracking-widest">Training Tips</h4>
            <ul className=" select-none touch-none space-y-4">
              {[
                "Use the ARCH MAGE to test projectile trajectory.",
                "Heavy Tanks have massive HP for durability testing.",
                "Open Settings (Leva) to tune global unit stats mid-fight.",
                "Click 'Clear All' to reset DPS calculations."
              ].map((tip, i) => (
                <li key={i} className=" select-none touch-none flex gap-4 p-4 bg-white/[0.02] rounded-2xl border border-white/5 text-[11px] text-zinc-400 leading-relaxed">
                  <div className=" select-none touch-none w-1.5 h-1.5 rounded-full bg-indigo-500/50 mt-1 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </aside>

      </main>

    </div>
  );
}
