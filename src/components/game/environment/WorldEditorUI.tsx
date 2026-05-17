'use client';

import React from 'react';
import { useGLTF } from '@react-three/drei';
import { useInView } from 'react-intersection-observer';
import { Search, MousePointer2, Box, Trash2, Copy, Undo2, Redo2, Layers, Package, Loader2, Mountain, Paintbrush, Sliders, ArrowUp, ArrowDown, Sparkles, Eraser } from 'lucide-react';
import { useEditorStore, ASSET_LIBRARY, MapItem } from '@/src/state/useEditorStore';
import { FULL_MATERIAL_LIBRARY } from '@/src/core/logic/environment/assetRegistry';

// ─── GPU-FREE VECTOR THUMBNAIL GENERATOR (Zero lag, Zero context crashes) ───
const AssetCard = React.memo(({ asset, isActive, onClick }: { asset: any, isActive: boolean, onClick: () => void }) => {
  const { ref, inView } = useInView({
    triggerOnce: false,
    rootMargin: '100px 0px',
    threshold: 0.01,
  });

  const nameLower = (asset.name || '').toLowerCase();
  
  const getThumbnailContent = () => {
    if (asset.diffuse) {
      return (
        <img 
          src={asset.diffuse} 
          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
          alt={asset.name}
        />
      );
    }
    
    // Forests / Trees
    if (asset.category === 'tree' || nameLower.includes('tree') || nameLower.includes('foliage') || nameLower.includes('pine') || nameLower.includes('log') || nameLower.includes('wood')) {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-emerald-950/60 via-emerald-900/30 to-teal-500/10 flex flex-col items-center justify-center relative">
          <span className="text-3xl filter drop-shadow-[0_4px_8px_rgba(16,185,129,0.35)] select-none">🌲</span>
          <div className="absolute bottom-1 right-2 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[6px] font-black text-emerald-400 uppercase tracking-widest">
            Tree
          </div>
        </div>
      );
    }

    // Loot / Treasure / Chests
    if (nameLower.includes('coin') || nameLower.includes('jewel') || nameLower.includes('key') || nameLower.includes('gold') || nameLower.includes('star') || nameLower.includes('chest') || nameLower.includes('loot')) {
      const isChest = nameLower.includes('chest');
      return (
        <div className="w-full h-full bg-gradient-to-tr from-amber-950/60 via-amber-900/30 to-yellow-500/10 flex flex-col items-center justify-center relative">
          <span className="text-3xl filter drop-shadow-[0_4px_8px_rgba(234,179,8,0.4)] select-none animate-bounce duration-[2000ms]">
            {isChest ? '📦' : '💎'}
          </span>
          <div className="absolute bottom-1 right-2 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[6px] font-black text-amber-400 uppercase tracking-widest">
            {isChest ? 'Chest' : 'Loot'}
          </div>
        </div>
      );
    }

    // Castle / Architecture / Kingdom
    if (asset.category === 'kingdom' || nameLower.includes('wall') || nameLower.includes('gate') || nameLower.includes('bridge') || nameLower.includes('stairs') || nameLower.includes('tower') || nameLower.includes('door') || nameLower.includes('stairs')) {
      return (
        <div className="w-full h-full bg-gradient-to-tr from-slate-900/70 via-slate-800/40 to-indigo-950/20 flex flex-col items-center justify-center relative">
          <span className="text-3xl filter drop-shadow-[0_4px_8px_rgba(99,102,241,0.35)] select-none">🏰</span>
          <div className="absolute bottom-1 right-2 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20 text-[6px] font-black text-indigo-400 uppercase tracking-widest">
            Castle
          </div>
        </div>
      );
    }

    // Danger / Trap / Combat / Siege
    if (nameLower.includes('spike') || nameLower.includes('saw') || nameLower.includes('bomb') || nameLower.includes('trap') || nameLower.includes('siege') || nameLower.includes('ballista') || nameLower.includes('catapult') || nameLower.includes('barrel') || nameLower.includes('crate')) {
      const isBomb = nameLower.includes('bomb');
      const isBarrel = nameLower.includes('barrel') || nameLower.includes('crate');
      return (
        <div className="w-full h-full bg-gradient-to-tr from-rose-950/60 via-rose-900/30 to-red-600/10 flex flex-col items-center justify-center relative">
          <span className="text-3xl filter drop-shadow-[0_4px_8px_rgba(244,63,94,0.45)] select-none">
            {isBomb ? '💣' : isBarrel ? '📦' : '⚔️'}
          </span>
          <div className="absolute bottom-1 right-2 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[6px] font-black text-rose-400 uppercase tracking-widest">
            {isBarrel ? 'Prop' : 'Combat'}
          </div>
        </div>
      );
    }

    // Level Terrain Blocks
    if (nameLower.includes('grass') || nameLower.includes('snow') || nameLower.includes('moving') || nameLower.includes('block') || nameLower.includes('ground') || nameLower.includes('rock')) {
      const isSnow = nameLower.includes('snow');
      return (
        <div className={`w-full h-full bg-gradient-to-tr ${isSnow ? 'from-sky-950/50 via-indigo-950/30 to-sky-500/10' : 'from-green-950/60 via-emerald-950/35 to-green-500/10'} flex flex-col items-center justify-center relative`}>
          <span className="text-3xl filter drop-shadow-[0_4px_8px_rgba(16,185,129,0.25)] select-none">
            {isSnow ? '❄️' : '🟩'}
          </span>
          <div className={`absolute bottom-1 right-2 px-1.5 py-0.5 rounded ${isSnow ? 'bg-sky-500/10 border-sky-500/20 text-sky-400' : 'bg-green-500/10 border-green-500/20 text-green-400'} text-[6px] font-black uppercase tracking-widest`}>
            {isSnow ? 'Snow' : 'Ground'}
          </div>
        </div>
      );
    }

    // Default elegant fallback
    return (
      <div className="w-full h-full bg-gradient-to-tr from-zinc-900/70 via-zinc-800/30 to-neutral-700/10 flex flex-col items-center justify-center relative">
        <span className="text-3xl filter drop-shadow-[0_4px_6px_rgba(255,255,255,0.15)] select-none">📦</span>
        <div className="absolute bottom-1 right-2 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[6px] font-black text-white/50 uppercase tracking-widest">
          Prop
        </div>
      </div>
    );
  };

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => {
        if (asset.path) {
          useGLTF.preload(asset.path);
        }
      }}
      className={`group relative flex flex-col gap-2 p-2 rounded-2xl transition-all duration-300 border-2 ${isActive ? 'bg-indigo-600/25 border-indigo-500 shadow-lg shadow-indigo-500/30 scale-[0.98]' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'}`}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '0 120px' }}
    >
      {inView ? (
        <>
          <div className="aspect-square w-full bg-black/40 rounded-xl overflow-hidden flex items-center justify-center relative shadow-inner">
            {getThumbnailContent()}
            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>
          <span className={`text-[9px] font-black uppercase tracking-widest text-center truncate w-full px-1 ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white/60'}`}>
            {asset.name}
          </span>
        </>
      ) : (
        <>
          <div className="aspect-square w-full bg-black/20 rounded-xl" />
          <div className="h-[13px]" />
        </>
      )}
    </button>
  );
}, (prev, next) => {
  return prev.asset.id === next.asset.id && prev.isActive === next.isActive;
});

