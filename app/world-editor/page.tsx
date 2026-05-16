'use client';

import { useRef } from 'react';
import { GameCanvas } from '@/src/components/game/GameCanvas';
import { useBattleSystem } from '@/src/hooks/battle/useBattleSystem';

export default function WorldEditorPage() {
  const {
    unitRegistry,
    towerConfig,
    updateSimulation,
    damageQueue,
    spellsRef,
    mmSpellsRef,
    fighterSpellsRef,
    tankSpellsRef,
    assassinSpellsRef,
    spawnUnit,
    dealPlayerDamage,
    simTimeRef, // Added
  } = useBattleSystem();

  const settingsRef = useRef({
    potatoMode: false,
    vfxQuality: 1,
    bloomIntensity: 0.5,
  });

  return (
    <main className="fixed inset-0 w-full h-full bg-slate-950 overflow-hidden">
      <div className="absolute top-6 left-6 z-[3000] pointer-events-none">
        <h1 className="text-white font-black text-2xl tracking-tighter uppercase italic drop-shadow-lg">
          Seal-M <span className="text-indigo-400">Map Studio</span>
        </h1>
        <p className="text-white/40 text-[10px] font-bold uppercase tracking-[0.2em]">Live Visual Environment Builder</p>
      </div>

      <GameCanvas
        unitRegistry={unitRegistry}
        towerConfig={towerConfig}
        updateSimulation={updateSimulation}
        damageQueue={damageQueue}
        settingsRef={settingsRef}
        spellsRef={spellsRef}
        mmSpellsRef={mmSpellsRef}
        fighterSpellsRef={fighterSpellsRef}
        tankSpellsRef={tankSpellsRef}
        assassinSpellsRef={assassinSpellsRef}
        spawnUnit={spawnUnit}
        dealPlayerDamage={dealPlayerDamage}
        isEditor={true}
        // Missing props added below
        isCinematic={false}
        debug={false}
        mapObstacles={[]}
        setMapObstacles={() => {}}
        simTimeRef={simTimeRef}
      />
    </main>
  );
}
