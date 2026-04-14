'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Target, Zap, Activity, TrendingUp, Clock, BarChart2, Trophy, Download } from 'lucide-react';

interface TrainingAnalyticsProps {
   playerDamage: Record<string, number>;
   simulationTime: number; // elapsed seconds
   onReset?: () => void;
   onDownload?: () => void;
}

export const TrainingAnalytics = ({ playerDamage, simulationTime: _simulationTime, onReset: _onReset, onDownload }: TrainingAnalyticsProps) => {
   const [sessionStartTime] = useState(Date.now());
   const [dpsHistory, setDpsHistory] = useState<number[]>([]);
   const [sessionBestDps, setSessionBestDps] = useState(0);
   const [events, setEvents] = useState<{ id: string, msg: string, time: string, type: 'dmg' | 'sys' | 'crit' }[]>([]);


   // Calculate current total damage from all units
   const currentTotal = useMemo(() => {
      return Object.values(playerDamage).reduce((acc, val) => acc + val, 0);
   }, [playerDamage]);

   const dps = useMemo(() => {
      const elapsed = Math.max(1, (Date.now() - sessionStartTime) / 1000);
      return Math.round(currentTotal / elapsed);
   }, [currentTotal, sessionStartTime]);

   const dpsRef = useRef(dps);
   useEffect(() => { dpsRef.current = dps; }, [dps]);

   // Update DPS history and Best Score
   useEffect(() => {
      const timer = setInterval(() => {
         const currentDps = dpsRef.current;
         setDpsHistory(prev => {
            const next = [...prev, currentDps];
            return next.slice(-30);
         });
         setSessionBestDps(prev => Math.max(prev, currentDps));
      }, 1000);
      return () => clearInterval(timer);
   }, [sessionStartTime]);


   // Log "Big Hits"
   const lastTotal = useRef(0);
   useEffect(() => {
      if (currentTotal > lastTotal.current + 1000) {
         setEvents(prev => [{
            id: Math.random().toString(36),
            msg: `Burst detected: +${Math.round(currentTotal - lastTotal.current)} DMG`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            type: 'dmg' as const
         }, ...prev].slice(0, 5));

      }
      lastTotal.current = currentTotal;
   }, [currentTotal]);

   const highestDamager = useMemo(() => {
      const entries = Object.entries(playerDamage);
      if (entries.length === 0) return { name: '-', damage: 0 };
      entries.sort((a, b) => b[1] - a[1]);
      return { name: entries[0][0], damage: entries[0][1] };
   }, [playerDamage]);

   // SVG Line Chart Logic
   const graphPoints = useMemo(() => {
      if (dpsHistory.length < 2) return "";
      const maxDps = Math.max(...dpsHistory, 100);
      const height = 40;
      const width = 200;
      const step = width / (dpsHistory.length - 1);
      return dpsHistory.map((val, i) => `${i * step},${height - (val / maxDps) * height}`).join(" ");
   }, [dpsHistory]);


   return (
      <div className=" flex flex-col gap-4 animate-in fade-in slide-in-from-right-4 duration-700">

         {/* Session Title & DPS Badge */}
         <div className=" flex items-center justify-between mb-2">
            <div className=" flex items-center gap-3">
               <div className=" p-2 bg-rose-500/20 rounded-xl text-rose-400">
                  <TrendingUp className=" w-5 h-5" />
               </div>
               <h3 className=" text-xl font-black italic uppercase tracking-tighter text-white">Direct Analytics</h3>
            </div>
            <div className=" flex items-center gap-2">
               {onDownload && (
                  <button
                     onClick={onDownload}
                     className=" p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-zinc-400 hover:text-white transition-all"
                     title="Export Combat Report"
                  >
                     <Download className=" w-4 h-4" />
                  </button>
               )}
               <div className=" px-4 py-1.5 bg-rose-500 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 animate-pulse">
                  LIVE {dps} DPS
               </div>
            </div>
         </div>

         {/* Main Stats Grid */}
         <div className=" grid grid-cols-2 gap-4">

            <div className=" bg-zinc-900/50 backdrop-blur-xl p-5 rounded-[24px] border border-white/5 space-y-1">
               <div className=" flex items-center justify-between">
                  <span className=" text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Damage</span>
                  <Target className=" w-3.5 h-3.5 text-rose-500" />
               </div>
               <div className=" text-3xl font-black text-white tabular-nums">
                  {currentTotal.toLocaleString()}
               </div>
            </div>

            <div className=" bg-zinc-900/50 backdrop-blur-xl p-5 rounded-[24px] border border-white/5 space-y-1">
               <div className=" flex items-center justify-between">
                  <span className=" text-[10px] font-black text-zinc-500 uppercase tracking-widest">Attack Efficiency</span>
                  <Zap className=" w-3.5 h-3.5 text-amber-500" />
               </div>
               <div className=" text-3xl font-black text-white tabular-nums">
                  {Math.round(currentTotal / Math.max(1, Object.keys(playerDamage).length)).toLocaleString()}
               </div>
            </div>

         </div>

         {/* MVP Section */}
         <div className=" bg-indigo-500/10 border border-indigo-500/20 p-6 rounded-[32px] space-y-4">
            <div className=" flex items-center justify-between">
               <div className=" flex items-center gap-3">
                  <BarChart2 className=" w-4 h-4 text-indigo-400" />
                  <span className=" text-[10px] font-black text-indigo-400 uppercase tracking-widest">Performance Graph</span>
               </div>
               {/* SVG Graph */}
               <svg width="100" height="20" viewBox="0 0 200 40" className=" overflow-visible">
                  <polyline
                     fill="none"
                     stroke="#818cf8"
                     strokeWidth="3"
                     strokeLinecap="round"
                     strokeLinejoin="round"
                     points={graphPoints}
                  />
               </svg>
            </div>
            <div className=" flex items-center justify-between">
               <div className=" flex items-center gap-4">
                  <div className=" w-12 h-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center font-black text-xl text-indigo-400">
                     {highestDamager.name[0]?.toUpperCase()}
                  </div>
                  <div>
                     <h4 className=" font-black text-white uppercase italic tracking-tight text-lg">{highestDamager.name}</h4>
                     <p className=" text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Contribution: {Math.round((highestDamager.damage / (currentTotal || 1)) * 100)}%</p>
                  </div>
               </div>
               <div className=" text-right">
                  <span className=" block text-[10px] font-black text-indigo-400/60 uppercase">Dmg Dealt</span>
                  <span className=" text-2xl font-black text-white">{highestDamager.damage.toLocaleString()}</span>
               </div>
            </div>
         </div>

         {/* NEW: Session High Score */}
         <div className=" bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between">
            <div className=" flex items-center gap-3">
               <Trophy className=" w-4 h-4 text-amber-500" />
               <span className=" text-[10px] font-black text-amber-500 uppercase tracking-widest">Session Best DPS</span>
            </div>
            <span className=" text-xl font-black text-white italic tabular-nums">{sessionBestDps.toLocaleString()}</span>
         </div>

         {/* NEW: Combat Activity Feed */}
         <div className=" bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[24px] p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className=" flex items-center gap-2 mb-2">
               <Activity className=" w-3.5 h-3.5 text-zinc-600" />
               <span className=" text-[10px] font-black text-zinc-500 uppercase tracking-widest">Recent Events</span>
            </div>
            <div className=" space-y-2 overflow-y-auto pr-2 custom-scrollbar">
               {events.length === 0 && <p className=" text-[10px] text-zinc-700 font-bold uppercase py-2">Waiting for combat...</p>}
               {events.map(ev => (
                  <div key={ev.id} className=" flex items-center justify-between animate-in fade-in slide-in-from-right-2 py-1 border-b border-white/[0.02]">
                     <div className=" flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${ev.type === 'dmg' ? 'bg-indigo-500' : 'bg-rose-500 animate-pulse'}`} />
                        <span className={`text-[10px] font-bold ${ev.type === 'crit' ? 'text-amber-400 italic' : 'text-zinc-400'}`}>{ev.msg}</span>
                     </div>
                     <span className=" text-[9px] font-medium text-zinc-600 font-mono">{ev.time}</span>
                  </div>
               ))}
            </div>
         </div>


         {/* Combat Activity Summary */}
         <div className=" bg-zinc-900/30 p-4 rounded-2xl border border-white/5 flex items-center justify-between">
            <div className=" flex items-center gap-2">
               <Clock className=" w-3.5 h-3.5 text-zinc-600" />
               <span className=" text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Active Units: {Object.keys(playerDamage).length}</span>
            </div>
            <div className=" flex items-center gap-1">
               <div className=" w-1 h-1 rounded-full bg-green-500" />
               <div className=" w-1 h-1 rounded-full bg-green-500 animate-pulse" />
               <div className=" w-1 h-1 rounded-full bg-green-500/30" />
            </div>
         </div>


      </div>
   );
};
