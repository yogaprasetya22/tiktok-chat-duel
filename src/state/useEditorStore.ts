import { create } from 'zustand';

export interface MapItem {
  id: string;
  type: string;
  path: string;
  pos: [number, number, number];
  rot: [number, number, number];
  sca: [number, number, number];
  color?: string;
}

import { FULL_ASSET_LIBRARY, AssetInfo } from '@/src/core/logic/environment/assetRegistry';

export interface EditorState {
  isEditorOpen: boolean;
  setIsEditorOpen: (open: boolean) => void;
  
  items: MapItem[];
  setItems: (items: MapItem[]) => void;
  
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  
  mode: 'translate' | 'rotate' | 'scale';
  setMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  
  activeAsset: AssetInfo | null;
  setActiveAsset: (asset: AssetInfo | null) => void;
  
  history: MapItem[][];
  historyIndex: number;
  
  // Actions
  updateItemsWithHistory: (newItems: MapItem[] | ((prev: MapItem[]) => MapItem[])) => void;
  undo: () => void;
  redo: () => void;
  
  // Helpers
  loadFromStorage: () => void;
  saveToStorage: () => void;
  saveToDatabase: () => Promise<void>;
  loadFromDatabase: () => Promise<void>;
  
  gridSize: number;
  setGridSize: (size: number) => void;
  gridEnabled: boolean;
  setGridEnabled: (enabled: boolean) => void;
  
  terrainConfig: {
    height: number;
    scale: number;
    seed: number;
  };
  setTerrainConfig: (config: Partial<EditorState['terrainConfig']>) => void;
  
  terrainMaterialId: string | null;
  setTerrainMaterialId: (id: string | null) => void;
  
  terrainColor: string;
  setTerrainColor: (color: string) => void;

  paintMode: boolean;
  setPaintMode: (mode: boolean) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushTextureId: string | null;
  setBrushTextureId: (id: string | null) => void;
  paintData: string | null;
  setPaintData: (data: string | null) => void;
}

export const ASSET_LIBRARY = FULL_ASSET_LIBRARY;

export const useEditorStore = create<EditorState>((set, get) => ({
  isEditorOpen: false,
  setIsEditorOpen: (open) => set({ isEditorOpen: open }),
  
  items: [],
  setItems: (items) => set({ items }),
  
  selectedId: null,
  setSelectedId: (id) => set({ selectedId: id }),
  
  mode: 'translate',
  setMode: (mode) => set({ mode }),
  
  activeAsset: null,
  setActiveAsset: (asset) => set((state) => ({ 
    activeAsset: state.activeAsset?.path === asset?.path ? null : asset 
  })),
  
  history: [],
  historyIndex: -1,
  
  updateItemsWithHistory: (newItems) => {
    const { items, history, historyIndex } = get();
    const updated = typeof newItems === 'function' ? newItems(items) : newItems;
    
    const nextH = history.slice(0, historyIndex + 1);
    const newHistory = [...nextH, updated].slice(-50);
    
    set({ 
      items: updated, 
      history: newHistory, 
      historyIndex: newHistory.length - 1 
    });
    
    get().saveToStorage();
  },
  
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevItems = history[historyIndex - 1];
      set({ items: prevItems, historyIndex: historyIndex - 1, selectedId: null });
    }
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextItems = history[historyIndex + 1];
      set({ items: nextItems, historyIndex: historyIndex + 1, selectedId: null });
    }
  },
  
  loadFromStorage: () => {
    const saved = localStorage.getItem('world_editor_map');
    const settings = localStorage.getItem('world_editor_settings');
    
    if (settings) {
      try {
        const { gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor } = JSON.parse(settings);
        set({ 
          gridSize, 
          gridEnabled, 
          terrainConfig, 
          terrainMaterialId,
          terrainColor: terrainColor || '#3d5c36'
        });
      } catch (e) {}
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as MapItem[];
        
        // Path Sanitization (Fix legacy paths from local storage)
        const sanitized = parsed.map(item => {
          if (item.path.includes('/models/environment/')) {
            const fileName = item.path.split('/').pop()?.replace(/_/g, '-') || '';
            
            // Check if it belongs in kingdom or assets-env
            const kingdomAssets = [
              'bridge-straight', 'tower-square', 'wall', 'wall-corner', 
              'wall-pillar', 'tree-large', 'gate', 'stairs-stone', 
              'rocks-large', 'tower-top'
            ];
            
            if (kingdomAssets.some(a => fileName.startsWith(a))) {
              // Special case for wall_buttress -> wall
              const finalName = fileName === 'wall-buttress.glb' ? 'wall.glb' : fileName;
              return { ...item, path: `/kingdom/${finalName}` };
            } else {
              return { ...item, path: `/assets-env/${fileName}` };
            }
          }
          return item;
        });

        set({ items: sanitized, history: [sanitized], historyIndex: 0 });
      } catch (e) {
        console.error("Failed to load map", e);
      }
    }

    const paint = localStorage.getItem('world_editor_paint');
    if (paint) set({ paintData: paint });
  },
  
  saveToStorage: () => {
    const { items, gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, paintData } = get();
    try {
      localStorage.setItem('world_editor_map', JSON.stringify(items));
      localStorage.setItem('world_editor_settings', JSON.stringify({ gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor }));
      if (paintData) localStorage.setItem('world_editor_paint', paintData);
    } catch (e) {
      console.warn("Local storage is full! Use saveToDatabase() to persist your changes.", e);
    }
  },

  saveToDatabase: async () => {
    const { items, gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, paintData } = get();
    const payload = {
      items,
      settings: { gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor },
      paintData
    };

    try {
      // Endpoint API Laravel/Next.js Anda
      const res = await fetch('/api/world-editor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) console.log("Map synced to database!");
    } catch (e) {
      console.error("Failed to sync to database", e);
    }
  },

  loadFromDatabase: async () => {
    try {
      const res = await fetch('/api/world-editor/load');
      if (res.ok) {
        const data = await res.json();
        set({ 
          items: data.items, 
          ...data.settings, 
          paintData: data.paintData,
          history: [data.items],
          historyIndex: 0
        });
      }
    } catch (e) {
      console.error("Failed to load from database", e);
    }
  },

  gridSize: 1,
  setGridSize: (gridSize) => {
    set({ gridSize });
    get().saveToStorage();
  },
  gridEnabled: true,
  setGridEnabled: (gridEnabled) => {
    set({ gridEnabled });
    get().saveToStorage();
  },
  
  terrainConfig: {
    height: 12.0,
    scale: 0.05,
    seed: 0
  },
  setTerrainConfig: (config) => {
    set((state) => ({ 
      terrainConfig: { ...state.terrainConfig, ...config } 
    }));
    get().saveToStorage();
  },

  terrainMaterialId: null,
  setTerrainMaterialId: (id) => {
    set({ terrainMaterialId: id });
    get().saveToStorage();
  },

  terrainColor: '#3d5c36',
  setTerrainColor: (color) => {
    set({ terrainColor: color });
    get().saveToStorage();
  },

  paintMode: false,
  setPaintMode: (paintMode) => set({ paintMode }),
  brushSize: 10,
  setBrushSize: (brushSize) => set({ brushSize }),
  brushColor: '#5a4d3a',
  setBrushColor: (brushColor) => set({ brushColor }),
  brushTextureId: null,
  setBrushTextureId: (id) => set({ brushTextureId: id }),
  paintData: null,
  setPaintData: (paintData) => {
    set({ paintData });
    localStorage.setItem('world_editor_paint', paintData || '');
  },
}));
