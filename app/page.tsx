import Link from 'next/link';
import LandingUnitShowcase from '@/src/components/landing/LandingUnitShowcase';
import { Sword, Shield, Play, Sparkles, ChevronRight, Zap, Target } from 'lucide-react';

export const metadata = {
  title: "Seal M: Battle Simulator",
  description: "The ultimate 3D battle simulation for Seal M: Clover Knight enthusiasts.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0a0a0c] text-white selection:bg-cyan-500/30 selection:text-cyan-200 font-sans overflow-x-hidden">
      {/* Dynamic Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-cyan-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.05]" />
      </div>

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 h-20 bg-black/60 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 md:px-12 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center border border-white/20 shadow-lg shadow-cyan-500/20">
            <Sword className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-black italic tracking-tighter text-white uppercase leading-none block">SEAL M</span>
            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest leading-none">Battle Simulator</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <Link href="/seal-m" className="text-xs font-black uppercase tracking-widest hover:text-cyan-400 transition-colors">Enter Arena</Link>
          <Link href="/training" className="text-xs font-black uppercase tracking-widest hover:text-cyan-400 transition-colors">Training</Link>
          <Link href="/seal-m" className="px-6 py-2 bg-white text-black text-xs font-black uppercase tracking-widest rounded-full hover:bg-cyan-400 hover:text-white transition-all shadow-xl">
            Start Simulation
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-24 px-6 md:px-12 flex flex-col items-center text-center">
        <div className="relative z-10 space-y-8 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em] animate-in fade-in slide-in-from-top-4 duration-1000">
            <Sparkles className="w-3 h-3" /> Clover Knight Edition v3.0
          </div>
          <h1 className="text-6xl md:text-8xl font-black italic text-white uppercase tracking-tighter leading-[0.85] drop-shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
            Unleash Your <br /> <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Inner Knight</span>
          </h1>
          <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto italic leading-relaxed animate-in fade-in duration-1000 delay-300">
            The most advanced high-density battle simulator for Seal M. Experience cinematic 3D combat, strategic legion management, and legendary class showdowns.
          </p>
          <div className="pt-8 flex flex-wrap justify-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-500">
            <Link href="/seal-m" className="px-10 py-5 bg-cyan-500 text-white text-xl font-black uppercase tracking-widest rounded-2xl border-b-8 border-cyan-700 hover:translate-y-1 hover:border-b-4 active:translate-y-2 active:border-b-0 transition-all flex items-center gap-3 shadow-2xl shadow-cyan-500/20">
              <Play className="w-6 h-6 fill-white" /> Enter Simulator
            </Link>
            <Link href="/training" className="px-10 py-5 bg-white/5 text-white text-xl font-black uppercase tracking-widest rounded-2xl border-2 border-white/10 hover:bg-white/10 transition-all backdrop-blur-sm">
              Training Grounds
            </Link>
          </div>
        </div>
      </section>

      {/* Class Showcase Section */}
      <section id="units" className="py-24 bg-white/[0.02] border-y border-white/5 relative">
        <div className="px-6 md:px-12 mb-16 text-center">
          <h3 className="text-4xl font-black text-white uppercase tracking-tighter italic">LEGION CLASSES</h3>
          <p className="text-xs text-cyan-400 uppercase tracking-[0.4em] mt-2 font-bold">Standard Combat Protocol</p>
        </div>
        <LandingUnitShowcase />
      </section>

      {/* Features Grid */}
      <section className="py-32 px-6 md:px-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            {
              icon: Zap,
              title: 'ECS ENGINE',
              desc: 'High-performance Entity Component System driving 600+ active units at 60 FPS.',
              color: 'text-cyan-400',
              bg: 'bg-cyan-500/10'
            },
            {
              icon: Shield,
              title: '3D COLLISION',
              desc: 'Physics-based environment interaction with BVH spatial acceleration.',
              color: 'text-blue-400',
              bg: 'bg-blue-500/10'
            },
            {
              icon: Target,
              title: 'CLASS MATRIX',
              desc: 'Rock-paper-scissors balancing between Knight, Mage, Archer, and Assassin.',
              color: 'text-purple-400',
              bg: 'bg-purple-500/10'
            }
          ].map((item, i) => (
            <div key={i} className="p-8 rounded-[32px] bg-white/[0.03] border border-white/5 hover:border-white/20 transition-all group">
              <div className={`w-14 h-14 ${item.bg} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <item.icon className={`w-8 h-8 ${item.color}`} />
              </div>
              <h4 className="text-xl font-black text-white uppercase tracking-tighter mb-4 italic">{item.title}</h4>
              <p className="text-zinc-500 text-sm leading-relaxed italic">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Gameplay Section */}
      <section className="py-32 bg-black/40 border-y border-white/5">
        <div className="px-6 md:px-12 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div>
              <h3 className="text-5xl font-black text-white uppercase tracking-tighter italic mb-4 leading-none">COMMANDER <br /> CONSOLE</h3>
              <p className="text-zinc-400 italic">Complete tactical control over the battlefield simulation.</p>
            </div>
            
            <div className="space-y-4">
              {[
                { label: 'ENVIRONMENT SHIFTER', desc: 'Switch between Whimsical Diorama or Stormy Battlefield with dynamic weather.' },
                { label: 'LEGION SCALING', desc: 'Adjust unit density and power levels to create legendary boss encounters.' },
                { label: 'PHYSICS CONTROL', desc: 'Modify time-scale and movement speeds for cinematic slow-motion analysis.' },
                { label: 'VFX OVERLOAD', desc: 'Experience high-fidelity particles and spell effects optimized for performance.' },
              ].map((s, i) => (
                <div key={i} className="flex gap-4 p-5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors">
                  <ChevronRight className="w-5 h-5 text-cyan-500 flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-xs font-black text-white uppercase tracking-widest mb-1">{s.label}</p>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-bold">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-4 bg-cyan-500/20 blur-2xl rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative aspect-square bg-[#0c0c0e] rounded-[48px] border-4 border-white/10 overflow-hidden shadow-2xl flex items-center justify-center p-8">
              <div className="w-full space-y-6 opacity-30 select-none">
                <div className="h-4 w-3/4 bg-cyan-500/20 rounded" />
                <div className="h-12 w-full bg-white/5 rounded-2xl border border-white/10" />
                <div className="grid grid-cols-2 gap-6">
                  <div className="h-32 bg-white/5 rounded-3xl" />
                  <div className="h-32 bg-white/5 rounded-3xl" />
                </div>
                <div className="h-12 w-1/2 bg-cyan-500/40 rounded-2xl mx-auto" />
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="w-20 h-20 bg-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-cyan-500/40 animate-bounce">
                  <Play className="w-10 h-10 text-white fill-white" />
                </div>
                <p className="px-6 py-2 bg-white text-black font-black uppercase tracking-[0.2em] text-xs rounded-full shadow-2xl">
                  Simulate Now
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 border-t border-white/5 text-center relative z-10">
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center border border-white/10">
              <Sword className="w-4 h-4 text-cyan-400" />
            </div>
            <span className="text-xl font-black italic tracking-tighter text-white uppercase">SEAL M SIM</span>
          </div>
          <div className="flex gap-8 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
            <Link href="/seal-m" className="hover:text-white transition-colors">Simulator</Link>
            <Link href="/training" className="hover:text-white transition-colors">Training</Link>
            <span className="opacity-30">|</span>
            <span>&copy; 2026 Clover Knight Dev</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
