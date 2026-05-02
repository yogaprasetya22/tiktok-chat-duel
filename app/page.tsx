import Link from 'next/link';
import LandingUnitShowcase from '@/src/components/landing/LandingUnitShowcase';
import { Sword, Users, MessageSquare, Gift, Shield, Play, RefreshCw, ChevronRight } from 'lucide-react';

export const metadata = {
  title: "Royale Clash - TikTok Live Battle",
  description: "The ultimate grit-themed interactive battle arena for TikTok Live.",
};

export default function Home() {
  return (
    <main className="min-h-screen bg-[#3E3024] text-[#B5A642] selection:bg-[#8A0303] selection:text-white font-sans overflow-x-hidden">
      {/* Texture Overlay */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-50 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />

      {/* Navbar */}
      <nav className="fixed top-0 inset-x-0 h-20 bg-black/80 backdrop-blur-md border-b border-[#B5A642]/10 flex items-center justify-between px-6 md:px-12 z-40">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-[#8A0303] rounded-lg rotate-12 flex items-center justify-center border-2 border-[#D4AF37] shadow-[0_0_15px_rgba(138,3,3,0.5)]">
            <Sword className="w-6 h-6 text-white -rotate-12" />
          </div>
          <span className="text-2xl font-black italic tracking-tighter text-[#D4AF37] uppercase">Royale Clash</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          <a href="#how-to-play" className="text-sm font-black uppercase tracking-widest hover:text-[#D4AF37] transition-colors">Tactics</a>
          <a href="#units" className="text-sm font-black uppercase tracking-widest hover:text-[#D4AF37] transition-colors">Dossier</a>
          <Link href="/live-game" className="px-6 py-2 bg-[#8A0303] text-white text-sm font-black uppercase tracking-widest rounded-full border-2 border-[#D4AF37]/50 hover:scale-105 active:scale-95 transition-all animate-pulse shadow-[0_0_20px_rgba(138,3,3,0.4)]">
            Entering Battle
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 px-6 md:px-12 flex flex-col items-center text-center">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#8A0303]/10 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="relative z-10 space-y-6 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2E4A22]/20 border border-[#2E4A22]/50 text-[#2E4A22] text-xs font-black uppercase tracking-[0.2em]">
            <Shield className="w-3 h-3" /> Battlefield Simulation v2.0
          </div>
          <h1 className="text-6xl md:text-8xl font-black italic text-[#D4AF37] uppercase tracking-tighter leading-[0.85] drop-shadow-2xl">
            Where Chat Becomes <br /> <span className="text-[#8A0303]">The Frontline</span>
          </h1>
          <p className="text-lg md:text-xl text-[#B5A642]/70 max-w-2xl mx-auto italic leading-relaxed">
            Lead your legion in a high-density tactical arena. Every comment is a soldier. Every gift is a reinforcement. Command the chaos on TikTok Live.
          </p>
          <div className="pt-8 flex flex-wrap justify-center gap-4">
            <Link href="/live-game" className="px-10 py-5 bg-[#8A0303] text-white text-xl font-black uppercase tracking-widest rounded-xl border-b-8 border-[#5e0202] hover:translate-y-1 hover:border-b-4 active:translate-y-2 active:border-b-0 transition-all flex items-center gap-3">
              <Play className="w-6 h-6 fill-white" /> Launch Game
            </Link>
            <button className="px-10 py-5 bg-transparent text-[#B5A642] text-xl font-black uppercase tracking-widest rounded-xl border-2 border-[#B5A642]/20 hover:bg-white/5 transition-all">
              Watch Trailer
            </button>
          </div>
        </div>
      </section>

      {/* Unit Showcase Section */}
      <section id="units" className="py-20 bg-black/20 border-y border-[#B5A642]/5">
        <div className="px-6 md:px-12 mb-12 text-center">
          <h3 className="text-3xl font-black text-[#D4AF37] uppercase tracking-tighter italic">Combat Intelligence</h3>
          <p className="text-sm text-[#B5A642]/40 uppercase tracking-widest">Analyze your tactical options</p>
        </div>
        <LandingUnitShowcase />
      </section>

      {/* How To Play Section */}
      <section id="how-to-play" className="py-24 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h3 className="text-4xl font-black text-[#D4AF37] uppercase tracking-tighter italic">Battle Operations</h3>
          <p className="text-sm text-[#B5A642]/40 uppercase tracking-widest">Master the art of interactive warfare</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {[
            { 
              step: '01', 
              icon: Users, 
              title: 'Recruitment', 
              desc: 'Host connects to TikTok Live. Viewers join by commenting team keywords.',
              color: 'text-emerald-500'
            },
            { 
              step: '02', 
              icon: MessageSquare, 
              title: 'Deployment', 
              desc: 'Spawn units by typing their class name. Coordinate attacks in real-time.',
              color: 'text-blue-500'
            },
            { 
              step: '03', 
              icon: Gift, 
              title: 'Reinforcement', 
              desc: 'Unleash elite formations and ultimate spells by sending TikTok gifts.',
              color: 'text-amber-500'
            },
          ].map((item, i) => (
            <div key={i} className="relative z-10 flex flex-col items-center text-center group">
              <div className="w-20 h-20 rounded-3xl bg-[#2a1f18] border border-[#B5A642]/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-[#D4AF37] transition-all duration-500 shadow-xl">
                <item.icon className={`w-10 h-10 ${item.color}`} />
                <div className="absolute -top-4 -right-4 w-10 h-10 bg-[#8A0303] rounded-full flex items-center justify-center text-white font-black italic border-2 border-[#D4AF37]">
                  {item.step}
                </div>
              </div>
              <h4 className="text-2xl font-black text-[#D4AF37] uppercase tracking-tighter mb-4">{item.title}</h4>
              <p className="text-[#B5A642]/60 italic leading-relaxed text-sm">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Battle Configuration (Settings) Section */}
      <section className="py-24 bg-black/40 border-y border-[#B5A642]/10">
        <div className="px-6 md:px-12 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div>
              <h3 className="text-3xl font-black text-[#D4AF37] uppercase tracking-tighter italic mb-2">Host Command Center</h3>
              <p className="text-[#B5A642]/60 italic">Total control over the battlefield simulation.</p>
            </div>
            
            <div className="space-y-4">
              {[
                { label: 'Tower Fortification', desc: 'Adjust base HP from 500 to 50,000 for quick skirmishes or long sieges.' },
                { label: 'Tactical Pacing', desc: 'Control time scale and unit spawn rates to balance the combat intensity.' },
                { label: 'Environment Control', desc: 'Switch between Whimsical Diorama or Stormy Battlefield with dynamic weather.' },
                { label: 'Army Scaling', desc: 'Scale unit sizes and power levels to create legendary boss encounters.' },
              ].map((s, i) => (
                <div key={i} className="flex gap-4 p-4 rounded-xl bg-[#3E3024]/40 border border-[#B5A642]/10 border-l-4 border-l-[#D4AF37]">
                  <RefreshCw className="w-5 h-5 text-[#D4AF37] flex-shrink-0 mt-1" />
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-wider mb-1">{s.label}</p>
                    <p className="text-xs text-[#B5A642]/70 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-4 bg-[#8A0303]/20 blur-2xl rounded-[40px] opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative aspect-video bg-[#1a1410] rounded-[32px] border-4 border-[#B5A642]/20 overflow-hidden shadow-2xl flex items-center justify-center p-8">
              <div className="w-full space-y-4 opacity-40 select-none">
                <div className="h-4 w-3/4 bg-[#D4AF37]/20 rounded" />
                <div className="h-8 w-full bg-[#D4AF37]/10 rounded border border-[#D4AF37]/20" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-20 bg-[#D4AF37]/5 rounded" />
                  <div className="h-20 bg-[#D4AF37]/5 rounded" />
                </div>
                <div className="h-10 w-1/2 bg-[#8A0303]/40 rounded mx-auto" />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="px-6 py-3 bg-[#B5A642] text-[#3E3024] font-black uppercase tracking-[0.2em] -rotate-12 shadow-2xl border-4 border-[#3E3024]">
                  Host Only Console
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Command Reference Section */}
      <section className="py-24 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="bg-[#2a1f18] rounded-[40px] border-2 border-[#B5A642]/10 overflow-hidden shadow-2xl">
          <div className="p-8 md:p-12 border-b border-[#B5A642]/10 flex flex-col md:flex-row justify-between items-center gap-6 bg-gradient-to-r from-[#8A0303]/10 to-transparent">
            <div>
              <h3 className="text-3xl font-black text-[#D4AF37] uppercase tracking-tighter italic">Battlefield Dossier</h3>
              <p className="text-[#B5A642]/60 text-sm uppercase tracking-widest">Official command reference for all combatants</p>
            </div>
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-[#2E4A22]/30 border border-[#2E4A22] text-[#2E4A22] text-[10px] font-black uppercase rounded-lg">Verified Protocol</div>
              <div className="px-4 py-2 bg-[#8A0303]/20 border border-[#8A0303] text-[#8A0303] text-[10px] font-black uppercase rounded-lg">High Priority</div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#B5A642]/10">
            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 text-[#D4AF37]">
                <Users className="w-5 h-5" />
                <h4 className="font-black uppercase tracking-widest text-sm">Join Commands</h4>
              </div>
              <div className="space-y-4">
                <div className="flex justify-between items-center group">
                  <code className="px-2 py-1 bg-black/40 text-emerald-400 font-bold rounded">p</code>
                  <span className="text-xs text-[#B5A642]/50 italic">Join Player Team</span>
                </div>
                <div className="flex justify-between items-center group">
                  <code className="px-2 py-1 bg-black/40 text-rose-400 font-bold rounded">e</code>
                  <span className="text-xs text-[#B5A642]/50 italic">Join Enemy Team</span>
                </div>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 text-[#D4AF37]">
                <Sword className="w-5 h-5" />
                <h4 className="font-black uppercase tracking-widest text-sm">Combat Units</h4>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] font-bold uppercase italic text-white/80">
                <span>. Tank</span>
                <span>. Mage</span>
                <span>. Fighter</span>
                <span>. Marksman</span>
                <span>. Assassin</span>
              </div>
              <p className="text-[10px] text-[#B5A642]/40 italic">*Type the name after joining to spawn.</p>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-center gap-3 text-[#D4AF37]">
                <Gift className="w-5 h-5" />
                <h4 className="font-black uppercase tracking-widest text-sm">Tactical Gifts</h4>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-black/20 rounded-xl border border-white/5 group hover:border-[#D4AF37]/50 transition-colors">
                  <p className="text-[10px] font-black text-[#D4AF37] mb-1">Mawar / Rose</p>
                  <p className="text-[9px] text-[#B5A642]/60 italic">Spawn massive wave of Kroco units.</p>
                </div>
                <div className="p-3 bg-black/20 rounded-xl border border-white/5 group hover:border-[#8A0303]/50 transition-colors">
                  <p className="text-[10px] font-black text-[#8A0303] mb-1">Panda / Treasure</p>
                  <p className="text-[9px] text-[#B5A642]/60 italic">Summon a Legendary Boss Unit.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Live Command Demo (Transmission) Section */}
      <section className="py-24 bg-gradient-to-b from-transparent to-black/60">
        <div className="px-6 md:px-12 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-black text-[#D4AF37] uppercase tracking-tighter italic">Tactical Transmission</h3>
            <p className="text-[#B5A642]/60 text-sm uppercase tracking-widest">Real-time chat command simulation</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Chat Simulation Window */}
            <div className="bg-[#1a1410] rounded-[32px] border-4 border-[#B5A642]/20 shadow-2xl overflow-hidden flex flex-col h-[400px]">
              <div className="p-4 bg-[#B5A642]/10 border-b border-[#B5A642]/10 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-black text-[#D4AF37] uppercase tracking-widest">Live Feed Simulation</span>
              </div>
              
              <div className="flex-1 p-6 space-y-4 overflow-y-auto font-mono">
                {[
                  { user: 'Budi_Gamer', text: 'p', result: 'Joined Team PLAYER 🛡️', color: 'text-emerald-400' },
                  { user: 'Budi_Gamer', text: 'tank', result: 'Deploying VIKING JARL... ⚔️', color: 'text-[#D4AF37]' },
                  { user: 'Sultan_XT', text: 'e', result: 'Joined Team ENEMY 👺', color: 'text-rose-400' },
                  { user: 'Sultan_XT', text: 'mage', result: 'Deploying HIGH WIZARD... 🪄', color: 'text-[#D4AF37]' },
                  { user: 'Gift_King', text: '🌹 (Rose)', result: 'KROCO SWARM UNLEASHED! 🔥', color: 'text-[#8A0303] font-black' },
                ].map((item, i) => (
                  <div key={i} className="animate-slide-up" style={{ animationDelay: `${i * 800}ms` }}>
                    <div className="flex gap-2 items-start mb-1">
                      <span className="text-[10px] text-[#B5A642]/40">@ {item.user}:</span>
                      <span className="text-sm text-white font-bold">{item.text}</span>
                    </div>
                    <div className={`ml-4 text-xs italic ${item.color} flex items-center gap-2`}>
                      <ChevronRight className="w-3 h-3" /> {item.result}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-black/40 flex gap-2">
                <div className="flex-1 bg-white/5 rounded-lg px-4 py-2 text-xs text-[#B5A642]/30 italic">Type a command...</div>
                <div className="px-4 py-2 bg-[#8A0303] text-white text-[10px] font-black uppercase rounded-lg">Send</div>
              </div>
            </div>

            {/* Explanation Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h4 className="text-2xl font-black text-[#D4AF37] uppercase italic">See it in action</h4>
                <p className="text-[#B5A642]/70 leading-relaxed italic">
                  Commanding your units is as simple as typing in the chat. <span className="text-[#D4AF37] font-bold">First, pick your side</span> (p or e), then unleash your army by typing their class name. Every message is parsed by our <span className="text-white font-bold underline decoration-[#8A0303]">Battle Engine</span>.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#2E4A22]/20 flex items-center justify-center flex-shrink-0 text-[#2E4A22]">
                    <Play className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-wider">Fast Execution</p>
                    <p className="text-xs text-[#B5A642]/60">Units spawn within milliseconds of your chat appearing on screen.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#8A0303]/20 flex items-center justify-center flex-shrink-0 text-[#8A0303]">
                    <Gift className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white uppercase tracking-wider">Gift Multiplier</p>
                    <p className="text-xs text-[#B5A642]/60">Gifts don't just spawn units; they can buff your entire army or trigger global events.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-[#B5A642]/10 text-center">
        <div className="flex flex-col items-center gap-6">
          <div className="flex items-center gap-2 grayscale opacity-50">
            <div className="w-6 h-6 bg-[#8A0303] rounded flex items-center justify-center">
              <Sword className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-black italic tracking-tighter text-[#D4AF37] uppercase">Royale Clash</span>
          </div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#B5A642]/30 font-black">
            Built for the most intense live streams &copy; 2026
          </p>
        </div>
      </footer>
    </main>
  );
}
