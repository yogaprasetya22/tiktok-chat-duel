'use client';

import { Suspense, useEffect, useRef } from 'react';
import { Trophy, Sword, Users, RefreshCw, Star, Crown } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, Float, Environment } from '@react-three/drei';
import * as THREE from 'three';

interface MVPData {
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
}

interface MVPScreenProps {
  data: MVPData;
  onRestart: () => void;
  isVictory: boolean;
}

const CharacterModel = ({ modelPath }: { modelPath: string }) => {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(modelPath);
  const { actions } = useAnimations(animations, group);

  useEffect(() => {
    // 1. Cari spesifik yang mengandung kata 'victory'
    // 2. Kalau tidak ada, baru cari 'dance' atau 'winning'
    // 3. Kalau tidak ada juga, ambil animasi pertama yang tersedia
    const animationNames = Object.keys(actions);

    const victoryAnim = animationNames.find(n => n.toLowerCase().includes('victory'));
    const backupAnim = animationNames.find(n =>
      n.toLowerCase().includes('dance') ||
      n.toLowerCase().includes('winning')
    );

    const targetAnim = victoryAnim || backupAnim || animationNames[0];

    if (targetAnim && actions[targetAnim]) {
      // Hentikan animasi lain yang mungkin sedang jalan agar tidak bertabrakan
      Object.values(actions).forEach(action => action?.stop());

      actions[targetAnim]
        .reset()
        .setEffectiveTimeScale(1)
        .setEffectiveWeight(1)
        .fadeIn(0.5)
        .play();
    }

    // Cleanup: fade out saat komponen unmount atau path berubah
    return () => {
      if (targetAnim && actions[targetAnim]) {
        actions[targetAnim]!.fadeOut(0.5);
      }
    };
  }, [actions, modelPath]); // Tambahkan modelPath di dependency agar reset saat ganti karakter

  return (
    <group ref={group} scale={0.8} position={[0, -1.2, 0]}>
      <primitive object={scene} />
    </group>
  );
};

