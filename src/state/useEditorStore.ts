import { create } from 'zustand';
import { getTerrainElevation } from '@/src/core/utils/terrainHeight';

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
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  
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
    sharpness: number;
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
  
  terrainMode: 'paint' | 'sculpt';
  setTerrainMode: (mode: 'paint' | 'sculpt') => void;
  sculptTool: 'raise' | 'lower' | 'smooth' | 'flatten';
  setSculptTool: (tool: 'raise' | 'lower' | 'smooth' | 'flatten') => void;
  sculptData: string | null;
  setSculptData: (data: string | null) => void;

  brushStrength: number;
  setBrushStrength: (strength: number) => void;
  brushRotation: number;
  setBrushRotation: (rotation: number) => void;
  brushMaskId: 'softCircle' | 'hardCircle' | 'star' | 'hexagon' | 'starOutline' | 'square';
  setBrushMaskId: (maskId: 'softCircle' | 'hardCircle' | 'star' | 'hexagon' | 'starOutline' | 'square') => void;
  
  brushHoverPos: [number, number, number] | null;
  setBrushHoverPos: (pos: [number, number, number] | null) => void;

  lastUsedScales: Record<string, [number, number, number]>;
  setLastUsedScale: (assetPath: string, scale: [number, number, number]) => void;
  lastUsedRotations: Record<string, [number, number, number]>;
  setLastUsedRotation: (assetPath: string, rotation: [number, number, number]) => void;

  // Procedural Vegetation Generator States/Actions
  vegetationTheme: 'pine' | 'cherry' | 'autumn' | 'desert' | 'clover';
  setVegetationTheme: (theme: 'pine' | 'cherry' | 'autumn' | 'desert' | 'clover') => void;
  vegetationDensity: number;
  setVegetationDensity: (density: number) => void;
  generateVegetation: () => void;
  clearVegetation: () => void;
}

export const ASSET_LIBRARY = FULL_ASSET_LIBRARY;

let saveTimeout: any = null;
const debouncedSave = () => {
  if (typeof window === 'undefined') return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const state = useEditorStore.getState();
    try {
      localStorage.setItem('world_editor_map', JSON.stringify(state.items));
      localStorage.setItem('world_editor_settings', JSON.stringify({
        gridSize: state.gridSize,
        gridEnabled: state.gridEnabled,
        terrainConfig: state.terrainConfig,
        terrainMaterialId: state.terrainMaterialId,
        terrainColor: state.terrainColor,
        lastUsedScales: state.lastUsedScales,
        lastUsedRotations: state.lastUsedRotations
      }));
      if (state.paintData) {
        localStorage.setItem('world_editor_paint', state.paintData);
      }
      if (state.sculptData) {
        localStorage.setItem('world_editor_sculpt', state.sculptData);
      }
    } catch (e) {
      console.warn("Local storage is full!", e);
    }
  }, 1000);
};

