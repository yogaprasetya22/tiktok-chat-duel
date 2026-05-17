'use client';

import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, PresentationControls, Float, ContactShadows, Environment, PerspectiveCamera } from '@react-three/drei';
import { Shield, Sword, Sparkles, Target, Zap, ChevronLeft, ChevronRight, Play, Skull, Trophy, Footprints } from 'lucide-react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

const MODELS = {
  fighter: { 
    path: '/assets-model/Knight_Golden_Male.glb', 
    name: 'Royal Knight', 
    desc: 'The backbone of the army. High balance of attack and defense.',
    stats: { hp: 80, atk: 65, spd: 50 },
    color: '#D4AF37'
  },
  tank: { 
    path: '/assets-model/Viking_Male.glb', 
    name: 'Viking Jarl', 
    desc: 'Unstoppable wall of steel. Absorbs massive damage for the team.',
    stats: { hp: 100, atk: 40, spd: 30 },
    color: '#2E4A22'
  },
  mage: { 
    path: '/assets-model/Wizard.glb', 
    name: 'High Wizard', 
    desc: 'Master of elemental chaos. Deals devastating area damage.',
    stats: { hp: 40, atk: 95, spd: 40 },
    color: '#8A0303'
  },
  marksman: { 
    path: '/assets-model/Cowboy_Female.glb', 
    name: 'Elite Sharpshooter', 
    desc: 'Precision from afar. Snipes high-value targets with ease.',
    stats: { hp: 50, atk: 85, spd: 60 },
    color: '#B5A642'
  },
  assassin: { 
    path: '/assets-model/Ninja_Male.glb', 
    name: 'Shadow Stalker', 
    desc: 'Silent and lethal. Strikes the backline with blinding speed.',
    stats: { hp: 45, atk: 90, spd: 95 },
    color: '#3E3024'
  },
};

const ANIM_TYPES = [
  { id: 'idle', label: 'IDLE', icon: Play, search: ['Idle', 'idle'] },
  { id: 'run', label: 'MARCH', icon: Footprints, search: ['Running', 'Walking', 'Run', 'Walk'] },
  { id: 'attack', label: 'STRIKE', icon: Sword, search: ['Attack', 'Attacking', 'Strike', 'Slash', 'Shot', 'Stab'] },
  { id: 'death', label: 'FALL', icon: Skull, search: ['Death', 'Dying', 'Dead', 'Down'] },
  { id: 'victory', label: 'TRIUMPH', icon: Trophy, search: ['Victory', 'Cheer', 'Winner', 'Triumph'] },
];

function Model({ path, currentAnimType, unitClass }: { path: string, currentAnimType: string, unitClass: string }) {
  const { scene, animations } = useGLTF(path);
  // Clone scene to ensure unique instance for animations
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const group = useRef<THREE.Group>(null!);
  const { actions, names } = useAnimations(animations, group);
  const lastAnim = useRef<string>('');

  useEffect(() => {
    const typeDef = ANIM_TYPES.find(t => t.id === currentAnimType);
    if (!typeDef || !actions) return;

    // Class-specific search priority for 'attack'
    let customSearch = [...typeDef.search];
    if (currentAnimType === 'attack') {
      if (unitClass === 'mage') customSearch = ['Shoot_OneHanded', ...customSearch];
      if (unitClass === 'marksman') customSearch = ['Punch', ...customSearch];
      if (['fighter', 'tank', 'assassin'].includes(unitClass)) customSearch = ['SwordSlash', '1H_Melee_Attack_Chop', ...customSearch];
    }

    // Smart search for animation name: Exact match first, then includes
    const targetName = names.find(n => 
      customSearch.some(s => n.toLowerCase() === s.toLowerCase())
    ) || names.find(n => 
      customSearch.some(s => n.toLowerCase().includes(s.toLowerCase()))
    ) || names.find(n => n.toLowerCase().includes('idle')) || names[0];

    if (targetName && actions[targetName]) {
      if (lastAnim.current && actions[lastAnim.current] && lastAnim.current !== targetName) {
        actions[lastAnim.current]!.fadeOut(0.3);
      }
      
      const action = actions[targetName]!;
      action.reset().fadeIn(0.3).play();
      
      if (currentAnimType === 'death') {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      } else {
        action.setLoop(THREE.LoopRepeat, Infinity);
      }
      
      lastAnim.current = targetName;
    }
  }, [currentAnimType, actions, names]);

  return (
    <group ref={group}>
      <primitive object={clone} scale={1.8} position={[0, -1.2, 0]} />
    </group>
  );
}

