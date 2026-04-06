'use client';

import { Trophy, Sword, Users, Zap, Skull, RefreshCw } from 'lucide-react';

interface MVPData {
  topDamage: { username: string; value: number } | null;
  topSpawner: { username: string; value: number } | null;
  playerTopHit: { username: string; value: number } | null;
  enemyTopHit: { username: string; value: number } | null;
}

interface MVPScreenProps {
  data: MVPData;
  onRestart: () => void;
  isVictory: boolean;
}

export const MVPScreen = ({ data, onRestart, isVictory }: MVPScreenProps) => {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-2xl animate-in fade-in duration-700 pointer-events-auto">
      <div className="w-full max-w-4xl bg-zinc-900/50 border border-white/10 rounded-[40px] p-8 md:p-12 shadow-[0_0_100px_rgba(79,70,229,0.2)] relative overflow-hidden flex flex-col items-center text-center">
        {/* Background Glow */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-96 blur-[120px] rounded-full -z-10 ${isVictory ? 'bg-indigo-600/10' : 'bg-rose-600/10'}`} />

        <div className={`p-4 rounded-full mb-6 shadow-2xl ${isVictory ? 'bg-indigo-500/20 text-indigo-400' : 'bg-rose-500/20 text-rose-400'}`}>
          <Trophy className="w-12 h-12 animate-bounce" />
        </div>

        <h2 className="text-4xl font-black italic tracking-tighter uppercase text-white mb-1 leading-none">
          {isVictory ? 'BATTLE VICTORY' : 'BATTLE DEFEAT'}
        </h2>
        <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase text-[10px] mb-10">Combat Performance Report</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full mb-10">
          {/* Top Damage */}
          <div className="bg-zinc-950/50 border border-white/5 p-6 rounded-3xl flex flex-col items-center gap-3 transition-all">
            <Sword className="w-5 h-5 text-indigo-400" />
            <div className="space-y-1">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Top Damage</span>
              <p className="text-sm font-black text-white truncate max-w-[120px]">{data.topDamage?.username || 'N/A'}</p>
              <p className="text-xl font-black text-indigo-400 italic leading-none">{data.topDamage?.value.toLocaleString() || 0}</p>
            </div>
          </div>

          {/* Top Spawner */}
          <div className="bg-zinc-950/50 border border-white/5 p-6 rounded-3xl flex flex-col items-center gap-3 transition-all">
            <Users className="w-5 h-5 text-emerald-400" />
            <div className="space-y-1">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Most Spawns</span>
              <p className="text-sm font-black text-white truncate max-w-[120px]">{data.topSpawner?.username || 'N/A'}</p>
              <p className="text-xl font-black text-emerald-400 italic leading-none">{data.topSpawner?.value || 0}</p>
            </div>
          </div>

          {/* Top Player Hitter */}
          <div className="bg-zinc-950/50 border border-indigo-500/20 p-6 rounded-3xl flex flex-col items-center gap-3 transition-all">
            <Zap className="w-5 h-5 text-blue-400" />
            <div className="space-y-1">
              <span className="text-[9px] font-black text-blue-500/60 uppercase tracking-widest leading-none block mb-1">Rank Hit (A)</span>
              <p className="text-sm font-black text-white truncate max-w-[120px]">{data.playerTopHit?.username || 'N/A'}</p>
              <p className="text-xl font-black text-blue-400 italic leading-none">{data.playerTopHit?.value || 0}</p>
            </div>
          </div>

          {/* Top Enemy Hitter */}
          <div className="bg-zinc-950/50 border border-rose-500/20 p-6 rounded-3xl flex flex-col items-center gap-3 transition-all">
            <Skull className="w-5 h-5 text-rose-400" />
            <div className="space-y-1">
              <span className="text-[9px] font-black text-rose-500/60 uppercase tracking-widest leading-none block mb-1">Rank Hit (B)</span>
              <p className="text-sm font-black text-white truncate max-w-[120px]">{data.enemyTopHit?.username || 'N/A'}</p>
              <p className="text-xl font-black text-rose-400 italic leading-none">{data.enemyTopHit?.value || 0}</p>
            </div>
          </div>
        </div>

        <button 
          onClick={onRestart}
          className="w-full max-w-sm py-6 bg-white text-zinc-950 font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-zinc-200 transition-all shadow-2xl flex items-center justify-center gap-3 active:scale-[0.98] animate-in slide-in-from-bottom-8 duration-1000 delay-500"
        >
          NEW BATTLE <RefreshCw className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
