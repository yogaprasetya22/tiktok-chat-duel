import { create } from 'zustand';
import { TowerConfig, KillEvent, SimulationSettings } from '@/src/core/domain/unit.types';
import { INITIAL_SETTINGS } from '@/src/core/logic/combat/constants';

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
    profileImages: Record<string, string>;
  };
  killEvents: KillEvent[];
  setLiveStats: (stats: { 
    damageDealt: Record<string, number>;
    playerDamage: Record<string, number>;
    enemyDamage: Record<string, number>;
    playerKills: Record<string, number>;
    enemyKills: Record<string, number>;
    profileImages: Record<string, string>;
  }) => void;
  addKillEvent: (event: KillEvent) => void;
  
  // Army Counts
  armyCounts: { player: number; enemy: number };
  setArmyCounts: (player: number, enemy: number) => void;
  
  // Dynamic Simulation Settings
  settings: SimulationSettings;
  updateSettings: (partial: Partial<SimulationSettings>) => void;

  // Training Mode
  gameMode: "BATTLE" | "TRAINING";
  setGameMode: (mode: "BATTLE" | "TRAINING") => void;

  // Weather System
  weather: "CLEAR" | "RAIN" | "STORM" | "THUNDER";
  setWeather: (weather: "CLEAR" | "RAIN" | "STORM" | "THUNDER") => void;

  // Environment Systems
  environment: "DIORAMA" | "STORM";
  setEnvironment: (env: "DIORAMA" | "STORM") => void;

  // Tower Score (Persistent across resets)
  playerWins: number;
  enemyWins: number;
  setWins: (player: number, enemy: number) => void;

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
    enemyKills: {},
    profileImages: {}
  },
  killEvents: [],
  setLiveStats: (liveStats) => set({ liveStats }),
  addKillEvent: (event) => set((state) => {
    // FIX: Avoid spread copy — push and trim in-place
    const events = state.killEvents.length >= 5 
      ? [...state.killEvents.slice(1), event] 
      : [...state.killEvents, event];
    return { killEvents: events };
  }),
  
  armyCounts: { player: 0, enemy: 0 },
  setArmyCounts: (player, enemy) => set({ armyCounts: { player, enemy } }),
  
  settings: INITIAL_SETTINGS,
  updateSettings: (partial) => set((state) => ({ 
    settings: { ...state.settings, ...partial } 
  })),

  gameMode: "BATTLE",
  setGameMode: (gameMode) => set({ gameMode }),

  weather: "CLEAR",
  setWeather: (weather) => set({ weather }),

  environment: "STORM",
  setEnvironment: (environment) => set({ environment }),

  playerWins: 0,
  enemyWins: 0,
  setWins: (playerWins, enemyWins) => set({ playerWins, enemyWins }),

  resetStore: (config) => set((state) => ({
    gameState: "PLAYING",
    weather: "CLEAR",
    playerBaseHp: config.baseHp,
    enemyBaseHp: config.baseHp,
    liveStats: { 
      damageDealt: {},
      playerDamage: {},
      enemyDamage: {},
      playerKills: {},
      enemyKills: {},
      profileImages: state.liveStats.profileImages // Keep profile images to avoid reloading textures
    },
    killEvents: [],
    armyCounts: { player: 0, enemy: 0 }
  }))
}));
