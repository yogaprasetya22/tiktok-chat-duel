"use client";

import { useState, useRef, useEffect } from "react";
import { useTikTokLive } from "@/lib/hooks";
import { 
  Send, 
  Power, 
  Wifi, 
  WifiOff, 
  MessageSquare, 
  Heart, 
  UserPlus, 
  Gift, 
  ShieldAlert,
  Info,
  ExternalLink
} from "lucide-react";

export default function TikTokLiveChat() {
  const [username, setUsername] = useState("");
  const [target, setTarget] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, connected, error, loading, disconnect } = useTikTokLive(target);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleConnect = () => {
    if (username.trim()) {
      setTarget(username);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setTarget("");
    setUsername("");
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-12 md:py-20 font-sans selection:bg-tiktok-cyan/30">
      {/* Header section */}
      <div className="mb-12 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-1">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-2 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-500 bg-clip-text text-transparent italic leading-[1.1]">
            TIKTOK LIVE
          </h1>
          <p className="text-gray-500 font-bold tracking-[0.2em] uppercase text-[10px] flex items-center justify-center md:justify-start gap-3">
            <span className="w-6 h-[2px] bg-tiktok-cyan"></span>
            Real-time Feed Interceptor
            <span className="w-6 h-[2px] bg-tiktok-magenta"></span>
          </p>
        </div>
        
        <div className="flex items-center justify-center gap-4">
          {connected && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-black shadow-sm animate-pulse-live">
              <div className="w-2.5 h-2.5 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.5)]"></div>
              LIVE
            </div>
          )}
          <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black shadow-sm border ${
            connected 
              ? "bg-emerald-50 border-emerald-100 text-emerald-600" 
              : "bg-gray-50 border-gray-100 text-gray-500"
          }`}>
            {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
            {connected ? "ENCRYPTED" : "OFFLINE"}
          </div>
        </div>
      </div>

      <div className="grid gap-8">
        {/* Connection Panel */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-tiktok-cyan/5 blur-3xl -mr-16 -mt-16"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-tiktok-magenta/5 blur-3xl -ml-16 -mb-16"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-gray-50 rounded-xl">
                <ExternalLink size={18} className="text-gray-400" />
              </div>
              <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">
                Source Configuration
              </label>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1 group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleConnect()}
                  placeholder="Insert TikTok username..."
                  disabled={connected || loading}
                  className="w-full bg-gray-50/50 border-2 border-gray-100 rounded-3xl px-6 py-5 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-tiktok-cyan/10 focus:border-tiktok-cyan transition-all disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg"
                />
              </div>
              
              <div className="flex gap-2">
                {!connected ? (
                  <button
                    onClick={handleConnect}
                    disabled={!username.trim() || loading}
                    className="flex-1 sm:flex-none bg-gray-900 text-white hover:bg-black active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:scale-100 px-10 py-5 rounded-3xl font-black transition-all flex items-center justify-center gap-3 shadow-xl shadow-gray-200"
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <>
                        CONNECT
                        <Send size={20} />
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    className="flex-1 sm:flex-none bg-red-50 text-red-600 hover:bg-red-100 active:scale-95 px-10 py-5 rounded-3xl font-black transition-all flex items-center justify-center gap-3 border border-red-100"
                  >
                    TERMINATE
                    <Power size={20} />
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-3xl text-red-600 text-sm flex items-center gap-4 animate-message">
                <div className="p-2 bg-red-100 rounded-xl">
                  <ShieldAlert size={20} className="flex-shrink-0" />
                </div>
                <span className="font-bold">{error}</span>
              </div>
            )}
            
            {connected && target && (
              <div className="mt-6 flex items-center gap-3 text-emerald-600 text-sm font-black bg-emerald-50 px-5 py-3 rounded-2xl w-fit border border-emerald-100">
                <Info size={16} />
                MONITORING @{target.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Global Chat / Data Feed */}
        <div className="bg-white rounded-[3rem] overflow-hidden flex flex-col h-[650px] shadow-[0_30px_60px_rgba(0,0,0,0.08)] border border-gray-100 relative group">
          <div className="px-8 py-6 border-b border-gray-50 bg-gray-50/30 backdrop-blur-sm flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center">
                <MessageSquare size={16} className="text-gray-900" />
              </div>
              <h2 className="text-xs font-black tracking-[0.2em] text-gray-900 uppercase">Incoming Signal Feed</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">
                {messages.length} EVENTS LOGGED
              </span>
            </div>
          </div>
          
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth bg-gray-50/10"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-300 space-y-6 animate-pulse">
                <div className="w-24 h-24 rounded-[2rem] bg-gray-50 border-4 border-white shadow-sm flex items-center justify-center">
                  <MessageSquare size={48} strokeWidth={1.5} className="text-gray-200" />
                </div>
                <div className="text-center max-w-xs">
                  <p className="text-xl font-black text-gray-400 mb-2 italic">FEED INACTIVE</p>
                  <p className="text-xs font-bold leading-relaxed text-gray-400 uppercase tracking-widest">
                    {connected ? "Awaiting broadcast synchronization..." : "Establish a connection to start intercepting stream metadata."}
                  </p>
                </div>
              </div>
            ) : (
              messages.map((msg, i) => {
                const isSystem = msg.type !== "chat";
                let typeStyles = "bg-white border-gray-100 text-gray-900";
                let Icon = MessageSquare;
                let accentColor = "bg-gray-100 text-gray-400";
                
                if (msg.type === "gift") {
                  typeStyles = "bg-amber-50 border-amber-100 text-amber-900 shadow-[0_10px_20px_rgba(245,158,11,0.05)]";
                  Icon = Gift;
                  accentColor = "bg-amber-200 text-amber-700";
                } else if (msg.type === "like") {
                  typeStyles = "bg-pink-50 border-pink-100 text-pink-900 shadow-[0_10px_20px_rgba(219,39,119,0.05)]";
                  Icon = Heart;
                  accentColor = "bg-pink-400 text-white";
                } else if (msg.type === "follow") {
                  typeStyles = "bg-indigo-50 border-indigo-100 text-indigo-900 shadow-[0_10px_20px_rgba(79,70,229,0.05)]";
                  Icon = UserPlus;
                  accentColor = "bg-indigo-500 text-white";
                }

                return (
                  <div
                    key={msg.id || i}
                    className={`animate-message group flex items-start gap-5 p-5 rounded-[2rem] border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${typeStyles}`}
                  >
                    <div className="relative flex-shrink-0">
                      {msg.profileImage ? (
                        <img
                          src={msg.profileImage}
                          alt={msg.username}
                          className="w-12 h-12 rounded-2xl object-cover ring-4 ring-white shadow-sm"
                          onError={(e) => {
                            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e5e7eb'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center ring-4 ring-white shadow-sm">
                          <Icon size={24} className="text-gray-300" />
                        </div>
                      )}
                      {isSystem && (
                        <div className={`absolute -bottom-2 -right-2 w-7 h-7 rounded-xl border-4 border-white flex items-center justify-center shadow-sm ${accentColor}`}>
                          <Icon size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 py-0.5">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-black text-sm tracking-tight truncate group-hover:text-black transition-colors uppercase">
                          {msg.username}
                        </span>
                        <span className="text-[10px] font-black text-gray-300 whitespace-nowrap bg-gray-50 px-2 py-1 rounded-lg">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`text-[15px] leading-relaxed tracking-tight ${isSystem ? "font-black italic" : "text-gray-600 font-medium"}`}>
                        {msg.comment}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* System Diagnostics */}
        <div className="flex flex-wrap items-center justify-center gap-10 px-6 py-4">
          <div className="flex items-center gap-3 text-[10px] font-black text-gray-400">
             <div className="w-2 h-2 rounded-full bg-tiktok-cyan"></div>
             CORE V16.2
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black text-gray-400">
             <div className="w-2 h-2 rounded-full bg-tiktok-magenta"></div>
             TS ENGINE 5.0
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black text-gray-400">
             <div className="w-2 h-2 rounded-full bg-gray-200"></div>
             TURBOPACK 1.0
          </div>
        </div>
      </div>
    </div>
  );
}