const LayerRow = React.memo(({ 
  item, 
  isSelected, 
  onClick, 
  onDelete 
}: { 
  item: MapItem; 
  isSelected: boolean; 
  onClick: (e: React.MouseEvent) => void;
  onDelete: () => void;
}) => {
  return (
    <div className={`flex items-center justify-between p-2 rounded-xl border transition-all ${isSelected ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg' : 'bg-black/20 border-transparent hover:bg-black/40'}`}>
      <button 
        onClick={onClick}
        className="flex-1 text-left text-[10px] font-black uppercase flex items-center gap-3 px-2 truncate"
      >
        <Layers className={`w-3 h-3 ${isSelected ? 'text-white' : 'text-indigo-500'}`} />
        {item.type}
      </button>
      <button 
        onClick={onDelete}
        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${isSelected ? 'bg-white/20 text-white hover:bg-white/40' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'}`}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
         prev.isSelected === next.isSelected &&
         prev.item.type === next.item.type;
});

export const WorldEditorUI = () => {
  const {
    isEditorOpen,
    setIsEditorOpen,
    items,
    selectedId,
    setSelectedId,
    selectedIds,
    setSelectedIds,
    toggleSelectedId,
    mode,
    setMode,
    activeAsset,
    setActiveAsset,
    undo,
    redo,
    historyIndex,
    history,
    updateItemsWithHistory,
    gridSize,
    setGridSize,
    gridEnabled,
    setGridEnabled,
    terrainConfig,
    setTerrainConfig,
    terrainMaterialId,
    setTerrainMaterialId,
    terrainColor,
    setTerrainColor,
    setPaintMode,
    brushSize,
    setBrushSize,
    brushColor,
    setBrushColor,
    brushTextureId,
    setBrushTextureId,
    setPaintData,
    brushStrength,
    setBrushStrength,
    brushRotation,
    setBrushRotation,
    brushMaskId,
    setBrushMaskId,
    terrainMode,
    setTerrainMode,
    sculptTool,
    setSculptTool,
    setSculptData,
    vegetationTheme,
    setVegetationTheme,
    vegetationDensity,
    setVegetationDensity,
    generateVegetation,
    clearVegetation
  } = useEditorStore();

  const [mounted, setMounted] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [isInitializing, setIsInitializing] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setIsInitializing(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Auto-activate paintMode when Terrain layer is selected, and disable it when deselected
  React.useEffect(() => {
    if (selectedId === 'terrain') {
      setPaintMode(true);
    } else {
      setPaintMode(false);
    }
  }, [selectedId, setPaintMode]);

  // --- Keyboard Nudging Listener (Arrow keys to Translate/Position selected object) ───
  const nudgeActiveRef = React.useRef(false);
  const pendingDeltaRef = React.useRef<{ dx: number; dy: number; dz: number } | null>(null);
  const rafIdRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Guard: Check if editor is open
      if (!isEditorOpen) return;
      
      const { selectedIds } = useEditorStore.getState();
      if (selectedIds.length === 0) return;

      // 2. Guard: Prevent nudging if user is typing in an input field
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || 
         activeEl.tagName === 'TEXTAREA' || 
         activeEl.getAttribute('contenteditable') === 'true')
      ) {
        return;
      }

      // --- Brush Adjustment Global Shortcuts ---
      const { selectedId, brushSize, setBrushSize, brushStrength, setBrushStrength } = useEditorStore.getState();
      if (selectedId === 'terrain') {
        let changed = false;
        if (e.key === '[') {
          setBrushSize(Math.max(1, brushSize - 3));
          changed = true;
        } else if (e.key === ']') {
          setBrushSize(Math.min(150, brushSize + 3));
          changed = true;
        } else if (e.key === '-') {
          setBrushStrength(Math.max(0.01, brushStrength - 0.05));
          changed = true;
        } else if (e.key === '=' || e.key === '+') {
          setBrushStrength(Math.min(1.0, brushStrength + 0.05));
          changed = true;
        }

        if (changed) {
          e.preventDefault();
          return;
        }
      }

      // Determine step multiplier: normal nudge = 0.1m, Shift key held = 0.5m
      const step = e.shiftKey ? 0.5 : 0.1;
      let dx = 0;
      let dy = 0;
      let dz = 0;
      let handled = false;

      switch (e.key) {
        case 'ArrowLeft':
          dx = -step;
          handled = true;
          break;
        case 'ArrowRight':
          dx = step;
          handled = true;
          break;
        case 'ArrowUp':
          dz = -step; // Move forward (away from screen)
          handled = true;
          break;
        case 'ArrowDown':
          dz = step;  // Move backward (towards screen)
          handled = true;
          break;
        case 'PageUp':
          dy = step;  // Rise height (Y-axis)
          handled = true;
          break;
        case 'PageDown':
          dy = -step; // Lower height (Y-axis)
          handled = true;
          break;
        default:
          break;
      }

      if (handled) {
        e.preventDefault(); // Stop standard browser page scroll or scrollbar movement
        
        // Track that active nudging has started
        nudgeActiveRef.current = true;

        // Accumulate deltas
        if (!pendingDeltaRef.current) {
          pendingDeltaRef.current = { dx, dy, dz };
        } else {
          pendingDeltaRef.current.dx += dx;
          pendingDeltaRef.current.dy += dy;
          pendingDeltaRef.current.dz += dz;
        }

        // Schedule the update on the next screen refresh frame (Throttle renders to match actual monitor Hz)
        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            if (!pendingDeltaRef.current) return;
            
            const { selectedIds: activeSelIds, items: activeItems, setItems: activeSetItems } = useEditorStore.getState();
            const { dx: adx, dy: ady, dz: adz } = pendingDeltaRef.current;
            pendingDeltaRef.current = null;

            const nextItems = activeItems.map(item =>
              activeSelIds.includes(item.id)
                ? { ...item, pos: [item.pos[0] + adx, item.pos[1] + ady, item.pos[2] + adz] as [number, number, number] }
                : item
            );
            activeSetItems(nextItems);
          });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // If we were actively nudging and the released key is one of our nudge keys
      if (nudgeActiveRef.current && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.key)) {
        nudgeActiveRef.current = false;

        // Cancel any pending frame update and run it immediately to ensure keyup has the absolute final committed state
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        
        if (pendingDeltaRef.current) {
          const { selectedIds: activeSelIds, items: activeItems, setItems: activeSetItems } = useEditorStore.getState();
          const { dx: adx, dy: ady, dz: adz } = pendingDeltaRef.current;
          pendingDeltaRef.current = null;

          const nextItems = activeItems.map(item =>
            activeSelIds.includes(item.id)
              ? { ...item, pos: [item.pos[0] + adx, item.pos[1] + ady, item.pos[2] + adz] as [number, number, number] }
              : item
          );
          activeSetItems(nextItems);
        }

        // Commit final state to Undo/Redo history stack once nudge completes
        const { items, history, historyIndex } = useEditorStore.getState();
        const nextH = history.slice(0, historyIndex + 1);
        const newHistory = [...nextH, items].slice(-50);
        useEditorStore.setState({
          history: newHistory,
          historyIndex: newHistory.length - 1
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isEditorOpen]);

  const [selectedCategory, setSelectedCategory] = React.useState<string>('all');

  if (!mounted) return null;

  const filteredAssets = selectedCategory === 'materials' 
    ? FULL_MATERIAL_LIBRARY 
    : ASSET_LIBRARY.filter(a => {
        const matchesSearch = a.name.toLowerCase().includes(search.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || a.category === selectedCategory;
        return matchesSearch && matchesCategory;
      });
  const selectedItem = items.find(i => i.id === selectedId);

  const deleteSelected = () => {
    if (selectedIds.length > 0) {
      updateItemsWithHistory(prev => prev.filter(i => !selectedIds.includes(i.id)));
      setSelectedId(null);
    }
  };

  const duplicateSelected = () => {
    if (selectedIds.length > 0) {
      const duplicatedItems: MapItem[] = [];
      const newIds: string[] = [];

      selectedIds.forEach(id => {
        const item = items.find(i => i.id === id);
        if (item) {
          const newId = "item_" + Math.random().toString(36).substr(2, 9);
          duplicatedItems.push({
            ...item,
            id: newId,
            pos: [item.pos[0] + 1, item.pos[1], item.pos[2] + 1] as [number, number, number]
          });
          newIds.push(newId);
        }
      });

      if (duplicatedItems.length > 0) {
        updateItemsWithHistory(prev => [...prev, ...duplicatedItems]);
        setSelectedIds(newIds); // Select the newly duplicated items
      }
    }
  };


  const copyMapCode = () => {
    const code = `export const STATIC_WORLD_MAP: MapItem[] = ${JSON.stringify(items, null, 2)};`;
    navigator.clipboard.writeText(code);
    alert("Map code copied to clipboard!");
  };

  const exportMap = () => {
    const data = JSON.stringify(items, null, 2);
    navigator.clipboard.writeText(data);
    alert("Map data copied to clipboard!");
  };

  const handleClearMap = () => {
    if (confirm("Clear all items?")) {
      updateItemsWithHistory([]);
    }
  };

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 items-end select-none pointer-events-none h-[calc(100vh-48px)] overflow-hidden">
      
      {/* Initializing Overlay */}
      {isEditorOpen && isInitializing && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto">
          <div className="relative">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 animate-pulse" />
          </div>
          <h2 className="mt-6 text-white font-black text-2xl tracking-[0.2em] uppercase italic">Initializing Studio</h2>
          <p className="mt-2 text-indigo-400/60 font-bold text-[10px] uppercase tracking-widest">Loading environment data & assets...</p>
        </div>
      )}

      <div className="pointer-events-auto">
        <button 
          onClick={() => setIsEditorOpen(!isEditorOpen)}
          className={`px-10 py-4 rounded-full font-black tracking-widest shadow-2xl transition-all border-2 flex items-center gap-3 ${isEditorOpen ? 'bg-rose-500 text-white border-rose-400' : 'bg-indigo-600 text-white border-indigo-400'} hover:scale-105 active:scale-95`}
        >
          {isEditorOpen ? <Trash2 className="w-5 h-5" /> : <Package className="w-5 h-5" />}
          {isEditorOpen ? 'CLOSE EDITOR' : 'OPEN WORLD BUILDER'}
        </button>
      </div>

      {isEditorOpen && (
        <div className="world-editor-ui w-[500px] h-full bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[32px] p-8 shadow-2xl flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 pointer-events-auto overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h3 className="text-white font-black text-xl tracking-tighter uppercase italic flex items-center gap-3">
              <span className="w-3 h-3 bg-indigo-500 rounded-full animate-pulse" />
              Map Studio <span className="text-white/20 text-xs not-italic font-medium">v2.0</span>
            </h3>
            <div className="flex gap-2">
               <button onClick={undo} disabled={historyIndex <= 0} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-20 transition-all"><Undo2 className="w-4 h-4 text-white" /></button>
               <button onClick={redo} disabled={historyIndex >= history.length - 1} className="p-2 bg-white/5 hover:bg-white/10 rounded-xl disabled:opacity-20 transition-all"><Redo2 className="w-4 h-4 text-white" /></button>
            </div>
          </div>

          {/* Main Content Area - Scrollable */}
          <div className="flex-grow flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
            
            {/* World Settings Section */}
            <div className="bg-white/5 rounded-[24px] p-5 border border-white/5 flex flex-col gap-5">
              <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Environment Config</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-white/40 uppercase">Grid Snap</span>
                  <button 
                    onClick={() => setGridEnabled(!gridEnabled)}
                    className={`w-10 h-5 rounded-full transition-all relative ${gridEnabled ? 'bg-indigo-600' : 'bg-white/10'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${gridEnabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-white/40 uppercase">Grid Size</label>
                  <input 
                    type="range" min="0.1" max="5" step="0.1" 
                    value={gridSize} 
                    onChange={(e) => setGridSize(parseFloat(e.target.value))}
                    className="w-full accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-[9px] font-black text-indigo-300 text-right">{gridSize}m</div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-white/40 uppercase">Terrain Inspector</label>
                  <button 
                    onClick={() => setSelectedId('terrain')}
                    className={`w-full py-2.5 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all border-2 flex items-center justify-center gap-2 ${
                      selectedId === 'terrain' 
                        ? 'bg-indigo-500 text-white border-indigo-400 shadow-xl shadow-indigo-500/20' 
                        : 'bg-white/5 text-white border-white/10 hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                    <Mountain className="w-3.5 h-3.5" />
                    Configure Terrain
                  </button>
                </div>
              </div>
            </div>
            
            {/* Tool Selection */}
            <div className="flex flex-col gap-3">
              <label className="text-white/40 text-[10px] uppercase font-black tracking-[0.2em] px-2">Editor Mode</label>
              <button
                onClick={() => setActiveAsset(null)}
                className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all border-2 flex items-center justify-center gap-3 ${!activeAsset ? 'bg-indigo-500 text-white border-indigo-400 shadow-xl shadow-indigo-500/40' : 'bg-white/5 text-white/40 border-transparent hover:bg-white/10'}`}
              >
                <MousePointer2 className="w-4 h-4" />
                Selection Mode
              </button>
            </div>

            {/* Asset Palette */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-2">
                <label className="text-white/40 text-[10px] uppercase font-black tracking-[0.2em]">Asset Palette</label>
                <span className="text-[10px] text-indigo-400 font-black uppercase">{filteredAssets.length} Units</span>
              </div>
              
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search architecture, foliage, props..."
                  className="w-full bg-white/5 border border-white/5 rounded-2xl py-3 pl-12 pr-4 text-xs text-white placeholder:text-white/20 focus:bg-white/10 focus:border-indigo-500/50 outline-none transition-all"
                />
              </div>

              {/* Category Tabs */}
              <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto custom-scrollbar no-scrollbar">
                {['all', 'kingdom', 'env', 'tree', 'materials'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex-1 min-w-[70px] py-2 px-3 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${selectedCategory === cat ? 'bg-indigo-600 text-white shadow-lg' : 'text-white/40 hover:bg-white/5 hover:text-white/60'}`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {filteredAssets.map((asset: any) => (
                  <AssetCard 
                    key={asset.path || asset.id} 
                    asset={asset} 
                    isActive={activeAsset?.path === asset.path || terrainMaterialId === asset.id} 
                    onClick={() => {
                      if (selectedCategory === 'materials') {
                        setTerrainMaterialId(asset.id);
                      } else {
                        setActiveAsset(asset);
                      }
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Active Objects List */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-2">
                <label className="text-white/40 text-[10px] uppercase font-black tracking-[0.2em]">Layer Management</label>
                <span className="text-[10px] text-indigo-400 font-black uppercase">{items.length} Items</span>
              </div>
              <div className="flex flex-col gap-2 bg-white/5 rounded-[24px] p-2 border border-white/5">
                {/* Core Terrain Layer Row */}
                <div 
                  onClick={() => setSelectedId('terrain')}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    selectedId === 'terrain' 
                      ? 'bg-indigo-600/30 border border-indigo-500/50 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]' 
                      : 'bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${selectedId === 'terrain' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/40'}`}>
                      <Mountain className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-white uppercase tracking-wider">Terrain (Ground Mesh)</span>
                      <span className="text-[7.5px] font-bold text-indigo-400/80 uppercase tracking-widest">Active Core Layer</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-[7px] font-black text-indigo-300 uppercase tracking-widest border border-indigo-500/25">STATIC</span>
                  </div>
                </div>

                {items.length === 0 && <p className="text-white/20 text-[10px] text-center py-6 italic font-medium">Empty scene — pick an asset to start</p>}
                {[...items].reverse().map(item => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <LayerRow
                      key={item.id}
                      item={item}
                      isSelected={isSelected}
                      onClick={(e) => {
                        if (activeAsset) setActiveAsset(null);
                        if (e.shiftKey) {
                          toggleSelectedId(item.id);
                        } else {
                          setSelectedId(item.id);
                        }
                      }}
                      onDelete={() => {
                        updateItemsWithHistory(prev => prev.filter(i => i.id !== item.id));
                        if (selectedIds.includes(item.id)) {
                          setSelectedIds(selectedIds.filter(x => x !== item.id));
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Contextual Selection Tools */}
          {selectedId && selectedId !== 'terrain' && (
            <div className="flex flex-col gap-4 p-5 bg-indigo-600/10 rounded-[32px] border border-indigo-500/30 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center">
                   <Box className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-black uppercase text-[10px] tracking-widest">{selectedItem?.type}</span>
                  <span className="text-indigo-400 font-bold text-[8px] uppercase">Active Selection</span>
                </div>
              </div>

              <div className="flex gap-1 bg-black/40 p-1 rounded-2xl">
                {(['translate', 'rotate', 'scale'] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${mode === m ? 'bg-indigo-500 text-white shadow-lg' : 'text-white/30 hover:text-white/60'}`}
                  >
                    {m}
                  </button>
                ))}
              </div>

              {/* ─── DRAW.IO STYLE NUMERICAL PARAMETERS (Position, Rotation, Scale) ─── */}
              <div className="flex flex-col gap-3 p-3 bg-black/40 rounded-2xl border border-white/5 text-white">
                {/* Position Axis */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Position (X, Y, Z)</span>
                  <div className="grid grid-cols-3 gap-2">
                    {/* X */}
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center w-full bg-white/5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-indigo-500 overflow-hidden">
                        <input
                          type="number"
                          step={0.1}
                          value={Number(selectedItem?.pos[0]?.toFixed(2)) || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [val, i.pos[1], i.pos[2]] } : i));
                          }}
                          className="w-full bg-transparent px-2 py-1.5 text-center text-xs font-black focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col border-l border-white/10 h-full">
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0] + 0.1, i.pos[1], i.pos[2]] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0] - 0.1, i.pos[1], i.pos[2]] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white border-t border-white/5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <span className="text-[7px] font-bold text-white/40 uppercase mt-1">X (Meter)</span>
                    </div>

                    {/* Y */}
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center w-full bg-white/5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-indigo-500 overflow-hidden">
                        <input
                          type="number"
                          step={0.1}
                          value={Number(selectedItem?.pos[1]?.toFixed(2)) || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], val, i.pos[2]] } : i));
                          }}
                          className="w-full bg-transparent px-2 py-1.5 text-center text-xs font-black focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col border-l border-white/10 h-full">
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], i.pos[1] + 0.1, i.pos[2]] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], i.pos[1] - 0.1, i.pos[2]] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white border-t border-white/5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <span className="text-[7px] font-bold text-white/40 uppercase mt-1">Y (Height)</span>
                    </div>

                    {/* Z */}
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center w-full bg-white/5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-indigo-500 overflow-hidden">
                        <input
                          type="number"
                          step={0.1}
                          value={Number(selectedItem?.pos[2]?.toFixed(2)) || 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], i.pos[1], val] } : i));
                          }}
                          className="w-full bg-transparent px-2 py-1.5 text-center text-xs font-black focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col border-l border-white/10 h-full">
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], i.pos[1], i.pos[2] + 0.1] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, pos: [i.pos[0], i.pos[1], i.pos[2] - 0.1] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white border-t border-white/5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <span className="text-[7px] font-bold text-white/40 uppercase mt-1">Z (Meter)</span>
                    </div>
                  </div>
                </div>

                {/* Rotation Axis */}
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Rotation (Pitch, Yaw, Roll)</span>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Rot X */}
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center w-full bg-white/5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-indigo-500 overflow-hidden">
                        <input
                          type="number"
                          value={Math.round((selectedItem?.rot[0] || 0) * 180 / Math.PI)}
                          onChange={(e) => {
                            const val = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                            updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, rot: [val, i.rot[1], i.rot[2]] } : i));
                          }}
                          className="w-full bg-transparent px-2 py-1.5 text-center text-xs font-black focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col border-l border-white/10 h-full">
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => {
                                if (selectedIds.includes(i.id)) {
                                  const currentDeg = Math.round(i.rot[0] * 180 / Math.PI);
                                  const val = ((currentDeg + 15) % 360) * Math.PI / 180;
                                  return { ...i, rot: [val, i.rot[1], i.rot[2]] };
                                }
                                return i;
                              }));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => {
                                if (selectedIds.includes(i.id)) {
                                  const currentDeg = Math.round(i.rot[0] * 180 / Math.PI);
                                  const val = ((currentDeg - 15 + 360) % 360) * Math.PI / 180;
                                  return { ...i, rot: [val, i.rot[1], i.rot[2]] };
                                }
                                return i;
                              }));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white border-t border-white/5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <span className="text-[7px] font-bold text-white/40 uppercase mt-1">Pitch (X°)</span>
                    </div>

                    {/* Rot Y */}
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center w-full bg-white/5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-indigo-500 overflow-hidden">
                        <input
                          type="number"
                          value={Math.round((selectedItem?.rot[1] || 0) * 180 / Math.PI)}
                          onChange={(e) => {
                            const val = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                            updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, rot: [i.rot[0], val, i.rot[2]] } : i));
                          }}
                          className="w-full bg-transparent px-2 py-1.5 text-center text-xs font-black focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col border-l border-white/10 h-full">
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => {
                                if (selectedIds.includes(i.id)) {
                                  const currentDeg = Math.round(i.rot[1] * 180 / Math.PI);
                                  const val = ((currentDeg + 15) % 360) * Math.PI / 180;
                                  return { ...i, rot: [i.rot[0], val, i.rot[2]] };
                                }
                                return i;
                              }));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => {
                                if (selectedIds.includes(i.id)) {
                                  const currentDeg = Math.round(i.rot[1] * 180 / Math.PI);
                                  const val = ((currentDeg - 15 + 360) % 360) * Math.PI / 180;
                                  return { ...i, rot: [i.rot[0], val, i.rot[2]] };
                                }
                                return i;
                              }));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white border-t border-white/5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <span className="text-[7px] font-bold text-white/40 uppercase mt-1">Yaw (Y°)</span>
                    </div>

                    {/* Rot Z */}
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center w-full bg-white/5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-indigo-500 overflow-hidden">
                        <input
                          type="number"
                          value={Math.round((selectedItem?.rot[2] || 0) * 180 / Math.PI)}
                          onChange={(e) => {
                            const val = (parseFloat(e.target.value) || 0) * Math.PI / 180;
                            updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, rot: [i.rot[0], i.rot[1], val] } : i));
                          }}
                          className="w-full bg-transparent px-2 py-1.5 text-center text-xs font-black focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col border-l border-white/10 h-full">
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => {
                                if (selectedIds.includes(i.id)) {
                                  const currentDeg = Math.round(i.rot[2] * 180 / Math.PI);
                                  const val = ((currentDeg + 15) % 360) * Math.PI / 180;
                                  return { ...i, rot: [i.rot[0], i.rot[1], val] };
                                }
                                return i;
                              }));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => {
                                if (selectedIds.includes(i.id)) {
                                  const currentDeg = Math.round(i.rot[2] * 180 / Math.PI);
                                  const val = ((currentDeg - 15 + 360) % 360) * Math.PI / 180;
                                  return { ...i, rot: [i.rot[0], i.rot[1], val] };
                                }
                                return i;
                              }));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white border-t border-white/5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <span className="text-[7px] font-bold text-white/40 uppercase mt-1">Roll (Z°)</span>
                    </div>
                  </div>
                </div>

                {/* Scale Axis */}
                <div className="space-y-1.5 pt-1 border-t border-white/5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-indigo-400">Scale (X, Y, Z Ratio)</span>
                  <div className="grid grid-cols-3 gap-2">
                    {/* Scale X */}
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center w-full bg-white/5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-indigo-500 overflow-hidden">
                        <input
                          type="number"
                          step={0.1}
                          value={Number(selectedItem?.sca[0]?.toFixed(2)) || 1}
                          onChange={(e) => {
                            const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                            updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [val, i.sca[1], i.sca[2]] } : i));
                          }}
                          className="w-full bg-transparent px-2 py-1.5 text-center text-xs font-black focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col border-l border-white/10 h-full">
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0] + 0.1, i.sca[1], i.sca[2]] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [Math.max(0.1, i.sca[0] - 0.1), i.sca[1], i.sca[2]] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white border-t border-white/5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <span className="text-[7px] font-bold text-white/40 uppercase mt-1">Sca X</span>
                    </div>

                    {/* Scale Y */}
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center w-full bg-white/5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-indigo-500 overflow-hidden">
                        <input
                          type="number"
                          step={0.1}
                          value={Number(selectedItem?.sca[1]?.toFixed(2)) || 1}
                          onChange={(e) => {
                            const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                            updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], val, i.sca[2]] } : i));
                          }}
                          className="w-full bg-transparent px-2 py-1.5 text-center text-xs font-black focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col border-l border-white/10 h-full">
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], i.sca[1] + 0.1, i.sca[2]] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], Math.max(0.1, i.sca[1] - 0.1), i.sca[2]] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white border-t border-white/5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <span className="text-[7px] font-bold text-white/40 uppercase mt-1">Sca Y</span>
                    </div>

                    {/* Scale Z */}
                    <div className="flex flex-col items-center">
                      <div className="relative flex items-center w-full bg-white/5 rounded-xl border border-white/10 hover:border-white/20 focus-within:border-indigo-500 overflow-hidden">
                        <input
                          type="number"
                          step={0.1}
                          value={Number(selectedItem?.sca[2]?.toFixed(2)) || 1}
                          onChange={(e) => {
                            const val = Math.max(0.1, parseFloat(e.target.value) || 1);
                            updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], i.sca[1], val] } : i));
                          }}
                          className="w-full bg-transparent px-2 py-1.5 text-center text-xs font-black focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="flex flex-col border-l border-white/10 h-full">
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], i.sca[1], i.sca[2] + 0.1] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white"
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              updateItemsWithHistory(prev => prev.map(i => selectedIds.includes(i.id) ? { ...i, sca: [i.sca[0], i.sca[1], Math.max(0.1, i.sca[2] - 0.1)] } : i));
                            }}
                            className="flex items-center justify-center px-1 text-[8px] hover:bg-white/10 active:bg-white/20 leading-none h-[14px] text-white/50 hover:text-white border-t border-white/5"
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      <span className="text-[7px] font-bold text-white/40 uppercase mt-1">Sca Z</span>
                    </div>
                  </div>
                </div>
              </div>


              <div className="grid grid-cols-2 gap-2">
                <button onClick={duplicateSelected} className="flex items-center justify-center gap-2 py-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-2xl text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-white transition-all">
                  <Copy className="w-3 h-3" />
                  Clone
                </button>
                <button onClick={deleteSelected} className="flex items-center justify-center gap-2 py-3 bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-2xl text-[10px] font-black uppercase hover:bg-rose-500 hover:text-white transition-all">
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
              <button onClick={() => setSelectedId(null)} className="w-full py-2 bg-white/5 text-white/40 hover:text-white rounded-xl text-[10px] font-bold uppercase transition-all">Deselect Instance</button>
            </div>
          )}

          {/* Terrain Inspector (Unity Style) */}
          {selectedId === 'terrain' && (
            <div className="flex flex-col gap-4 p-5 bg-indigo-600/10 rounded-[32px] border border-indigo-500/30 animate-in zoom-in-95 duration-300 max-h-[520px] flex-shrink-0 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                  <Mountain className="w-5 h-5" />
                </div>
                <div className="flex flex-col">
                  <span className="text-white font-black uppercase text-xs tracking-widest">Terrain Inspector</span>
                  <span className="text-indigo-400 font-bold text-[9px] uppercase">Core Height & Paint System</span>
                </div>
              </div>

              {/* Scrollable Inspector Body */}
              <div className="flex-grow overflow-y-auto pr-1.5 custom-scrollbar flex flex-col gap-4">

              {/* Transform */}
              <div className="flex flex-col gap-2.5 p-3.5 bg-black/40 rounded-2xl border border-white/5 text-white">
                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/40">Transform</span>
                  <span className="text-[8px] font-bold text-white/20 uppercase">Static Origin</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5 text-xs font-bold text-white/60">
                  <div className="flex justify-between bg-white/5 px-3 py-1.5 rounded-lg">
                    <span className="text-rose-400 font-black">X</span>
                    <span>0.00</span>
                  </div>
                  <div className="flex justify-between bg-white/5 px-3 py-1.5 rounded-lg">
                    <span className="text-emerald-400 font-black">Y</span>
                    <span>-0.30</span>
                  </div>
                  <div className="flex justify-between bg-white/5 px-3 py-1.5 rounded-lg">
                    <span className="text-sky-400 font-black">Z</span>
                    <span>0.00</span>
                  </div>
                </div>
              </div>

              {/* Terrain Mode Selection */}
              <div className="grid grid-cols-2 gap-2 bg-black/40 p-2 rounded-2xl border border-white/5 text-white">
                <button
                  onClick={() => setTerrainMode('paint')}
                  className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    terrainMode === 'paint' 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                      : 'bg-transparent text-white/40 hover:bg-white/5 hover:text-white/60'
                  }`}
                >
                  <Paintbrush className="w-4 h-4" /> Paint Texture
                </button>
                <button
                  onClick={() => setTerrainMode('sculpt')}
                  className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                    terrainMode === 'sculpt' 
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                      : 'bg-transparent text-white/40 hover:bg-white/5 hover:text-white/60'
                  }`}
                >
                  <Mountain className="w-4 h-4" /> Sculpt Height
                </button>
              </div>

              {/* Sculpt Tool Selection (Only visible in sculpt mode) */}
              {terrainMode === 'sculpt' && (
                <div className="flex flex-col gap-2.5 p-3.5 bg-black/40 rounded-2xl border border-white/5 text-white animate-in slide-in-from-top-2 duration-200">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Sculpt Tool Type</span>
                  <div className="grid grid-cols-2 gap-2 bg-white/5 p-1.5 rounded-xl">
                    <button
                      onClick={() => setSculptTool('raise')}
                      className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border ${
                        sculptTool === 'raise' 
                          ? 'bg-emerald-600/30 border-emerald-500 text-emerald-400 font-black' 
                          : 'bg-transparent border-transparent text-white/40 hover:bg-white/5 hover:text-white/70'
                      }`}
                    >
                      <ArrowUp className="w-4 h-4 text-emerald-400" /> Raise Hills
                    </button>
                    <button
                      onClick={() => setSculptTool('lower')}
                      className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border ${
                        sculptTool === 'lower' 
                          ? 'bg-rose-600/30 border-rose-500 text-rose-400 font-black' 
                          : 'bg-transparent border-transparent text-white/40 hover:bg-white/5 hover:text-white/70'
                      }`}
                    >
                      <ArrowDown className="w-4 h-4 text-rose-400" /> Lower Valleys
                    </button>
                    <button
                      onClick={() => setSculptTool('smooth')}
                      className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border ${
                        sculptTool === 'smooth' 
                          ? 'bg-cyan-600/30 border-cyan-500 text-cyan-400 font-black' 
                          : 'bg-transparent border-transparent text-white/40 hover:bg-white/5 hover:text-white/70'
                      }`}
                    >
                      <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" /> Smooth Slopes
                    </button>
                    <button
                      onClick={() => setSculptTool('flatten')}
                      className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all border ${
                        sculptTool === 'flatten' 
                          ? 'bg-amber-600/30 border-amber-500 text-amber-400 font-black' 
                          : 'bg-transparent border-transparent text-white/40 hover:bg-white/5 hover:text-white/70'
                      }`}
                    >
                      <Eraser className="w-4 h-4 text-amber-400" /> Flatten Plain
                    </button>
                  </div>
                </div>
              )}

              {/* Mountain Generators */}
              <div className="flex flex-col gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 text-white">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                    <Sliders className="w-4 h-4" /> Mountain Generators
                  </span>
                </div>

                {/* Procedural Terrain Presets */}
                <div className="flex flex-col gap-2 border-b border-white/5 pb-3">
                  <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Terrain Layout Presets</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: '☘️ Plains', label: 'Plains', desc: 'Flat land', height: 4, scale: 0.01, seed: 12 },
                      { name: '⛰️ Hills', label: 'Hills', desc: 'Rolling hills', height: 18, scale: 0.05, seed: 42 },
                      { name: '🏔️ Peaks', label: 'Peaks', desc: 'Rugged mountains', height: 50, scale: 0.12, seed: 250 },
                      { name: '🌋 Crater', label: 'Crater', desc: 'Canyon floor', height: 32, scale: 0.03, seed: 99 }
                    ].map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setTerrainConfig({ height: preset.height, scale: preset.scale, seed: preset.seed });
                        }}
                        className="py-1.5 px-1 bg-white/5 hover:bg-indigo-600 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all flex flex-col items-center justify-center gap-0.5 border border-white/5 hover:border-indigo-500 active:scale-95"
                        title={preset.desc}
                      >
                        <span className="text-xs">{preset.name.split(' ')[0]}</span>
                        <span className="text-[8px] opacity-70">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Peak Height */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white/50 uppercase">Peak Height</span>
                    <span className="font-black text-emerald-400">{terrainConfig.height.toFixed(0)}m</span>
                  </div>
                  <input 
                    type="range" min="0" max="100" step="1" 
                    value={terrainConfig.height} 
                    onChange={(e) => setTerrainConfig({ height: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Terrain Scale */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white/50 uppercase">Terrain Scale</span>
                    <span className="font-black text-amber-400">x{terrainConfig.scale.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range" min="0.01" max="2" step="0.01" 
                    value={terrainConfig.scale} 
                    onChange={(e) => setTerrainConfig({ scale: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* World Seed */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white/50 uppercase">World Seed</span>
                    <span className="font-black text-sky-400">#{terrainConfig.seed}</span>
                  </div>
                  <input 
                    type="range" min="0" max="1000" step="1" 
                    value={terrainConfig.seed} 
                    onChange={(e) => setTerrainConfig({ seed: parseInt(e.target.value) })}
                    className="w-full accent-sky-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Peak Sharpness */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white/50 uppercase">Peak Sharpness</span>
                    <span className="font-black text-rose-400">
                      {(terrainConfig.sharpness ?? 2.0) === 1.0 ? 'Linear' : (terrainConfig.sharpness ?? 2.0) <= 2.2 ? 'Standard' : 'Spiky'} ({(terrainConfig.sharpness ?? 2.0).toFixed(1)})
                    </span>
                  </div>
                  <input 
                    type="range" min="1.0" max="4.0" step="0.1" 
                    value={terrainConfig.sharpness ?? 2.0} 
                    onChange={(e) => setTerrainConfig({ sharpness: parseFloat(e.target.value) })}
                    className="w-full accent-rose-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Base Color & Material (Only visible in paint mode) */}
                {terrainMode === 'paint' && (
                  <>
                    {/* Base Color */}
                    <div className="flex flex-col gap-2.5 border-t border-white/5 pt-4 animate-in fade-in duration-200">
                      <label className="text-[10px] font-bold text-white/50 uppercase">Terrain Base Color</label>
                      <div className="flex items-center gap-3.5 bg-white/5 p-2.5 rounded-xl border border-white/5">
                        <input 
                          type="color" 
                          value={terrainColor} 
                          onChange={(e) => setTerrainColor(e.target.value)}
                          className="w-12 h-9 rounded-lg bg-transparent cursor-pointer border-none p-0 overflow-hidden"
                        />
                        <span className="text-xs font-black text-white/60 uppercase tracking-widest">{terrainColor}</span>
                        <div className="flex-1" />
                        <div className="w-5 h-5 rounded-full border border-white/10" style={{ backgroundColor: terrainColor }} />
                      </div>
                    </div>

                    {/* Terrain Material */}
                    <div className="flex flex-col gap-2.5 border-t border-white/5 pt-4 animate-in fade-in duration-200">
                      <label className="text-[10px] font-bold text-white/50 uppercase">Terrain Ground Material</label>
                      <div className="grid grid-cols-3 gap-2.5">
                        <button 
                          onClick={() => setTerrainMaterialId(null)}
                          className={`h-12 rounded-xl border transition-all flex items-center justify-center text-[9px] font-black uppercase tracking-widest ${
                            !terrainMaterialId ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-white/5 border-transparent text-white/20 hover:bg-white/10'
                          }`}
                        >
                          Painterly
                        </button>
                        {FULL_MATERIAL_LIBRARY.slice(0, 2).map((mat: any) => (
                          <button 
                            key={mat.id}
                            onClick={() => setTerrainMaterialId(mat.id)}
                            className={`h-12 rounded-xl border transition-all relative overflow-hidden ${
                              terrainMaterialId === mat.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/30' : 'border-transparent hover:border-white/20'
                            }`}
                          >
                            {mat.diffuse && <img src={mat.diffuse} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                              <span className="text-[9px] font-black uppercase tracking-tighter text-white">{mat.name}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Procedural Vegetation Generator */}
              <div className="flex flex-col gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 text-white animate-in slide-in-from-bottom duration-300">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" /> Vegetation Spawner
                  </span>
                </div>

                {/* Theme presets */}
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Forest Theme</span>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[
                      { id: 'pine', label: 'Pine', icon: '🌲' },
                      { id: 'cherry', label: 'Cherry', icon: '🌸' },
                      { id: 'autumn', label: 'Autumn', icon: '🍁' },
                      { id: 'desert', label: 'Desert', icon: '🏜️' },
                      { id: 'clover', label: 'Clover', icon: '🍀' }
                    ].map(theme => (
                      <button
                        key={theme.id}
                        onClick={() => setVegetationTheme(theme.id as any)}
                        className={`py-2 rounded-xl text-[8px] font-black uppercase tracking-tighter transition-all flex flex-col items-center justify-center gap-0.5 border active:scale-95 ${
                          vegetationTheme === theme.id 
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-black shadow-lg shadow-emerald-500/20 scale-105' 
                            : 'bg-white/5 border-white/5 text-white/50 hover:text-white hover:border-white/20'
                        }`}
                      >
                        <span className="text-sm">{theme.icon}</span>
                        <span>{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Density slider */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white/50 uppercase">Spawn Density</span>
                    <span className="font-black text-emerald-400">{vegetationDensity} Assets</span>
                  </div>
                  <input 
                    type="range" min="10" max="200" step="5" 
                    value={vegetationDensity} 
                    onChange={(e) => setVegetationDensity(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Spawner Actions */}
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button
                    onClick={() => generateVegetation()}
                    className="py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-[10px] font-black uppercase tracking-widest transition-all shadow-lg hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-1.5 border border-emerald-400/20"
                  >
                    Generate Forest
                  </button>
                  <button
                    onClick={() => clearVegetation()}
                    className="py-2.5 rounded-xl bg-white/5 hover:bg-rose-950/20 hover:text-rose-400 text-white/60 text-[10px] font-black uppercase tracking-widest transition-all border border-white/5 hover:border-rose-500/30 active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    Clear Forest
                  </button>
                </div>
              </div>

              {/* Paint Brush & Masks Settings */}
              <div className="flex flex-col gap-4.5 p-4.5 bg-black/40 rounded-[24px] border border-white/5 text-white">
                <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 flex items-center gap-2">
                    <Paintbrush className="w-4 h-4" /> Brush Settings
                  </span>
                  
                  {/* Active Badge */}
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-[8px] font-black text-emerald-400 border border-emerald-500/30 uppercase tracking-wider animate-pulse">
                    Brush Mode Active
                  </span>
                </div>

                {/* Brushes Grid */}
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Brush Masks</span>
                  <div className="grid grid-cols-6 gap-2.5 bg-white/5 p-2 rounded-xl border border-white/5">
                    {/* Soft Circle */}
                    <button 
                      onClick={() => setBrushMaskId('softCircle')}
                      title="Soft Circle"
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        brushMaskId === 'softCircle' ? 'bg-indigo-600/30 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-500/20' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5 hover:text-white/60'
                      }`}
                    >
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <defs>
                          <radialGradient id="softGlowInspector" cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                          </radialGradient>
                        </defs>
                        <circle cx="12" cy="12" r="10" fill="url(#softGlowInspector)" />
                      </svg>
                    </button>

                    {/* Hard Circle */}
                    <button 
                      onClick={() => setBrushMaskId('hardCircle')}
                      title="Hard Circle"
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        brushMaskId === 'hardCircle' ? 'bg-indigo-600/30 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-500/20' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5 hover:text-white/60'
                      }`}
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                    </button>

                    {/* Star */}
                    <button 
                      onClick={() => setBrushMaskId('star')}
                      title="Star Ridge"
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        brushMaskId === 'star' ? 'bg-indigo-600/30 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-500/20' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5 hover:text-white/60'
                      }`}
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
                      </svg>
                    </button>

                    {/* Hexagon */}
                    <button 
                      onClick={() => setBrushMaskId('hexagon')}
                      title="Hexagon Column"
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        brushMaskId === 'hexagon' ? 'bg-indigo-600/30 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-500/20' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5 hover:text-white/60'
                      }`}
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 2l8.66 5v10L12 22l-8.66-5V7z" />
                      </svg>
                    </button>

                    {/* Star Outline */}
                    <button 
                      onClick={() => setBrushMaskId('starOutline')}
                      title="Crater (Ring)"
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        brushMaskId === 'starOutline' ? 'bg-indigo-600/30 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-500/20' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5 hover:text-white/60'
                      }`}
                    >
                      <svg className="w-5 h-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="3">
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                    </button>

                    {/* Square */}
                    <button 
                      onClick={() => setBrushMaskId('square')}
                      title="Square Block"
                      className={`h-10 rounded-lg border flex items-center justify-center transition-all ${
                        brushMaskId === 'square' ? 'bg-indigo-600/30 border-indigo-500 text-white scale-105 shadow-md shadow-indigo-500/20' : 'bg-transparent border-transparent text-white/30 hover:bg-white/5 hover:text-white/60'
                      }`}
                    >
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                        <rect x="4" y="4" width="16" height="16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Quick Brush Presets */}
                <div className="flex flex-col gap-2 bg-white/5 p-2.5 rounded-xl border border-white/5">
                  <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Quick Brush Presets</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { name: '🖌️ Detail', label: 'Detail', size: 10, strength: 1.0, mask: 'hardCircle' },
                      { name: '💨 Blend', label: 'Blend', size: 45, strength: 0.25, mask: 'softCircle' },
                      { name: '🔨 Carver', label: 'Carver', size: 85, strength: 0.75, mask: 'softCircle' },
                      { name: '🌋 Crater', label: 'Crater', size: 50, strength: 0.7, mask: 'starOutline' }
                    ].map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => {
                          setBrushSize(preset.size);
                          setBrushStrength(preset.strength);
                          setBrushMaskId(preset.mask as any);
                        }}
                        className="py-1.5 px-1 bg-white/5 hover:bg-indigo-600 hover:text-white rounded-lg text-[8.5px] font-bold uppercase transition-all border border-transparent hover:border-indigo-400 active:scale-95 text-center"
                      >
                        <span className="block text-[10px] font-black">{preset.name.split(' ')[0]}</span>
                        <span className="text-[7.5px] opacity-60 block tracking-tighter">{preset.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stroke Sliders */}
                <div className="flex flex-col gap-4">
                  {/* Brush Size */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-white/40 uppercase">Brush Size</span>
                      <span className="font-black text-indigo-300 text-xs">{brushSize}px</span>
                    </div>
                    <input 
                      type="range" min="1" max="150" step="1" 
                      value={brushSize} 
                      onChange={(e) => setBrushSize(parseInt(e.target.value))}
                      className="w-full accent-indigo-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Brush Strength */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-white/40 uppercase">Brush Strength</span>
                      <span className="font-black text-emerald-400 text-xs">{(brushStrength * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                      type="range" min="0.01" max="1.0" step="0.01" 
                      value={brushStrength} 
                      onChange={(e) => setBrushStrength(parseFloat(e.target.value))}
                      className="w-full accent-emerald-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  {/* Brush Rotation */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-white/40 uppercase">Brush Rotation</span>
                      <span className="font-black text-amber-400 text-xs">{brushRotation}°</span>
                    </div>
                    <input 
                      type="range" min="0" max="360" step="1" 
                      value={brushRotation} 
                      onChange={(e) => setBrushRotation(parseInt(e.target.value))}
                      className="w-full accent-amber-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Brush Colors & Materials (Only visible in paint mode) */}
                {terrainMode === 'paint' && (
                  <div className="flex flex-col gap-4 border-t border-white/5 pt-4 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Brush Colors & Textures</span>
                    </div>

                    {/* Color Palette */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] font-bold text-white/20 uppercase font-sans">Solid Colors</span>
                      <div className="flex gap-2.5 items-center bg-white/5 p-2 rounded-xl border border-white/5">
                        {['#5a4d3a', '#3d5c36', '#7c6a4a', '#2d3e4d', '#ffffff'].map(c => (
                          <button 
                            key={c}
                            onClick={() => {
                              setBrushColor(c);
                              setBrushTextureId(null);
                            }}
                            className={`w-8 h-8 rounded-lg border-2 transition-all ${
                              brushColor === c && !brushTextureId ? 'border-indigo-500 scale-110 shadow-lg shadow-indigo-500/20' : 'border-transparent hover:scale-105'
                            }`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input 
                          type="color" 
                          value={brushColor} 
                          onChange={(e) => {
                            setBrushColor(e.target.value);
                            setBrushTextureId(null);
                          }}
                          className="w-8 h-8 rounded-lg bg-transparent cursor-pointer border-none p-0 overflow-hidden"
                        />
                      </div>
                    </div>

                    {/* Splat Textures */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[9px] font-bold text-white/20 uppercase font-sans">Ground Splat Textures</span>
                      <div className="grid grid-cols-4 gap-2.5 bg-white/5 p-2 rounded-xl border border-white/5">
                        <button 
                          onClick={() => setBrushTextureId(null)}
                          className={`h-12 rounded-lg border transition-all flex items-center justify-center text-[8px] font-black uppercase ${
                            !brushTextureId ? 'bg-indigo-600/30 border-indigo-500 text-white shadow-md shadow-indigo-500/20' : 'bg-transparent border-transparent text-white/20 hover:bg-white/5'
                          }`}
                        >
                          Solid
                        </button>
                        {FULL_MATERIAL_LIBRARY.slice(0, 3).map((mat: any) => (
                          <button 
                            key={mat.id}
                            onClick={() => setBrushTextureId(mat.id)}
                            className={`h-12 rounded-lg border transition-all relative overflow-hidden ${
                              brushTextureId === mat.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/20' : 'border-transparent hover:border-white/20'
                            }`}
                          >
                            {mat.diffuse && <img src={mat.diffuse} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}



              {/* Terrain Reset Operations (Always visible) */}
              <div className="flex flex-col gap-2 p-3 bg-rose-500/5 rounded-2xl border border-rose-500/10 text-white mt-1">
                <span className="text-[9px] font-black text-rose-400/60 uppercase tracking-widest">Terrain Reset Operations</span>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => {
                      if (confirm("Reset all custom paint colors/textures?")) {
                        setPaintData(null);
                      }
                    }}
                    className="py-2.5 px-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500 rounded-xl text-[9.5px] font-black uppercase tracking-tight transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
                  >
                    <span>🎨</span>
                    <span>Reset Paint</span>
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm("Reset all dynamic sculpt heights and flatten terrain?")) {
                        setSculptData(null);
                      }
                    }}
                    className="py-2.5 px-2 bg-rose-500/10 hover:bg-rose-500 hover:text-white border border-rose-500/20 hover:border-rose-500 rounded-xl text-[9.5px] font-black uppercase tracking-tight transition-all active:scale-95 text-center flex items-center justify-center gap-1.5"
                  >
                    <span>⛰️</span>
                    <span>Reset Sculpt</span>
                  </button>
                </div>
              </div>

              {/* Smart Paint & Sculpt Suggestions Board */}
              <div className="flex flex-col gap-3.5 p-4 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/25 rounded-2xl text-xs leading-relaxed text-indigo-200 shadow-lg shadow-indigo-950/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Title & Status Indicator */}
                <div className="flex items-center justify-between border-b border-indigo-500/15 pb-2">
                  <span className="font-black text-[9px] tracking-[0.15em] uppercase text-indigo-300 flex items-center gap-2">
                    {terrainMode === 'paint' ? '🎨 ARTIST PAINTING GUIDE' : '⛰️ TERRAIN SCULPT GUIDE'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">LIVE GUIDE</span>
                  </div>
                </div>

                {/* Curated Tips / Workflow Steps */}
                <div className="flex flex-col gap-2.5 text-[10px] font-bold">
                  {terrainMode === 'paint' ? (
                    <>
                      <div className="flex items-start gap-2.5 bg-indigo-500/5 hover:bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/10 transition-colors">
                        <span className="text-sm">👆</span>
                        <div>
                          <span className="text-white block font-black mb-0.5">Langkah 1: Klik Kiri + Geser</span>
                          Klik tombol kiri mouse di atas kanvas 3D dan seret untuk langsung melukis warna / tekstur tanah secara real-time.
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 bg-indigo-500/5 hover:bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/10 transition-colors">
                        <span className="text-sm">🎯</span>
                        <div>
                          <span className="text-indigo-300 block font-black mb-0.5">Gunakan Mask Kuas Kustom</span>
                          Pilih bentuk **Star**, **Hexagon**, atau **Ring** di bawah untuk menciptakan variasi jalan berbatu atau rumput alami.
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 bg-indigo-500/5 hover:bg-indigo-500/10 p-2.5 rounded-xl border border-indigo-500/10 transition-colors">
                        <span className="text-sm">🔮</span>
                        <div>
                          <span className="text-indigo-300 block font-black mb-0.5">Pencampuran Halus (Splat Blending)</span>
                          Turunkan **Brush Strength** (`0.2 - 0.4`) untuk mencampur batas warna tanah secara super halus dan alami!
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-start gap-2.5 bg-sky-500/5 hover:bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/10 transition-colors">
                        <span className="text-sm">⛰️</span>
                        <div>
                          <span className="text-white block font-black mb-0.5">Raise & Lower (Tebing & Lembah)</span>
                          Gunakan **Raise** untuk mengangkat gunung salju, dan **Lower** untuk menggali danau, jurang, atau dasar sungai.
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 bg-sky-500/5 hover:bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/10 transition-colors">
                        <span className="text-sm">🌊</span>
                        <div>
                          <span className="text-sky-300 block font-black mb-0.5">Smooth Tool (Haluskan Lereng)</span>
                          Pilih **Smooth** untuk melembutkan puncak lancip yang terlalu kasar menjadi bukit yang cantik untuk jalur jalan.
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 bg-sky-500/5 hover:bg-sky-500/10 p-2.5 rounded-xl border border-sky-500/10 transition-colors">
                        <span className="text-sm">🏢</span>
                        <div>
                          <span className="text-sky-300 block font-black mb-0.5">Flatten (Ratakan Lapangan Battle)</span>
                          Gunakan **Flatten** untuk meratakan tebing tinggi menjadi dataran luas untuk menempatkan kastil atau markas tempur!
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Active Tool Shortcut Quick Reference */}
                <div className="mt-1 bg-black/30 p-2.5 rounded-xl text-[8.5px] text-white/50 flex flex-col gap-1.5 font-bold border border-white/5">
                  <div className="flex justify-between items-center">
                    <span>🎮 MELUKIS / MEMAHAT:</span>
                    <span className="text-indigo-300 font-black uppercase tracking-wider bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      KLIK MOUSE + SERET
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>⚡ BALIK PAHAT (INVERT):</span>
                    <span className="text-emerald-300 font-black uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      SHIFT + KLIK MOUSE
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>🖌️ RESIZE / STRENGTH KUAS:</span>
                    <span className="text-amber-300 font-black uppercase tracking-wider bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      TOMBOL [ ] / - +
                    </span>
                  </div>
                </div>
              </div>
              </div>

              </div> {/* Close Scrollable Inspector Body */}

              <button onClick={() => setSelectedId(null)} className="w-full py-3 bg-white/5 text-white/40 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-transparent hover:border-white/10 active:scale-[0.98]">Deselect Terrain</button>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
            <button onClick={copyMapCode} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3">
               <Copy className="w-4 h-4" />
               Copy Map Configuration
            </button>
            <div className="flex gap-2">
              <button onClick={exportMap} className="flex-1 py-2 bg-white/5 text-white/40 hover:text-white rounded-xl font-bold uppercase text-[9px] transition-all">Export JSON</button>
              <button onClick={handleClearMap} className="flex-1 py-2 text-white/10 hover:text-rose-400 rounded-xl text-[9px] font-bold transition-colors">Wipe Scene</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
