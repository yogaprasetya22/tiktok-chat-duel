'use client';

import React from 'react';
import { Sword, Shield, Zap, RefreshCw, X, Play, Target, Home } from 'lucide-react';
import { useStore } from '../../hooks/useStore';

interface TrainingPanelProps {
  onSpawnUnit: (type: 'fighter' | 'tank' | 'mage', side: 'player' | 'enemy', isBoss?: boolean) => void;
  onReset: () => void;
  onClose: () => void;
}

export const TrainingPanel = ({ onSpawnUnit, onReset, onClose }: TrainingPanelProps) => {
  const setGameMode = useStore(s => s.setGameMode);

  const UnitButton = ({ type, icon: Icon, label, color, isBoss = false }: any) => (
    <button
      onClick={() => onSpawnUnit(type, 'player', isBoss)}
      className={`group relative flex flex-col items-center gap-3 p-6 rounded-[32px] border border-white/5 bg-zinc-900/50 hover:bg-${color}-500/10 hover:border-${color}-500/30 transition-all duration-500 overflow-hidden active:scale-95`}
    >
      <div className={`p-4 bg-${color}-500/20 rounded-2xl text-${color}-400 group-hover:scale-110 transition-transform duration-500`}>
        <Icon className="w-8 h-8" />
      </div>
      <div className="text-center">
        <span className="block text-xs font-black uppercase tracking-widest text-white/40 group-hover:text-white transition-colors">
          {isBoss ? 'ELITE' : 'SPAWN'}
        </span>
        <h4 className="text-lg font-black italic tracking-tighter uppercase text-white leading-none">
          {label}
        </h4>
      </div>
      {/* Decorative gradient */}
      <div className={`absolute -bottom-10 -right-10 w-24 h-24 bg-${color}-500/10 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity`} />
    </button>
  );

  return (
    <div className="w-full space-y-4 animate-in fade-in slide-in-from-right-4 duration-700">
      <div className="bg-zinc-900/40 backdrop-blur-3xl border border-white/5 rounded-[32px] overflow-hidden">
        
        {/* Header bar - Now as a section header */}
        <div className="px-6 py-4 bg-indigo-600/20 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="p-1.5 bg-indigo-500/20 rounded-lg text-indigo-400">
                <Target className="w-4 h-4" />
             </div>
             <h3 className="text-[10px] font-black italic uppercase tracking-widest text-white/80">Deployment Controls</h3>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Quick Selection Grid */}
          <div className="grid grid-cols-1 gap-3">
            <UnitButton type="fighter" icon={Sword} label="Fighter" color="blue" />
            <UnitButton type="tank" icon={Shield} label="Heavy Tank" color="orange" />
            <UnitButton type="mage" icon={Zap} label="Arch Mage" color="indigo" />
          </div>

          <div className="grid grid-cols-1 gap-3 pt-4 border-t border-white/5">
             {/* Target Spawning */}
             <button
               onClick={() => onSpawnUnit('fighter', 'enemy', true)}
               className="flex items-center gap-4 p-4 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-2xl group transition-all"
             >
                <div className="p-2 bg-rose-500/20 rounded-xl text-rose-500 group-hover:scale-110 transition-transform">
                   <Target className="w-5 h-5" />
                </div>
                <div className="text-left">
                   <span className="block text-[9px] font-black uppercase tracking-widest text-rose-500/60">Practice Target</span>
                   <h4 className="text-xs font-black uppercase text-rose-500">Spawn Dummy</h4>
                </div>
             </button>

             {/* Arena Reset */}
             <button
               onClick={onReset}
               className="flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-700/80 border border-white/5 rounded-2xl group transition-all"
             >
                <RefreshCw className="w-5 h-5 text-zinc-500 group-hover:rotate-180 transition-transform duration-700" />
                <div className="text-left">
                   <span className="block text-[9px] font-black uppercase tracking-widest text-zinc-500">Engine Reset</span>
                   <h4 className="text-xs font-black uppercase text-zinc-300">Clear All Units</h4>
                </div>
             </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 bg-zinc-950/50 border-t border-white/5">
            <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-[0.2em] leading-relaxed">
              Live Simulation: Use settings to tune unit stats mid-fight
            </p>
        </div>
      </div>
    </div>
  );
};
