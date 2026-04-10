'use client';

import React, { useState } from 'react';
import {
  Settings2, Sword, Zap, RefreshCw, X, Shield,
  Wind, Clock, Box, Flame, TrendingUp, Users
} from 'lucide-react';
import { useStore } from '../../hooks/useStore';

interface BattleSettingsPanelProps {
  onClose: () => void;
  onRestart: () => void;
  towerConfig: any;
  setTowerConfig: (cfg: any) => void;
  updateSettingsRef?: (settings: any) => void;
}

export const BattleSettingsPanel = React.memo(({
  onClose,
  onRestart,
  towerConfig,
  setTowerConfig,
  updateSettingsRef
}: BattleSettingsPanelProps) => {
  const settings = useStore(s => s.settings);
  const updateSettings = useStore(s => s.updateSettings);
  const [activeTab, setActiveTab] = useState<'army' | 'world' | 'visuals' | 'positioning'>('army');

  const handleUpdate = (key: string, val: number) => {
    updateSettings({ [key]: val });
  };

  const TabButton = ({ id, label, icon: Icon }: { id: any, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === id
        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
        : 'bg-zinc-800/50 text-zinc-500 hover:text-white'
        }`}
    >
      <Icon className=" w-3.5 h-3.5" />
      {label}
    </button>
  );

  const Slider = React.memo(({ label, value, min, max, step, onChange, icon: Icon, suffix = '' }: any) => {
    const [localValue, setLocalValue] = React.useState(value);

    // Sync from global to local if global changes from outside (e.g. Reset)
    React.useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleChange = (val: number) => {
      setLocalValue(val);

      // Immediate Engine Update (Zero-Lag Bridge)
      if (updateSettingsRef) {
        // Map common slider keys to simulation settings
        const fieldMap: Record<string, string> = {
          'HP Multiplier': 'globalHpMultiplier',
          'Damage Multiplier': 'globalDamageMultiplier',
          'Movement Speed': 'globalSpeedMultiplier',
          'Attack Cooldown': 'globalAttackCooldown',
          'Critical Hit Chance': 'critChance',
          'Time Scale (Simulation Speed)': 'timeScale',
          'Unit Scaling': 'unitScale'
        };
        const mappedKey = fieldMap[label];
        if (mappedKey) updateSettingsRef({ [mappedKey]: val });
      }

      onChange(val); // Sync to global store/parent
    };

    return (
      <div className=" group/slider space-y-3 p-4 bg-zinc-950/50 rounded-2xl border border-white/5 hover:border-indigo-500/30 transition-all duration-300">
        <div className=" flex justify-between items-center">
          <label className=" text-[10px] font-black text-zinc-400 group-hover/slider:text-zinc-200 uppercase tracking-widest flex items-center gap-2 transition-colors">
            {Icon && <Icon className=" w-3 h-3 text-indigo-400" />}
            {label}
          </label>
          <span className=" text-xs font-mono font-bold text-indigo-400">{localValue}{suffix}</span>
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={(e) => handleChange(parseFloat(e.target.value))}
          className=" w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400 transition-all"
        />
      </div>
    );
  });

  return (
    <div className=" fixed inset-0 z-[5000] flex items-center justify-center p-4 md:p-10 bg-zinc-950/90 backdrop-blur-xl animate-in fade-in duration-300 pointer-events-auto">
      <div className=" w-full max-w-2xl bg-zinc-900 border border-indigo-500/20 rounded-[40px] shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className=" p-8 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
          <div className=" flex items-center gap-4">
            <div className=" p-3 bg-indigo-500/20 rounded-2xl text-indigo-400">
              <Settings2 className=" w-7 h-7" />
            </div>
            <div>
              <h3 className=" text-2xl font-black italic uppercase tracking-tighter text-white">Supreme Settings</h3>
              <p className=" text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Real-Time Simulation Tuning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className=" p-3 bg-zinc-800 hover:bg-zinc-700 rounded-2xl text-zinc-400 hover:text-white transition-all"
          >
            <X className=" w-6 h-6" />
          </button>
        </div>

        {/* Tabs Grid */}
        <div className=" px-8 py-4 bg-zinc-900/30 border-b border-white/5">
          <div className=" flex flex-wrap gap-2">
            <TabButton id="army" label="Military" icon={Sword} />
            <TabButton id="world" label="World" icon={Wind} />
            <TabButton id="visuals" label="Visuals" icon={Flame} />
            <TabButton id="positioning" label="Tactics" icon={TrendingUp} />
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className=" flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">

          {activeTab === 'army' && (
            <div className=" space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className=" grid grid-cols-1 md:grid-cols-2 gap-4">
                <Slider icon={Shield} label="HP Multiplier" value={settings.globalHpMultiplier} min={0.1} max={5} step={0.1} onChange={(v: any) => handleUpdate('globalHpMultiplier', v)} suffix="x" />
                <Slider icon={Zap} label="Damage Multiplier" value={settings.globalDamageMultiplier} min={0.1} max={5} step={0.1} onChange={(v: any) => handleUpdate('globalDamageMultiplier', v)} suffix="x" />
                <Slider icon={Wind} label="Movement Speed" value={settings.globalSpeedMultiplier} min={0.1} max={3} step={0.1} onChange={(v: any) => handleUpdate('globalSpeedMultiplier', v)} suffix="x" />
                <Slider icon={Clock} label="Attack Cooldown" value={settings.globalAttackCooldown} min={100} max={2000} step={50} onChange={(v: any) => handleUpdate('globalAttackCooldown', v)} suffix="ms" />
              </div>
              <Slider icon={TrendingUp} label="Critical Hit Chance" value={settings.critChance} min={0} max={1} step={0.05} onChange={(v: any) => handleUpdate('critChance', v)} suffix="x" />

              <div className=" pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
                <div className=" space-y-2">
                  <label className=" text-[10px] font-black text-zinc-500 uppercase tracking-widest">Base Armor (HP)</label>
                  <input
                    type="number"
                    value={towerConfig.baseHp}
                    onChange={(e) => setTowerConfig((p: any) => ({ ...p, baseHp: parseInt(e.target.value) || 1000 }))}
                    className=" w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-indigo-500/50"
                  />
                </div>
                <div className=" space-y-2">
                  <label className=" text-[10px] font-black text-zinc-500 uppercase tracking-widest">Team Unit Cap</label>
                  <input
                    type="number"
                    value={towerConfig.maxUnits}
                    onChange={(e) => setTowerConfig((p: any) => ({ ...p, maxUnits: parseInt(e.target.value) || 20 }))}
                    className=" w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white focus:border-indigo-500/50"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'world' && (
            <div className=" space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <Slider icon={Clock} label="Time Scale (Simulation Speed)" value={settings.timeScale} min={0.1} max={3.0} step={0.1} onChange={(v: any) => handleUpdate('timeScale', v)} suffix="x" />
              <div className=" p-6 bg-indigo-500/10 border border-indigo-500/20 rounded-3xl space-y-3 relative overflow-hidden group/info">
                <div className=" absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent opacity-0 group-hover/info:opacity-100 transition-opacity" />
                <div className=" flex items-center justify-between text-indigo-400 relative">
                  <div className=" flex items-center gap-2">
                    <Zap className=" w-5 h-5 animate-pulse" />
                    <span className=" text-[10px] font-black uppercase tracking-tighter italic">Integrated Engine Tuning</span>
                  </div>
                  <span className=" text-[9px] font-black bg-indigo-500 text-white px-2 py-0.5 rounded-full ring-2 ring-indigo-500/20">LIVE</span>
                </div>
                <p className=" text-[11px] text-zinc-400 font-medium leading-relaxed relative">
                  Slider di atas kini terhubung <span className=" text-white font-bold">langsung ke simulasi</span> untuk performa 60 FPS. Tidak ada lagi hambatan dari proses render DOM.
                </p>
              </div>
              <Slider icon={Box} label="Victory Pause Duration" value={settings.victoryPauseMs} min={100} max={2000} step={100} onChange={(v: any) => handleUpdate('victoryPauseMs', v)} suffix="ms" />
            </div>
          )}

          {activeTab === 'visuals' && (
            <div className=" space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <Slider icon={Box} label="Unit Scale (Character Size)" value={settings.unitScale} min={0.5} max={3.0} step={0.1} onChange={(v: any) => handleUpdate('unitScale', v)} suffix="x" />
              <Slider icon={Flame} label="VFX Intensity" value={settings.vfxIntensity} min={0.1} max={2.0} step={0.1} onChange={(v: any) => handleUpdate('vfxIntensity', v)} suffix="x" />
              <div className=" grid grid-cols-2 gap-4">
                <Slider label="Rotation Smoothing" value={settings.rotationSmoothing} min={0.01} max={0.5} step={0.01} onChange={(v: any) => handleUpdate('rotationSmoothing', v)} />
                <Slider label="Lane Swagger" value={settings.laneSwaggerAmp} min={0} max={1} step={0.05} onChange={(v: any) => handleUpdate('laneSwaggerAmp', v)} />
              </div>
            </div>
          )}

          {activeTab === 'positioning' && (
            <div className=" space-y-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className=" grid grid-cols-2 gap-4">
                <Slider label="Separation Space" value={settings.separationRadius} min={0.1} max={3.0} step={0.1} onChange={(v: any) => handleUpdate('separationRadius', v)} />
                <Slider label="Push Strength" value={settings.separationStrength} min={0.01} max={0.3} step={0.01} onChange={(v: any) => handleUpdate('separationStrength', v)} />
                <Slider label="Combat Encirclement" value={settings.encirclementRadius} min={0.2} max={3.0} step={0.1} onChange={(v: any) => handleUpdate('encirclementRadius', v)} />
                <Slider label="Targeting Lane Penalty" value={settings.lanePenalty} min={0} max={2000} step={50} onChange={(v: any) => handleUpdate('lanePenalty', v)} />
              </div>
              <Slider label="Base Defense Response" value={settings.baseAttackResponseBonus} min={0} max={60000} step={1000} onChange={(v: any) => handleUpdate('baseAttackResponseBonus', v)} />
            </div>
          )}

        </div>

        {/* Footer */}
        <div className=" p-8 border-t border-white/5 bg-zinc-900/80 backdrop-blur-md flex gap-4">
          <button
            onClick={onRestart}
            className=" flex-1 py-5 bg-rose-500 hover:bg-rose-400 text-white rounded-[20px] font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-rose-500/10 flex items-center justify-center gap-3 active:scale-95"
          >
            <RefreshCw className=" w-4 h-4" /> Reset Battle
          </button>
          <button
            onClick={onClose}
            className=" flex-1 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[20px] font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-600/20 active:scale-95"
          >
            Apply & Terminate
          </button>
        </div>
      </div>
    </div>
  );
});
