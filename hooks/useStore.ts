import { create } from 'zustand';
import { TowerConfig, KillEvent, SimulationSettings } from './useBattleSystem';
import { INITIAL_SETTINGS } from './battle/constants';

interface BattleState {
  // Game Status
  gameState: "SETUP" | "PLAYING" | "WON" | "LOST";
  setGameState: (state: "SETUP" | "PLAYING" | "WON" | "LOST") => void;
  
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
  
  // Base Stats (High Frequency)
  playerBaseHp: number;
  enemyBaseHp: number;
  setBaseHp: (player: number, enemy: number) => void;
  
  liveStats: { 
    damageDealt: Record<string, number>;
    playerDamage: Record<string, number>;
    enemyDamage: Record<string, number>;
    playerKills: Record<string, number>;
    enemyKills: Record<string, number>;
  };
  killEvents: KillEvent[];
  setLiveStats: (stats: { 
    damageDealt: Record<string, number>;
    playerDamage: Record<string, number>;
    enemyDamage: Record<string, number>;
    playerKills: Record<string, number>;
    enemyKills: Record<string, number>;
  }) => void;
  addKillEvent: (event: KillEvent) => void;
  
  // Army Counts
  armyCounts: { player: number; enemy: number };
  setArmyCounts: (player: number, enemy: number) => void;
  
  // Performance Monitor (Diagnostics)
  perfSnapshot: any;
  setPerfSnapshot: (snap: any) => void;

  // Dynamic Simulation Settings
  settings: SimulationSettings;
  updateSettings: (partial: Partial<SimulationSettings>) => void;

  // Training Mode
  gameMode: "BATTLE" | "TRAINING";
  setGameMode: (mode: "BATTLE" | "TRAINING") => void;

  // Reset
  resetStore: (config: TowerConfig) => void;
}

export const useStore = create<BattleState>((set) => ({
  gameState: "SETUP",
  setGameState: (state) => set({ gameState: state }),
  
  isSettingsOpen: false,
  setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
  
  playerBaseHp: 1000,
  enemyBaseHp: 1000,
  setBaseHp: (player, enemy) => set({ playerBaseHp: player, enemyBaseHp: enemy }),
  
  liveStats: { 
    damageDealt: {},
    playerDamage: {},
    enemyDamage: {},
    playerKills: {},
    enemyKills: {}
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

  settings: INITIAL_SETTINGS,
  updateSettings: (partial) => set((state) => ({ 
    settings: { ...state.settings, ...partial } 
  })),

  gameMode: "BATTLE",
  setGameMode: (gameMode) => set({ gameMode }),

  resetStore: (config) => set({
    gameState: "PLAYING",
    playerBaseHp: config.baseHp,
    enemyBaseHp: config.baseHp,
    liveStats: { 
      damageDealt: {},
      playerDamage: {},
      enemyDamage: {},
      playerKills: {},
      enemyKills: {}
    },
    killEvents: [],
    armyCounts: { player: 0, enemy: 0 }
  })
}));