export const MVPScreen = ({ data, onRestart, isVictory }: MVPScreenProps) => {
  return (
    <div className="absolute inset-0 z-[150] flex items-center justify-center p-4 pointer-events-auto animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)' }}>

      <div className="w-full max-w-4xl hud-glass rounded-[2.5rem] p-6 md:p-10 relative overflow-hidden flex flex-col md:flex-row items-center gap-8 border border-white/10 shadow-2xl">
        
        {/* Background Decorative Glow */}
        <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-full h-full blur-[120px] rounded-full -z-10 opacity-20 ${isVictory ? 'bg-indigo-600' : 'bg-rose-600'}`} />

        {/* LEFT COLUMN: 3D Visualization */}
        <div className="w-full md:w-1/2 h-64 md:h-[450px] relative flex flex-col items-center justify-center bg-black/40 rounded-3xl border border-white/5 overflow-hidden">
          <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
             <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 rounded-full border border-indigo-500/30">
                <Star className="w-3 h-3 text-indigo-400 fill-indigo-400" />
                <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest text-shadow">Victory Model</span>
             </div>
          </div>

          <div className="w-full h-full">
            <Canvas camera={{ position: [0, 0.5, 5], fov: 40 }}>
               <ambientLight intensity={1.5} />
               <pointLight position={[10, 10, 10]} intensity={2} />
               <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={2} />
               <Suspense fallback={null}>
                  <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
                    <CharacterModel modelPath="/assets-model/Chef_Male.glb" />
                  </Float>
                  <Environment preset="city" />
               </Suspense>
            </Canvas>
          </div>

          <div className="absolute bottom-6 w-full px-6 flex flex-col items-center text-center">
             <h3 className="text-xl font-black italic text-white uppercase tracking-tighter text-shadow">Chef Master</h3>
             <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-[0.3em]">Battle Commander</p>
          </div>
        </div>

        {/* RIGHT COLUMN: Stats & Leaderboard */}
        <div className="w-full md:w-1/2 flex flex-col items-center md:items-start text-center md:text-left h-full">
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-xl ${isVictory ? 'bg-indigo-500/20 text-indigo-400' : 'bg-rose-500/20 text-rose-400'}`}>
              <Trophy className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h2 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-white leading-none">
                {isVictory ? 'BATTLE VICTORY' : 'BATTLE DEFEAT'}
              </h2>
              <p className="text-zinc-500 font-bold tracking-[0.25em] uppercase text-[9px]">Combat Performance Report</p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-2 w-full mb-6 mt-4">
            <div className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center gap-3 group hover:border-indigo-500/30 transition-colors">
              <Sword className="w-4 h-4 text-indigo-400" />
              <div className="min-w-0">
                <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block">Top Damage</span>
                <p className="text-[10px] font-black text-white truncate">{data.topDamage?.username || 'N/A'}</p>
                <p className="text-[9px] font-bold text-indigo-400/60 tabular-nums">{data.topDamage?.value.toLocaleString()}</p>
              </div>
            </div>
            <div className="bg-white/5 border border-white/5 p-3 rounded-2xl flex items-center gap-3 group hover:border-emerald-500/30 transition-colors">
              <Users className="w-4 h-4 text-emerald-400" />
              <div className="min-w-0">
                <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block">Most Spawns</span>
                <p className="text-[10px] font-black text-white truncate">{data.topSpawner?.username || 'N/A'}</p>
                <p className="text-[9px] font-bold text-emerald-400/60 tabular-nums">{data.topSpawner?.value}</p>
              </div>
            </div>
          </div>

          {/* TOP 5 LEADERBOARD */}
          <div className="w-full flex-1 mb-6">
            <div className="flex items-center justify-between mb-3 px-1">
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Crown className="w-3 h-3" /> Top 5 Warriors
              </h4>
              <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Kills / Spawns</span>
            </div>
            
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {data.top5 && data.top5.length > 0 ? (
                data.top5.map((player, idx) => (
                  <div key={player.username} className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all hover:bg-white/10 ${idx === 0 ? 'bg-indigo-500/10 border-indigo-500/20 shadow-[0_4px_20px_rgba(99,102,241,0.15)]' : 'bg-black/20 border-white/5'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] ${idx === 0 ? 'bg-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.5)]' : 'bg-zinc-800 text-zinc-400'}`}>
                        {idx + 1}
                      </div>
                      <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-indigo-500/30 group-hover:border-indigo-500 transition-colors">
                        {player.profileImage ? (
                          <img src={player.profileImage} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-500 font-bold">
                            {player.username[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-black uppercase tracking-tight truncate ${idx === 0 ? 'text-indigo-300' : 'text-white/80'}`}>{player.username}</p>
                        <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest">Elite Soldier</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2">
                         <div className="flex items-center gap-1">
                            <span className="text-xs font-black italic text-indigo-400">{player.kills}</span>
                            <span className="text-[7px] font-bold text-zinc-600 uppercase">K</span>
                         </div>
                         <div className="w-[1px] h-3 bg-white/10" />
                         <div className="flex items-center gap-1">
                            <span className="text-xs font-black italic text-emerald-400">{player.spawns}</span>
                            <span className="text-[7px] font-bold text-zinc-600 uppercase">S</span>
                         </div>
                      </div>
                      <p className="text-[8px] font-bold text-white/30 tabular-nums uppercase tracking-tighter">{player.damage.toLocaleString()} DMG</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center bg-black/20 rounded-2xl border border-dashed border-white/5">
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">No Combat Data Available</p>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onRestart}
            className="w-full py-4 bg-white text-zinc-950 font-black uppercase tracking-[0.2em] text-xs rounded-2xl hover:bg-zinc-200 transition-all shadow-[0_10px_30px_-10px_rgba(255,255,255,0.3)] flex items-center justify-center gap-3 active:scale-[0.98] mt-auto"
          >
            START NEW BATTLE <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

