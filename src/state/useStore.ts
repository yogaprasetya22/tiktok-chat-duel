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

    // Leaderboard Stats
    topPlayerKills: { username: string, value: number, image: string }[];
    topEnemyKills: { username: string, value: number, image: string }[];
    setTopKills: (player: { username: string, value: number, image: string }[], enemy: { username: string, value: number, image: string }[]) => void;

    liveStats: {
        profileImages: Record<string, string>;
        damageDealt: Record<string, number>;
        playerDamage: Record<string, number>;
        enemyDamage: Record<string, number>;
        playerKills: Record<string, number>;
        enemyKills: Record<string, number>;
        unitsSpawned: Record<string, number>;
    };
    killEvents: KillEvent[];
    setLiveStats: (stats: {
        profileImages: Record<string, string>;
        damageDealt: Record<string, number>;
        playerDamage: Record<string, number>;
        enemyDamage: Record<string, number>;
        playerKills: Record<string, number>;
        enemyKills: Record<string, number>;
        unitsSpawned: Record<string, number>;
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

    // Combat Mode (Single vs AoE)
    combatMode: "SINGLE" | "AOE";
    setCombatMode: (mode: "SINGLE" | "AOE") => void;

    // Weather System
    weather: "CLEAR" | "RAIN" | "STORM" | "THUNDER";
    setWeather: (weather: "CLEAR" | "RAIN" | "STORM" | "THUNDER") => void;

    // Environment Systems
    environment: "STORM" | "DIORAMA";
    setEnvironment: (env: "DIORAMA" | "STORM") => void;

    // Player Position Tracking
    playerPosition: [number, number, number];
    setPlayerPosition: (pos: [number, number, number]) => void;

    // Tower Score (Persistent across resets)
    playerWins: number;
    enemyWins: number;
    setWins: (player: number, enemy: number) => void;

    // Tug of War Mechanics
    isFeverTime: boolean;
    triggerFeverTime: () => void;

    // Orbital Lightning Effect
    orbitalLightningActive: boolean;
    triggerOrbitalLightning: () => void;

    // Medical Supply Effect
    medicalSupplyActive: boolean;
    triggerMedicalSupply: () => void;
    
    rouletteEvent: { id: string, username: string, team: "player" | "enemy" } | null;
    triggerRoulette: (username: string, team: "player" | "enemy") => void;
    clearRoulette: () => void;
    
    gachaEvent: { id: string, username: string, team: "player" | "enemy", type: string, description: string } | null;
    triggerGacha: (username: string, team: "player" | "enemy", type: string, description: string) => void;
    clearGacha: () => void;

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
  
  topPlayerKills: [],
  topEnemyKills: [],
  setTopKills: (player, enemy) => set({ topPlayerKills: player, topEnemyKills: enemy }),
  
  liveStats: { 
    profileImages: {},
    damageDealt: {},
    playerDamage: {},
    enemyDamage: {},
    playerKills: {},
    enemyKills: {},
    unitsSpawned: {}
  },
  killEvents: [],
  setLiveStats: (liveStats) => set({ liveStats }),
  addKillEvent: (event) => set((state) => {
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

  combatMode: "SINGLE",
  setCombatMode: (combatMode) => set({ combatMode }),

  weather: "CLEAR",
  setWeather: (weather) => set({ weather }),

  environment: "STORM",
  setEnvironment: (environment) => set({ environment }),

  playerPosition: [0, 0, 0],
  setPlayerPosition: (playerPosition) => set({ playerPosition }),

  playerWins: 0,
  enemyWins: 0,
  setWins: (playerWins, enemyWins) => set({ playerWins, enemyWins }),

  isFeverTime: false,
  triggerFeverTime: () => {
    set({ isFeverTime: true });
    setTimeout(() => set({ isFeverTime: false }), 10000);
  },

  orbitalLightningActive: false,
  triggerOrbitalLightning: () => {
    set({ orbitalLightningActive: true });
    setTimeout(() => set({ orbitalLightningActive: false }), 8000);
  },

  medicalSupplyActive: false,
  triggerMedicalSupply: () => {
    set({ medicalSupplyActive: true });
    setTimeout(() => set({ medicalSupplyActive: false }), 8000);
  },
  
  rouletteEvent: null,
  triggerRoulette: (username, team) => {
    set({ rouletteEvent: { id: Date.now().toString(), username, team } });
  },
  clearRoulette: () => set({ rouletteEvent: null }),

  gachaEvent: null,
  triggerGacha: (username, team, type, description) => {
    set({ gachaEvent: { id: Date.now().toString(), username, team, type, description } });
  },
  clearGacha: () => set({ gachaEvent: null }),

  resetStore: (config) => set((state) => ({
    gameState: "PLAYING",
    weather: "CLEAR",
    playerBaseHp: config.baseHp,
    enemyBaseHp: config.baseHp,
    liveStats: { 
      profileImages: state.liveStats.profileImages,
      damageDealt: {},
      playerDamage: {},
      enemyDamage: {},
      playerKills: {},
      enemyKills: {},
      unitsSpawned: {}
    },
    topPlayerKills: [],
    topEnemyKills: [],
    killEvents: [],
    armyCounts: { player: 0, enemy: 0 }
  }))
}));
