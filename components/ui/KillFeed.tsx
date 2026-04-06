'use client';

import { useEffect, useState } from 'react';
import { Skull, Sword, Shield } from 'lucide-react';
import { KillEvent } from '../../hooks/useBattleSystem';

interface KillFeedProps {
  events: KillEvent[];
}

export const KillFeed = ({ events }: KillFeedProps) => {
  const [displayEvents, setDisplayEvents] = useState<KillEvent[]>([]);

  useEffect(() => {
    // Keep only recent events (e.g., last 5 seconds)
    const now = Date.now();
    const recent = events.filter(e => now - e.timestamp < 5000);
    setDisplayEvents(recent);

    const timer = setInterval(() => {
      const currentNow = Date.now();
      setDisplayEvents(prev => prev.filter(e => currentNow - e.timestamp < 5000));
    }, 1000);

    return () => clearInterval(timer);
  }, [events]);

  return (
    <div className="fixed top-24 left-6 z-[60] flex flex-col gap-2 pointer-events-none">
      {displayEvents.map((event) => (
        <div 
          key={event.id}
          className="flex items-center gap-3 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl animate-in slide-in-from-left-8 fade-in duration-300"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-tighter">{event.killer}</span>
            {event.victimType === 'base' ? (
              <Shield className="w-3 h-3 text-white/50" />
            ) : (
              <Sword className="w-3 h-3 text-white/50" />
            )}
            <span className="text-xs font-black text-rose-400 uppercase tracking-tighter">{event.victim}</span>
          </div>
          <div className="p-1 bg-rose-500/20 rounded-md">
            <Skull className="w-3 h-3 text-rose-500" />
          </div>
        </div>
      ))}
    </div>
  );
};
