import { create } from 'zustand';
import { TowerConfig, KillEvent } from './useBattleSystem';

interface BattleState {
  // Game Status
  gameState: "SETUP" | "PLAYING" | "WON" | "LOST";
  setGameState: (state: "SETUP" | "PLAYING" | "WON" | "LOST") => void;
  
  // Base Stats (High Frequency)
  playerBaseHp: number;
  enemyBaseHp: number;
  setBaseHp: (player: number, enemy: number) => void;
  
  // Live Leaderboard & Kill Feed
  liveStats: { 
    damageDealt: Record<string, number>;
    playerDamage: Record<string, number>;
    enemyDamage: Record<string, number>;
  };
  killEvents: KillEvent[];
  setLiveStats: (stats: { 
    damageDealt: Record<string, number>;
    playerDamage: Record<string, number>;
    enemyDamage: Record<string, number>;
  }) => void;
  addKillEvent: (event: KillEvent) => void;
  
  // Army Counts
  armyCounts: { player: number; enemy: number };
  setArmyCounts: (player: number, enemy: number) => void;
  
  // System Monitor (Diagnostics)
  perfSnapshot: any;
  setPerfSnapshot: (snap: any) => void;

  // Reset
  resetStore: (config: TowerConfig) => void;
}

export const useStore = create<BattleState>((set) => ({
  gameState: "SETUP",
  setGameState: (state) => set({ gameState: state }),
  
  playerBaseHp: 1000,
  enemyBaseHp: 1000,
  setBaseHp: (player, enemy) => set({ playerBaseHp: player, enemyBaseHp: enemy }),
  
  liveStats: { 
    damageDealt: {},
    playerDamage: {},
    enemyDamage: {}
  },
  killEvents: [],
  setLiveStats: (liveStats) => set({ liveStats }),
  addKillEvent: (event) => set((state) => ({ 
    killEvents: [...state.killEvents, event].slice(-5) 
  })),
  
  armyCounts: { player: 0, enemy: 0 },
  setArmyCounts: (player, enemy) => set({ armyCounts: { player, enemy } }),
  
  perfSnapshot: null,
  setPerfSnapshot: (perfSnapshot) => set({ perfSnapshot }),

  resetStore: (config) => set({
    gameState: "PLAYING",
    playerBaseHp: config.baseHp,
    enemyBaseHp: config.baseHp,
    liveStats: { 
      damageDealt: {},
      playerDamage: {},
      enemyDamage: {}
    },
    killEvents: [],
    armyCounts: { player: 0, enemy: 0 }
  })
}));
