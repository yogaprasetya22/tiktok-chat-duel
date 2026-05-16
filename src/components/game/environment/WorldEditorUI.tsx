'use client';

import React, { Suspense, useEffect, useCallback, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { useGLTF, Stage, Center } from '@react-three/drei';
import { useInView } from 'react-intersection-observer';
import { Search, MousePointer2, Box, Trash2, Copy, Undo2, Redo2, Layers, Package, Loader2 } from 'lucide-react';
import { useEditorStore, ASSET_LIBRARY } from '@/src/state/useEditorStore';
import { FULL_MATERIAL_LIBRARY } from '@/src/core/logic/environment/assetRegistry';


// Global cache for asset thumbnails to persist across re-renders
const thumbnailCache: Record<string, string> = {};

const ModelPreview = ({ path, onCapture }: { path: string, onCapture: (dataUrl: string) => void }) => {
  const { scene } = useGLTF(path);
  const { gl, scene: threeScene, camera } = useThree();
  const cloned = useMemo(() => scene.clone(), [scene]);
  
  // Capture snapshot after a short delay to ensure Stage lighting is applied
  useEffect(() => {
    const timer = setTimeout(() => {
      if (gl.domElement) {
        // Render one frame specifically for capture if needed, though Stage handles it
        gl.render(threeScene, camera);
        const dataUrl = gl.domElement.toDataURL('image/webp', 0.5);
        if (dataUrl && dataUrl.length > 100) {
          onCapture(dataUrl);
        }
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [gl, path, onCapture, threeScene, camera]);

  return (
    <Stage intensity={0.8} environment="city" adjustCamera={true}>
      <Center>
        <primitive object={cloned} />
      </Center>
    </Stage>
  );
};

const AssetCard = ({ asset, isActive, onClick }: { asset: any, isActive: boolean, onClick: () => void }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [thumbnail, setThumbnail] = React.useState<string | null>(thumbnailCache[asset.path || asset.id] || null);
  
  const { ref, inView } = useInView({
    triggerOnce: false,
    threshold: 0.1,
  });

  const handleCapture = useCallback((dataUrl: string) => {
    thumbnailCache[asset.path || asset.id] = dataUrl;
    setThumbnail(dataUrl);
  }, [asset]);

  return (
    <button
      ref={ref}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative flex flex-col gap-2 p-2 rounded-2xl transition-all duration-300 border-2 ${isActive ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/20 scale-[0.98]' : 'bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10'}`}
    >
      <div className="aspect-square w-full bg-black/40 rounded-xl overflow-hidden flex items-center justify-center relative shadow-inner">
        {asset.diffuse ? (
          <img src={asset.diffuse} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : thumbnail ? (
          <img src={thumbnail} className="w-full h-full object-contain opacity-90 group-hover:opacity-100 transition-opacity" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {(inView && isHovered) ? (
              <Suspense fallback={<Loader2 className="w-4 h-4 text-white/20 animate-spin" />}>
                <Canvas 
                  shadows 
                  dpr={[1, 1]} 
                  camera={{ position: [0, 0, 5], fov: 60 }} 
                  gl={{ 
                    antialias: false, 
                    powerPreference: 'low-power',
                    preserveDrawingBuffer: true // Required for toDataURL
                  }}
                >
                  <ModelPreview path={asset.path} onCapture={handleCapture} />
                </Canvas>
              </Suspense>
            ) : (
              <Package className={`w-6 h-6 transition-all duration-300 ${isActive ? 'text-indigo-400' : 'text-white/10 group-hover:text-white/20'}`} />
            )}
          </div>
        )}
        <div className={`absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
      </div>
      <span className={`text-[9px] font-black uppercase tracking-widest text-center truncate px-1 ${isActive ? 'text-white' : 'text-white/40'}`}>
        {asset.name}
      </span>
    </button>
  );
};

export const WorldEditorUI = () => {
  const {
    isEditorOpen,
    setIsEditorOpen,
    items,
    selectedId,
    setSelectedId,
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
    paintMode,
    setPaintMode,
    brushSize,
    setBrushSize,
    brushColor,
    setBrushColor,
    brushTextureId,
    setBrushTextureId,
    setPaintData
  } = useEditorStore();

  const [mounted, setMounted] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [isInitializing, setIsInitializing] = React.useState(true);

  React.useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setIsInitializing(false), 1200);
    return () => clearTimeout(timer);
  }, []);

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
    if (selectedId) {
      updateItemsWithHistory(prev => prev.filter(i => i.id !== selectedId));
      setSelectedId(null);
    }
  };

  const duplicateSelected = () => {
    const item = items.find(i => i.id === selectedId);
    if (item) {
      const newItem = { 
        ...item, 
        id: "item_" + Math.random().toString(36).substr(2, 9), 
        pos: [item.pos[0] + 1, item.pos[1], item.pos[2] + 1] as [number, number, number] 
      };
      updateItemsWithHistory(prev => [...prev, newItem]);
      setSelectedId(newItem.id);
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
        <div className="world-editor-ui w-[420px] h-full bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[32px] p-6 shadow-2xl flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 pointer-events-auto overflow-hidden">
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
                  <label className="text-[9px] font-bold text-white/40 uppercase">Peak Height</label>
                  <input 
                    type="range" min="0" max="100" step="1" 
                    value={terrainConfig.height} 
                    onChange={(e) => setTerrainConfig({ height: parseFloat(e.target.value) })}
                    className="w-full accent-emerald-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-[9px] font-black text-emerald-300 text-right">{terrainConfig.height.toFixed(0)}m</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-white/40 uppercase">Terrain Scale</label>
                  <input 
                    type="range" min="0.01" max="2" step="0.01" 
                    value={terrainConfig.scale} 
                    onChange={(e) => setTerrainConfig({ scale: parseFloat(e.target.value) })}
                    className="w-full accent-amber-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-[9px] font-black text-amber-300 text-right">x{terrainConfig.scale.toFixed(2)}</div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[9px] font-bold text-white/40 uppercase">World Seed</label>
                  <input 
                    type="range" min="0" max="1000" step="1" 
                    value={terrainConfig.seed} 
                    onChange={(e) => setTerrainConfig({ seed: parseInt(e.target.value) })}
                    className="w-full accent-sky-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="text-[9px] font-black text-sky-300 text-right">#{terrainConfig.seed}</div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-bold text-white/40 uppercase">Terrain Base Color</label>
                <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
                  <input 
                    type="color" 
                    value={terrainColor} 
                    onChange={(e) => setTerrainColor(e.target.value)}
                    className="w-10 h-8 rounded-lg bg-transparent cursor-pointer border-none p-0 overflow-hidden"
                  />
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{terrainColor}</span>
                  <div className="flex-1" />
                  <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: terrainColor }} />
                </div>
              </div>

              <div className="flex flex-col gap-3 p-3 bg-white/5 rounded-2xl border border-white/5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Terrain Painter</label>
                  <button 
                    onClick={() => setPaintMode(!paintMode)}
                    className={`px-3 py-1 rounded-full text-[8px] font-black uppercase transition-all ${paintMode ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/10 text-white/40'}`}
                  >
                    {paintMode ? 'ON' : 'OFF'}
                  </button>
                </div>
                
                {paintMode && (
                  <div className="flex flex-col gap-3 mt-2 animate-in fade-in slide-in-from-top-2">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[9px] font-bold text-white/30 uppercase">Brush Size</label>
                        <span className="text-[9px] font-black text-indigo-400">{brushSize}px</span>
                      </div>
                      <input 
                        type="range" min="1" max="100" step="1" 
                        value={brushSize} 
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-full accent-indigo-500 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-bold text-white/30 uppercase">Brush Color</label>
                      <div className="flex gap-2">
                        {['#5a4d3a', '#3d5c36', '#7c6a4a', '#2d3e4d', '#ffffff'].map(c => (
                          <button 
                            key={c}
                            onClick={() => setBrushColor(c)}
                            className={`w-6 h-6 rounded-lg border-2 transition-all ${brushColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        <input 
                          type="color" 
                          value={brushColor} 
                          onChange={(e) => setBrushColor(e.target.value)}
                          className="w-6 h-6 rounded-lg bg-transparent cursor-pointer border-none p-0 overflow-hidden"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[9px] font-bold text-white/30 uppercase">Brush Texture</label>
                      <div className="grid grid-cols-4 gap-2">
                        <button 
                          onClick={() => setBrushTextureId(null)}
                          className={`h-10 rounded-lg border-2 transition-all flex items-center justify-center text-[7px] font-black uppercase ${!brushTextureId ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-white/5 border-transparent text-white/20'}`}
                        >
                          Solid
                        </button>
                        {FULL_MATERIAL_LIBRARY.slice(0, 3).map((mat: any) => (
                          <button 
                            key={mat.id}
                            onClick={() => setBrushTextureId(mat.id)}
                            className={`h-10 rounded-lg border-2 transition-all relative overflow-hidden ${brushTextureId === mat.id ? 'border-indigo-500 shadow-lg' : 'border-transparent hover:border-white/20'}`}
                          >
                            {mat.diffuse && <img src={mat.diffuse} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button 
                      onClick={() => setPaintData(null)}
                      className="text-[8px] font-bold text-red-400/60 hover:text-red-400 uppercase tracking-widest text-right mt-1 transition-colors"
                    >
                      Clear Painting
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[9px] font-bold text-white/40 uppercase">Terrain Material</label>
                <div className="grid grid-cols-3 gap-2">
                  <button 
                    onClick={() => setTerrainMaterialId(null)}
                    className={`h-12 rounded-xl border-2 transition-all flex items-center justify-center text-[8px] font-black uppercase tracking-widest ${!terrainMaterialId ? 'bg-indigo-600/20 border-indigo-500 text-white' : 'bg-white/5 border-transparent text-white/20 hover:bg-white/10'}`}
                  >
                    Painterly
                  </button>
                  {FULL_MATERIAL_LIBRARY.map((mat: any) => (
                    <button 
                      key={mat.id}
                      onClick={() => setTerrainMaterialId(mat.id)}
                      className={`h-12 rounded-xl border-2 transition-all relative overflow-hidden ${terrainMaterialId === mat.id ? 'border-indigo-500 shadow-lg shadow-indigo-500/30' : 'border-transparent hover:border-white/20'}`}
                    >
                      {mat.diffuse && <img src={mat.diffuse} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <span className="text-[8px] font-black uppercase tracking-tighter text-white">{mat.name}</span>
                      </div>
                    </button>
                  ))}
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
                {items.length === 0 && <p className="text-white/20 text-[10px] text-center py-6 italic font-medium">Empty scene — pick an asset to start</p>}
                {[...items].reverse().map(item => (
                  <div key={item.id} className={`flex items-center justify-between p-2 rounded-xl border transition-all ${selectedId === item.id ? 'bg-indigo-500 text-white border-indigo-400 shadow-lg' : 'bg-black/20 border-transparent hover:bg-black/40'}`}>
                    <button 
                      onClick={() => setSelectedId(item.id)}
                      className="flex-1 text-left text-[10px] font-black uppercase flex items-center gap-3 px-2 truncate"
                    >
                      <Layers className={`w-3 h-3 ${selectedId === item.id ? 'text-white' : 'text-indigo-500'}`} />
                      {item.type}
                    </button>
                    <button 
                      onClick={() => {
                        updateItemsWithHistory(prev => prev.filter(i => i.id !== item.id));
                        if(selectedId === item.id) setSelectedId(null);
                      }}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${selectedId === item.id ? 'bg-white/20 text-white hover:bg-white/40' : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white'}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contextual Selection Tools */}
          {selectedId && (
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
