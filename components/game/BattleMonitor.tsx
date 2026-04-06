'use client';

import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  Zap, 
  X,
  FileJson
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';

export interface BattleSnapshot {
  t: number;
  fps: number;
  stats?: {
    p: number;
    e: number;
    tot: number;
    vfx: number;
    aiMs: string;
    drawCalls?: number;
    tri?: number;
    drift?: string;
  };
  u?: any[];
}

interface ProcessedSnapshot {
  t: number;
  fps: number;
  aiMs: number;
  p: number;
  e: number;
  tot: number;
  drawCalls: number;
  tri: number;
  drift: number;
}

interface BattleMonitorProps {
  rawData: BattleSnapshot[];
  mode: 'live' | 'analysis';
  onClose?: () => void;
}

export const BattleMonitor = ({ rawData: liveStats = [], mode: initialMode, onClose }: BattleMonitorProps) => {
  const [mode, setMode] = useState<'live' | 'analysis'>(initialMode);
  const [analysisData, setAnalysisData] = useState<BattleSnapshot[] | null>(null);
  const [activeTab, setActiveTab] = useState<'performance' | 'population'>('performance');

  const rawDataStore = useMemo(() => {
    return mode === 'live' ? (liveStats || []) : (analysisData || []);
  }, [mode, liveStats, analysisData]);

  const processedData = useMemo<ProcessedSnapshot[]>(() => {
    const data = rawDataStore || [];
    return data.map(snapshot => ({
      t: snapshot.t,
      fps: snapshot.fps || 0,
      aiMs: parseFloat(snapshot.stats?.aiMs || "0"),
      p: snapshot.stats?.p || 0,
      e: snapshot.stats?.e || 0,
      tot: snapshot.stats?.tot || 0,
      drawCalls: snapshot.stats?.drawCalls || 0,
      tri: snapshot.stats?.tri || 0,
      drift: parseFloat(snapshot.stats?.drift || "0")
    }));
  }, [rawDataStore]);

  const statsSummary = useMemo(() => {
    if (processedData.length === 0) return { avg: 0, max: 0, guardActive: false, drawCalls: 0, tri: 0, drift: 0 };
    const sum = processedData.reduce((a, b) => a + b.fps, 0);
    const max = processedData.reduce((a, b) => Math.max(a, b.tot), 0);
    const last = processedData[processedData.length - 1];
    return {
      avg: Math.round(sum / processedData.length),
      max: max,
      guardActive: last.fps < 18,
      drawCalls: last.drawCalls,
      tri: last.tri,
      drift: last.drift
    };
  }, [processedData]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        setAnalysisData(json);
        setMode('analysis');
      } catch (err) {
        alert("Error reading JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-4 md:inset-8 bg-zinc-950/98 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] shadow-[0_0_100px_rgba(0,0,0,0.8)] p-8 md:p-12 text-white z-[3000] animate-in zoom-in-95 fade-in duration-500 overflow-hidden flex flex-col border-l-rose-600 border-l-8">
      <div className="flex items-center justify-between mb-10">
        <div className="flex items-center gap-5">
          <div className="bg-gradient-to-br from-rose-500 to-rose-800 p-4 rounded-3xl shadow-rose-600/40 text-white shadow-2xl">
            <Activity size={32} strokeWidth={3} />
          </div>
          <div>
            <h1 className="font-black tracking-tighter text-4xl uppercase italic leading-none mb-2 bg-gradient-to-r from-white to-white/40 bg-clip-text text-transparent">
              War Room Monitor
            </h1>
            <div className="flex items-center gap-3">
               <div className={`w-2.5 h-2.5 rounded-full ${mode === 'live' ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
               <span className="text-xs text-white/50 uppercase font-black tracking-widest">{mode === 'live' ? 'Live Strategic Intelligence' : 'Post-Battle Analysis'}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {statsSummary.guardActive && (
             <div className="bg-rose-500/10 border border-rose-500/30 px-4 py-2 rounded-2xl text-xs font-black text-rose-500 animate-pulse">
                PERFORMANCE GUARD ACTIVE
             </div>
          )}
          <button onClick={onClose} className="p-3 bg-white/5 hover:bg-rose-500 hover:text-white rounded-2xl transition-all border border-white/10"><X size={24} /></button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 mb-8 items-start">
        <div className="xl:col-span-3 flex flex-col gap-3">
           <span className="text-[10px] font-black tracking-widest text-white/30 uppercase ml-1">Analytical Mode</span>
           <div className="flex p-1.5 bg-white/5 rounded-[1.5rem] border border-white/10">
            <button onClick={() => setMode('live')} className={`flex-1 py-4 rounded-[1.2rem] text-xs font-black tracking-widest transition-all ${mode === 'live' ? 'bg-rose-600' : 'text-white/30'}`}>LIVE</button>
            <button onClick={() => setMode('analysis')} className={`flex-1 py-4 rounded-[1.2rem] text-xs font-black tracking-widest transition-all ${mode === 'analysis' ? 'bg-blue-600' : 'text-white/30'}`}>UPLOAD</button>
          </div>
        </div>

        <div className="xl:col-span-9">
          {(mode === 'live' || analysisData) ? (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/5 p-6 rounded-[1.5rem] border border-white/5">
                  <div className="text-[10px] text-white/30 mb-2 uppercase tracking-widest font-black">Stability (FPS)</div>
                  <div className="text-5xl font-black text-green-500">{processedData[processedData.length-1]?.fps || 0}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-[1.5rem] border border-white/5">
                  <div className="text-[10px] text-white/30 mb-2 uppercase tracking-widest font-black">Simulation (AI)</div>
                  <div className="text-5xl font-black text-rose-500">{statsSummary.drift.toFixed(1)}<span className="text-lg ml-1 text-white/20">ms</span></div>
                </div>
                <div className="bg-white/5 p-6 rounded-[1.5rem] border border-white/5">
                  <div className="text-[10px] text-white/30 mb-2 uppercase tracking-widest font-black">Draw (Mesh)</div>
                  <div className="text-5xl font-black text-blue-400">{statsSummary.drawCalls}</div>
                </div>
                <div className="bg-white/5 p-6 rounded-[1.5rem] border border-white/5">
                  <div className="text-[10px] text-white/30 mb-2 uppercase tracking-widest font-black">Triangles</div>
                  <div className="text-5xl font-black text-yellow-400">{statsSummary.tri}k</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-[140px] bg-white/5 rounded-[1.5rem] border border-dashed border-white/10 flex items-center justify-center text-white/20 italic">
               Waiting for data... <input type="file" accept=".json" onChange={handleFileUpload} className="ml-4 text-xs" />
            </div>
          )}
        </div>
      </div>

      {(mode === 'live' || analysisData) && (
        <>
          <div className="flex gap-6 border-b border-white/5 mb-5 px-1 font-black">
            <button onClick={() => setActiveTab('performance')} className={`pb-3 text-[10px] uppercase tracking-widest relative ${activeTab === 'performance' ? 'text-white' : 'text-white/20'}`}>
              Performance {activeTab === 'performance' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-rose-500" />}
            </button>
            <button onClick={() => setActiveTab('population')} className={`pb-3 text-[10px] uppercase tracking-widest relative ${activeTab === 'population' ? 'text-white' : 'text-white/20'}`}>
              Populations {activeTab === 'population' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-rose-500" />}
            </button>
          </div>

          <div className="flex-1 min-h-[300px] w-full bg-black/40 rounded-[2.5rem] p-8 border border-white/5 shadow-inner">
            <ResponsiveContainer width="100%" height="100%">
              {activeTab === 'performance' ? (
                <LineChart data={processedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis hide />
                  <YAxis hide domain={[0, 65]} />
                  <Tooltip contentStyle={{ backgroundColor: '#000', borderRadius: '15px' }} />
                  <Line type="monotone" dataKey="fps" stroke="#22c55e" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="drift" stroke="#f43f5e" strokeWidth={3} dot={false} />
                </LineChart>
              ) : (
                <AreaChart data={processedData}>
                  <XAxis hide />
                  <YAxis hide />
                  <Tooltip contentStyle={{ backgroundColor: '#000', borderRadius: '15px' }} />
                  <Area type="monotone" dataKey="tot" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
};