export const useEditorStore = create<EditorState>((set, get) => ({
  isEditorOpen: false,
  setIsEditorOpen: (open) => set({ isEditorOpen: open }),

  lastUsedScales: {},
  setLastUsedScale: (assetPath, scale) => set((state) => {
    const next = { ...state.lastUsedScales, [assetPath]: scale };
    debouncedSave();
    return { lastUsedScales: next };
  }),
  lastUsedRotations: {},
  setLastUsedRotation: (assetPath, rotation) => set((state) => {
    const next = { ...state.lastUsedRotations, [assetPath]: rotation };
    debouncedSave();
    return { lastUsedRotations: next };
  }),
  
  items: [],
  setItems: (items) => set({ items }),
  
  selectedId: null,
  setSelectedId: (id) => set((state) => {
    const isTerrain = id === 'terrain';
    return {
      selectedId: id,
      selectedIds: id ? [id] : [],
      paintMode: isTerrain ? state.paintMode : false
    };
  }),
  selectedIds: [],
  setSelectedIds: (ids) => set((state) => {
    const newSelectedId = ids.length > 0 ? ids[ids.length - 1] : null;
    const isTerrain = newSelectedId === 'terrain';
    return {
      selectedIds: ids,
      selectedId: newSelectedId,
      paintMode: isTerrain ? state.paintMode : false
    };
  }),
  toggleSelectedId: (id) => set((state) => {
    const isSelected = state.selectedIds.includes(id);
    const newIds = isSelected
      ? state.selectedIds.filter(x => x !== id)
      : [...state.selectedIds, id];
    const newSelectedId = newIds.length > 0 ? newIds[newIds.length - 1] : null;
    const isTerrain = newSelectedId === 'terrain';
    return {
      selectedIds: newIds,
      selectedId: newSelectedId,
      paintMode: isTerrain ? state.paintMode : false
    };
  }),
  
  mode: 'translate',
  setMode: (mode) => set({ mode }),
  
  activeAsset: null,
  setActiveAsset: (asset) => set((state) => {
    const isDeactivating = state.activeAsset?.path === asset?.path;
    const nextActiveAsset = isDeactivating ? null : asset;
    if (nextActiveAsset) {
      // Entering Placement Mode: Clear active selection and terrain painting
      return {
        activeAsset: nextActiveAsset,
        selectedId: null,
        selectedIds: [],
        paintMode: false
      };
    } else {
      return {
        activeAsset: null
      };
    }
  }),
  
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
    
    debouncedSave();
  },
  
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevItems = history[historyIndex - 1];
      set({ items: prevItems, historyIndex: historyIndex - 1, selectedId: null, selectedIds: [] });
    }
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextItems = history[historyIndex + 1];
      set({ items: nextItems, historyIndex: historyIndex + 1, selectedId: null, selectedIds: [] });
    }
  },
  
  loadFromStorage: () => {
    const saved = localStorage.getItem('world_editor_map');
    const settings = localStorage.getItem('world_editor_settings');
    
    if (settings) {
      try {
        const parsed = JSON.parse(settings);
        const loadedConfig = {
          height: 12.0,
          scale: 0.05,
          seed: 0,
          sharpness: 2.0,
          ...parsed.terrainConfig
        };
        set({ 
          gridSize: parsed.gridSize, 
          gridEnabled: parsed.gridEnabled, 
          terrainConfig: loadedConfig, 
          terrainMaterialId: parsed.terrainMaterialId,
          terrainColor: parsed.terrainColor || '#3d5c36',
          lastUsedScales: parsed.lastUsedScales || {},
          lastUsedRotations: parsed.lastUsedRotations || {}
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
    const sculpt = localStorage.getItem('world_editor_sculpt');
    if (sculpt) set({ sculptData: sculpt });
  },
  
  saveToStorage: () => {
    const { items, gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, paintData, sculptData } = get();
    try {
      localStorage.setItem('world_editor_map', JSON.stringify(items));
      localStorage.setItem('world_editor_settings', JSON.stringify({ gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor }));
      if (paintData) localStorage.setItem('world_editor_paint', paintData);
      if (sculptData) localStorage.setItem('world_editor_sculpt', sculptData);
    } catch (e) {
      console.warn("Local storage is full! Use saveToDatabase() to persist your changes.", e);
    }
  },

  saveToDatabase: async () => {
    const { items, gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor, paintData, sculptData } = get();
    const payload = {
      items,
      settings: { gridSize, gridEnabled, terrainConfig, terrainMaterialId, terrainColor },
      paintData,
      sculptData
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
          sculptData: data.sculptData,
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
    debouncedSave();
  },
  gridEnabled: true,
  setGridEnabled: (gridEnabled) => {
    set({ gridEnabled });
    debouncedSave();
  },
  
  terrainConfig: {
    height: 12.0,
    scale: 0.05,
    seed: 0,
    sharpness: 2.0
  },
  setTerrainConfig: (config) => {
    set((state) => ({ 
      terrainConfig: { ...state.terrainConfig, ...config } 
    }));
    debouncedSave();
  },

  terrainMaterialId: null,
  setTerrainMaterialId: (id) => {
    set({ terrainMaterialId: id });
    debouncedSave();
  },

  terrainColor: '#3d5c36',
  setTerrainColor: (color) => {
    set({ terrainColor: color });
    debouncedSave();
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

  terrainMode: 'paint',
  setTerrainMode: (terrainMode) => set({ terrainMode }),
  sculptTool: 'raise',
  setSculptTool: (sculptTool) => set({ sculptTool }),
  sculptData: null,
  setSculptData: (sculptData) => {
    set({ sculptData });
    localStorage.setItem('world_editor_sculpt', sculptData || '');
  },
  
  brushStrength: 0.25,
  setBrushStrength: (brushStrength) => set({ brushStrength }),
  brushRotation: 0,
  setBrushRotation: (brushRotation) => set({ brushRotation }),
  brushMaskId: 'softCircle',
  setBrushMaskId: (brushMaskId) => set({ brushMaskId }),
  
  brushHoverPos: null,
  setBrushHoverPos: (brushHoverPos) => set({ brushHoverPos }),

  // Procedural Vegetation Generator States/Actions
  vegetationTheme: 'pine',
  setVegetationTheme: (theme) => {
    set({ vegetationTheme: theme });
  },
  vegetationDensity: 60,
  setVegetationDensity: (density) => {
    set({ vegetationDensity: density });
  },
  generateVegetation: () => {
    const { vegetationTheme, vegetationDensity, terrainConfig, items } = get();
    
    const themeAssets: Record<string, { paths: string[], colors?: string[] }> = {
      pine: {
        paths: [
          "/assets-tree/converted/Tree Type0 01.glb",
          "/assets-tree/converted/Tree Type0 02.glb",
          "/assets-tree/converted/Tree Type0 03.glb",
          "/assets-tree/converted/Tree Type1 01.glb",
          "/assets-tree/converted/Tree Type1 02.glb",
          "/kingdom/rocks-large.glb",
          "/kingdom/rocks-small.glb"
        ]
      },
      cherry: {
        paths: [
          "/assets-tree/converted/Tree Type2 01.glb",
          "/assets-tree/converted/Tree Type2 02.glb",
          "/assets-tree/converted/Tree Type2 03.glb",
          "/assets-tree/converted/Tree Type3 01.glb",
          "/assets-tree/converted/Tree Type3 02.glb"
        ],
        colors: ["#fda4af", "#f472b6", "#ec4899", "#db2777"]
      },
      autumn: {
        paths: [
          "/assets-tree/converted/Tree Type4 01.glb",
          "/assets-tree/converted/Tree Type4 02.glb",
          "/assets-tree/converted/Tree Type5 01.glb",
          "/assets-tree/converted/Tree Type5 02.glb"
        ],
        colors: ["#f59e0b", "#d97706", "#b45309", "#ea580c", "#ca8a04"]
      },
      desert: {
        paths: [
          "/kingdom/tree-log.glb",
          "/kingdom/tree-trunk.glb",
          "/kingdom/rocks-large.glb",
          "/kingdom/rocks-small.glb"
        ],
        colors: ["#a1a1aa", "#71717a", "#b45309", "#78350f"]
      },
      clover: {
        paths: [
          "/kingdom/tree-large.glb",
          "/kingdom/tree-small.glb",
          "/assets-tree/converted/Tree Type6 01.glb",
          "/assets-tree/converted/Tree Type6 02.glb"
        ],
        colors: ["#34d399", "#059669", "#10b981", "#047857"]
      }
    };

    const config = themeAssets[vegetationTheme] || themeAssets.pine;
    const generatedItems: MapItem[] = [];
    const baseDistance = 24;
    
    for (let i = 0; i < vegetationDensity; i++) {
      let x = 0;
      let z = 0;
      let dist = 0;
      
      // Avoid spawning directly in center base
      for (let attempt = 0; attempt < 15; attempt++) {
        x = (Math.random() - 0.5) * 110;
        z = (Math.random() - 0.5) * 110;
        dist = Math.sqrt(x * x + z * z);
        if (dist > baseDistance + 6) break;
      }
      
      // Calculate precise elevation at (x, z) including current sculpt height!
      const terrainH = getTerrainElevation(x, z, "STORM", baseDistance, terrainConfig, false);
      const y = terrainH - 0.3; // Align with GROUND_Y

      const modelPath = config.paths[Math.floor(Math.random() * config.paths.length)];
      const sizeScale = 0.6 + Math.random() * 0.9; // 0.6 to 1.5 times
      
      const pos: [number, number, number] = [x, y, z];
      const rot: [number, number, number] = [0, Math.random() * Math.PI * 2, 0];
      const sca: [number, number, number] = [sizeScale, sizeScale, sizeScale];
      const color = config.colors ? config.colors[Math.floor(Math.random() * config.colors.length)] : undefined;
      
      generatedItems.push({
        id: `procedural-veg-${vegetationTheme}-${Date.now()}-${i}-${Math.random()}`,
        type: 'procedural-vegetation',
        path: modelPath,
        pos,
        rot,
        sca,
        color
      });
    }
    
    // Merge, keeping other non-procedural items
    const otherItems = items.filter(item => item.type !== 'procedural-vegetation');
    const newItems = [...otherItems, ...generatedItems];
    
    get().updateItemsWithHistory(newItems);
  },
  clearVegetation: () => {
    const { items } = get();
    const filtered = items.filter(item => item.type !== 'procedural-vegetation');
    get().updateItemsWithHistory(filtered);
  }
}));