export default function LandingUnitShowcase() {
  const [activeTab, setActiveTab] = useState<keyof typeof MODELS>('fighter');
  const [currentAnim, setCurrentAnim] = useState('idle');
  const unit = MODELS[activeTab];

  const keys = Object.keys(MODELS) as (keyof typeof MODELS)[];
  const currentIndex = keys.indexOf(activeTab);

  const next = () => {
    setActiveTab(keys[(currentIndex + 1) % keys.length]);
    setCurrentAnim('idle');
  };
  const prev = () => {
    setActiveTab(keys[(currentIndex - 1 + keys.length) % keys.length]);
    setCurrentAnim('idle');
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-12 p-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        
        {/* Left: 3D Battlefield Viewer */}
        <div className="lg:col-span-7 relative h-[500px] md:h-[650px] bg-[#1a1410] rounded-[40px] border-4 border-[#B5A642]/20 overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8),inset_0_0_80px_rgba(0,0,0,0.6)] group">
          {/* Gritty Vignette */}
          <div className="absolute inset-0 pointer-events-none z-10 shadow-[inset_0_0_150px_rgba(0,0,0,0.9)]" />
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] z-10" />

          {/* Animation Controls Overlay */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2 p-2 bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl">
            {ANIM_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => setCurrentAnim(type.id)}
                className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  currentAnim === type.id 
                  ? 'bg-[#8A0303] text-white shadow-[0_0_20px_rgba(138,3,3,0.5)] scale-105' 
                  : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                <type.icon className="w-5 h-5" />
                <span className="text-[8px] font-black tracking-widest">{type.label}</span>
              </button>
            ))}
          </div>

          <Canvas shadows={{ type: THREE.PCFShadowMap }} dpr={[1, 2]}>
            <PerspectiveCamera makeDefault position={[0, 1, 18]} fov={35} />
            <ambientLight intensity={0.4} color="#ffe4bc" />
            <spotLight position={[5, 10, 5]} angle={0.15} penumbra={1} intensity={2} castShadow color="#ffd4a3" />
            <directionalLight position={[-5, 5, -5]} intensity={1} color="#8A0303" />
            <Environment preset="city" />
            
            <PresentationControls
              global
              snap={true}
              rotation={[0, 0.4, 0]}
              polar={[-Math.PI / 4, Math.PI / 4]}
              azimuth={[-Math.PI / 2, Math.PI / 2]}
            >
              <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.2}>
                <Suspense fallback={null}>
                  <Model key={unit.path} path={unit.path} currentAnimType={currentAnim} unitClass={activeTab} />
                </Suspense>
              </Float>
            </PresentationControls>
            
            <ContactShadows position={[0, -1.25, 0]} opacity={0.6} scale={8} blur={2.5} far={4} color="#000000" />
          </Canvas>

          {/* Nav Arrows */}
          <button onClick={prev} className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl bg-black/40 hover:bg-[#8A0303] text-[#D4AF37] hover:text-white border border-white/10 flex items-center justify-center transition-all z-20 group">
            <ChevronLeft className="w-8 h-8 group-hover:-translate-x-1 transition-transform" />
          </button>
          <button onClick={next} className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl bg-black/40 hover:bg-[#8A0303] text-[#D4AF37] hover:text-white border border-white/10 flex items-center justify-center transition-all z-20 group">
            <ChevronRight className="w-8 h-8 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Right: Intelligence Dossier */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-3 px-5 py-2 rounded-xl bg-[#2E4A22]/20 border-2 border-[#2E4A22]/40 text-[#D4AF37] shadow-xl">
              <div className="w-10 h-10 rounded-lg bg-[#2E4A22]/40 flex items-center justify-center">
                {activeTab === 'fighter' && <Sword className="w-6 h-6" />}
                {activeTab === 'tank' && <Shield className="w-6 h-6" />}
                {activeTab === 'mage' && <Sparkles className="w-6 h-6" />}
                {activeTab === 'marksman' && <Target className="w-6 h-6" />}
                {activeTab === 'assassin' && <Zap className="w-6 h-6" />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Class Identity</p>
                <p className="text-xl font-black uppercase tracking-tighter">{activeTab}</p>
              </div>
            </div>

            <h2 className="text-6xl md:text-7xl font-black text-[#D4AF37] uppercase tracking-tighter italic leading-none drop-shadow-2xl">
              {unit.name}
            </h2>
            <p className="text-[#B5A642]/70 text-xl leading-relaxed italic border-l-4 border-[#8A0303] pl-6 py-2">
              "{unit.desc}"
            </p>
          </div>

          {/* Tactical Stats */}
          <div className="bg-[#2a1f18] p-8 rounded-[32px] border-2 border-[#B5A642]/10 shadow-inner space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Shield className="w-32 h-32 text-white" />
            </div>
            
            <h3 className="text-xs font-black uppercase tracking-[0.4em] text-[#D4AF37]">Combat Specifications</h3>
            
            <div className="space-y-6 relative z-10">
              {Object.entries(unit.stats).map(([label, value]) => (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-xs font-black uppercase tracking-widest text-[#B5A642]">{label}</span>
                    <span className="text-2xl font-black italic text-[#D4AF37]">{value}</span>
                  </div>
                  <div className="h-3 w-full bg-black/40 rounded-full overflow-hidden p-0.5 border border-white/5">
                    <div 
                      className="h-full rounded-full transition-all duration-1000 ease-out relative group"
                      style={{ 
                        width: `${value}%`, 
                        background: `linear-gradient(90deg, #8A0303 0%, #D4AF37 100%)`,
                        boxShadow: '0 0 15px rgba(138,3,3,0.5)'
                      }}
                    >
                      <div className="absolute inset-0 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Selector Thumbnails */}
          <div className="flex flex-wrap gap-4">
            {keys.map((key) => (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  setCurrentAnim('idle');
                }}
                className={`flex-1 min-w-[80px] h-20 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 group overflow-hidden relative ${
                  activeTab === key 
                  ? 'bg-[#8A0303] border-[#D4AF37] shadow-2xl scale-105' 
                  : 'bg-[#1a1410] border-[#B5A642]/10 hover:border-[#B5A642]/40 grayscale opacity-40 hover:opacity-100 hover:grayscale-0'
                }`}
              >
                {activeTab === key && (
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                )}
                <div className={`transition-transform group-hover:scale-110 ${activeTab === key ? 'text-white' : 'text-[#B5A642]'}`}>
                  {key === 'fighter' && <Sword className="w-6 h-6" />}
                  {key === 'tank' && <Shield className="w-6 h-6" />}
                  {key === 'mage' && <Sparkles className="w-6 h-6" />}
                  {key === 'marksman' && <Target className="w-6 h-6" />}
                  {key === 'assassin' && <Zap className="w-6 h-6" />}
                </div>
                <span className={`text-[7px] font-black uppercase tracking-[0.2em] relative z-10 ${activeTab === key ? 'text-white' : 'text-white/20'}`}>
                  {key}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
