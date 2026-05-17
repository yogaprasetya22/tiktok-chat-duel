'use client';

import { useState, useEffect, useMemo, useCallback, useRef, memo, Suspense } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore, MapItem } from '@/src/state/useEditorStore';

// A highly aesthetic semi-transparent 3D preview of the model being placed
const GhostPreview = ({ path, position, scale, rotation }: { path: string, position: THREE.Vector3, scale: number | [number, number, number], rotation: [number, number, number] }) => {
  const { scene } = useGLTF(path);
  const ghost = useMemo(() => {
    const clone = scene.clone();
    clone.traverse((node: any) => {
      if (node.isMesh) {
        node.material = node.material.clone();
        node.material.transparent = true;
        node.material.opacity = 0.45;
        node.material.depthWrite = false;
        node.material.color.set('#6366f1'); // High-tech neon indigo glow!
        node.material.emissive = new THREE.Color('#4f46e5');
        node.material.emissiveIntensity = 0.5;
      }
    });
    return clone;
  }, [scene]);

  const sca: [number, number, number] = Array.isArray(scale) ? scale : [scale, scale, scale];

  return <primitive object={ghost} position={position} rotation={rotation} scale={sca} />;
};

// A highly robust wrapper for TransformControls that handles unmounting and detached objects gracefully
const SafeTransformControls = ({ object, ...props }: any) => {
  const [isAttached, setIsAttached] = useState(false);

  useEffect(() => {
    if (!object) {
      setIsAttached(false);
      return;
    }

    const checkAttachment = () => {
      let root = object;
      while (root.parent) {
        root = root.parent;
      }
      setIsAttached(root.type === 'Scene');
    };

    checkAttachment();
    
    // Periodically double check to catch rapid React state updates
    const interval = setInterval(checkAttachment, 50);
    return () => clearInterval(interval);
  }, [object]);

  if (!isAttached || !object || !object.parent) return null;

  return <TransformControls object={object} {...props} />;
};

// --- EDITOR COMPONENT (3D Scene Only) ---
export const WorldEditor = () => {
  const { scene, raycaster, mouse, camera, gl } = useThree();
  const {
    items,
    selectedId,
    setSelectedId,
    selectedIds,
    toggleSelectedId,
    mode,
    activeAsset,
    setActiveAsset,
    isEditorOpen,
    updateItemsWithHistory,
    undo,
    redo,
    loadFromStorage,
    gridSize,
    gridEnabled,
    paintMode,
    brushHoverPos,
    setBrushHoverPos,
    lastUsedScales,
    setLastUsedScale,
    lastUsedRotations,
    setLastUsedRotation,
  } = useEditorStore();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);
  const [isOverUI, setIsOverUI] = useState(false);

  // Store start states of all selected objects when dragging begins
  const dragStartStatesRef = useRef<Map<string, { pos: [number, number, number], rot: [number, number, number], sca: [number, number, number] }>>(new Map());

  // Track initial pointer down coordinates and timestamp to distinguish taps from camera drags
  const pointerStartRef = useRef<{ time: number; x: number; y: number } | null>(null);

  // Load from local storage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Pre-load active asset dynamically when selected in the palette to warm up browser and Drei cache
  useEffect(() => {
    if (activeAsset) {
      useGLTF.preload(activeAsset.path);
    }
  }, [activeAsset]);

  const snap = useCallback((val: number) => {
    if (!gridEnabled) return val;
    return Math.round(val / gridSize) * gridSize;
  }, [gridEnabled, gridSize]);

  const spawnAtPoint = useCallback((point: THREE.Vector3) => {
    if (!activeAsset || paintMode) return;

    const snappedPos: [number, number, number] = [
      snap(point.x),
      point.y,
      snap(point.z)
    ];

    const cachedScale = lastUsedScales[activeAsset.path] || [1, 1, 1];
    const cachedRotation = lastUsedRotations[activeAsset.path] || [0, 0, 0];

    const newItem: MapItem = {
      id: "item_" + Math.random().toString(36).substr(2, 9),
      type: activeAsset.name,
      path: activeAsset.path,
      pos: snappedPos,
      rot: cachedRotation,
      sca: cachedScale,
    };
    updateItemsWithHistory(prev => [...prev, newItem]);
    setSelectedId(newItem.id);
  }, [activeAsset, updateItemsWithHistory, setSelectedId, snap, lastUsedScales, lastUsedRotations]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length > 0) {
      updateItemsWithHistory(prev => prev.filter(i => !selectedIds.includes(i.id)));
      setSelectedId(null);
    }
  }, [selectedIds, updateItemsWithHistory, setSelectedId]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isEditorOpen) return;
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.length > 0 && !document.activeElement?.matches('input, textarea')) {
          deleteSelected();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditorOpen, undo, redo, selectedIds, deleteSelected]);

  useEffect(() => {
    if (!isEditorOpen) return;

    const onMove = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      const over = !!(
        target.closest('.world-editor-ui') || 
        target.closest('[data-leva]') || 
        target.closest('#leva__root') ||
        ['BUTTON', 'INPUT', 'SELECT', 'LABEL'].includes(target.tagName)
      );
      setIsOverUI(over);
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || isOverUI || paintMode) return;
      
      const target = e.target as HTMLElement;
      if (
        target.closest('.world-editor-ui') || 
        target.closest('[data-leva]') || 
        target.closest('#leva__root') ||
        ['BUTTON', 'INPUT', 'SELECT', 'LABEL'].includes(target.tagName)
      ) return;

      // Capture pointer start coordinates and time
      pointerStartRef.current = {
        time: Date.now(),
        x: e.clientX,
        y: e.clientY,
      };
    };

    const onUp = (e: PointerEvent) => {
      if (e.button !== 0 || isOverUI || paintMode || !pointerStartRef.current) return;
      
      const target = e.target as HTMLElement;
      if (
        target.closest('.world-editor-ui') || 
        target.closest('[data-leva]') || 
        target.closest('#leva__root') ||
        ['BUTTON', 'INPUT', 'SELECT', 'LABEL'].includes(target.tagName)
      ) {
        pointerStartRef.current = null;
        return;
      }

      const elapsed = Date.now() - pointerStartRef.current.time;
      const dist = Math.hypot(e.clientX - pointerStartRef.current.x, e.clientY - pointerStartRef.current.y);
      pointerStartRef.current = null;

      // Tap-to-drag validation threshold: 300 ms hold or 5px displacement separates camera pan/rotation from click selection
      if (elapsed > 300 || dist > 5) return;

      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const exactMouse = new THREE.Vector2(ndcX, ndcY);

      raycaster.setFromCamera(exactMouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length === 0) {
        setSelectedId(null);
        return;
      }

      // 1. Priority: Check if we hit the Gizmo or an Item
      const gizmoHit = intersects.find(i => {
        let cur: any = i.object;
        while(cur) {
          if (cur.type === 'TransformControlsPlane' || cur.name?.includes('gizmo')) return true;
          cur = cur.parent;
        }
        return false;
      });
      if (gizmoHit) return; // Ignore clicks on gizmo

      const itemHit = intersects.find(i => {
        let cur: any = i.object;
        while(cur) {
          if(cur.name?.startsWith('item_')) return true;
          cur = cur.parent;
        }
        return false;
      });

      if (itemHit) {
        let cur: any = itemHit.object;
        while(cur) {
          if(cur.name?.startsWith('item_')) {
            setSelectedId(cur.name);
            // If we hit an item, we should clear the active asset to enter "Edit Mode"
            if (activeAsset) setActiveAsset(null);
            return;
          }
          cur = cur.parent;
        }
      }

      // 2. Handle ground click
      const groundHit = intersects.find(i => 
        i.object.name && (
          i.object.name.toLowerCase().includes('terrain') || 
          i.object.name.toLowerCase().includes('ground')
        )
      );
      
      if (groundHit) {
        if (activeAsset) {
          // In "Placement Mode": Click ground = Spawn
          spawnAtPoint(groundHit.point);
        } else {
          // In "Selection Mode": Click ground = Deselect
          setSelectedId(null);
        }
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
    };
  }, [isEditorOpen, isOverUI, selectedId, activeAsset, paintMode, setActiveAsset, scene, camera, gl, raycaster, spawnAtPoint, setSelectedId]);

  useFrame(() => {
    if (!isEditorOpen || isOverUI) {
      if (hoverPos) setHoverPos(null);
      if (hoveredId) setHoveredId(null);
      if (brushHoverPos) setBrushHoverPos(null);
      document.body.style.cursor = 'auto';
      return;
    }

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // If paintMode is active, perform specialized high-frequency terrain hover tracking
    if (paintMode) {
      const terrainHit = intersects.find(i => i.object.name === 'terrain');
      if (terrainHit) {
        setBrushHoverPos([terrainHit.point.x, terrainHit.point.y, terrainHit.point.z]);
      } else {
        setBrushHoverPos(null);
      }
      
      // Clean up normal interaction states while in paint mode
      if (hoverPos) setHoverPos(null);
      if (hoveredId) setHoveredId(null);
      document.body.style.cursor = 'crosshair'; // Visual feedback for painting
      return;
    }

    // 1. Check for Items first (Interaction priority)
    const itemHit = intersects.find(i => {
      let cur: any = i.object;
      while(cur) {
        if(cur.name?.startsWith('item_')) return true;
        cur = cur.parent;
      }
      return false;
    });

    if (itemHit) {
      let cur: any = itemHit.object;
      while(cur) {
        if(cur.name?.startsWith('item_')) {
          if (hoveredId !== cur.name) setHoveredId(cur.name);
          setHoverPos(null); // Hide ground ring when hovering item
          document.body.style.cursor = 'pointer';
          return;
        }
        cur = cur.parent;
      }
    } else {
      if (hoveredId) {
        setHoveredId(null);
        document.body.style.cursor = 'auto';
      }

      // 2. Check for Ground (Placement)
      if (!selectedId) {
        const groundHit = intersects.find(i => i.object.name === 'terrain');
        if (groundHit) {
          setHoverPos(groundHit.point);
        } else {
          setHoverPos(null);
        }
      } else {
        setHoverPos(null);
      }
    }
  });

  const controls = useThree((state) => state.controls) as any;

  const normalItems = useMemo(() => items.filter(i => i.type !== 'procedural-vegetation'), [items]);
  const proceduralItems = useMemo(() => items.filter(i => i.type === 'procedural-vegetation'), [items]);

  return (
    <group>
      {/* Ground Placement Cursor / 3D Ghost Preview */}
      {hoverPos && (
        activeAsset ? (
          <Suspense fallback={
            <mesh position={[hoverPos.x, hoverPos.y + 0.15, hoverPos.z]} rotation-x={-Math.PI/2}>
              <ringGeometry args={[0.4, 0.5, 32]} />
              <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
            </mesh>
          }>
            <GhostPreview 
              path={activeAsset.path} 
              position={hoverPos} 
              scale={lastUsedScales[activeAsset.path] || [1, 1, 1]} 
              rotation={lastUsedRotations[activeAsset.path] || [0, 0, 0]}
            />
          </Suspense>
        ) : (
          <mesh position={[hoverPos.x, hoverPos.y + 0.1, hoverPos.z]} rotation-x={-Math.PI/2}>
            <ringGeometry args={[0.4, 0.5, 32]} />
            <meshBasicMaterial color="#4f46e5" transparent opacity={0.5} />
          </mesh>
        )
      )}
      
      {normalItems.map((item) => (
        <EditorItem 
          key={item.id} 
          item={item} 
          isSelected={selectedIds.includes(item.id)} 
          isHovered={hoveredId === item.id}
          onClick={(e) => {
            if (!isEditorOpen) return;
            const isShift = e.shiftKey || e.nativeEvent?.shiftKey;
            if (isShift) {
              toggleSelectedId(item.id);
            } else {
              setSelectedId(item.id);
            }
          }}
        />
      ))}
      <ProceduralVegetationLayer items={proceduralItems} />

      {isEditorOpen && selectedId && selectedId !== 'terrain' && scene.getObjectByName(selectedId) && (
        <SafeTransformControls 
          object={scene.getObjectByName(selectedId) as any} 
          mode={mode} 
          translationSnap={gridEnabled ? gridSize : null}
          onMouseDown={() => {
            if (controls) controls.enabled = false;

            // Capture drag start states for all selected items
            const startStates = new Map<string, { pos: [number, number, number], rot: [number, number, number], sca: [number, number, number] }>();
            selectedIds.forEach(id => {
              const item = items.find(i => i.id === id);
              if (item) {
                startStates.set(id, { pos: [...item.pos], rot: [...item.rot], sca: [...item.sca] });
              }
            });
            dragStartStatesRef.current = startStates;
          }}
          onMouseUp={() => {
            if (controls) controls.enabled = true;

            const obj = scene.getObjectByName(selectedId);
            const startState = dragStartStatesRef.current.get(selectedId);
            if (obj && startState) {
              const item = items.find(i => i.id === selectedId);
              if (item) {
                setLastUsedScale(item.path, [obj.scale.x, obj.scale.y, obj.scale.z]);
                setLastUsedRotation(item.path, [obj.rotation.x, obj.rotation.y, obj.rotation.z]);
              }
              const deltaPos = [
                obj.position.x - startState.pos[0],
                obj.position.y - startState.pos[1],
                obj.position.z - startState.pos[2]
              ];
              const deltaRot = [
                obj.rotation.x - startState.rot[0],
                obj.rotation.y - startState.rot[1],
                obj.rotation.z - startState.rot[2]
              ];
              const deltaSca = [
                obj.scale.x / startState.sca[0],
                obj.scale.y / startState.sca[1],
                obj.scale.z / startState.sca[2]
              ];

              updateItemsWithHistory(prev => prev.map(i => {
                if (selectedIds.includes(i.id)) {
                  if (i.id === selectedId) {
                    // Primary object: absolute snap
                    return {
                      ...i,
                      pos: [
                        snap(obj.position.x),
                        obj.position.y,
                        snap(obj.position.z)
                      ],
                      rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
                      sca: [obj.scale.x, obj.scale.y, obj.scale.z]
                    };
                  } else {
                    // Secondary objects: relative delta offset
                    const orig = dragStartStatesRef.current.get(i.id);
                    if (orig) {
                      return {
                        ...i,
                        pos: [
                          snap(orig.pos[0] + deltaPos[0]),
                          orig.pos[1] + deltaPos[1],
                          snap(orig.pos[2] + deltaPos[2])
                        ],
                        rot: [
                          orig.rot[0] + deltaRot[0],
                          orig.rot[1] + deltaRot[1],
                          orig.rot[2] + deltaRot[2]
                        ],
                        sca: [
                          orig.sca[0] * deltaSca[0],
                          orig.sca[1] * deltaSca[1],
                          orig.sca[2] * deltaSca[2]
                        ]
                      };
                    }
                  }
                }
                return i;
              }));
            }
          }}
        />
      )}
    </group>
  );
};

const EditorItem = memo(({ item, isSelected, isHovered, onClick }: { 
  item: MapItem; 
  isSelected: boolean; 
  isHovered: boolean;
  onClick: (e: any) => void;
}) => {
  const { scene: gltfScene } = useGLTF(item.path);
  const cloned = useMemo(() => {
    const c = gltfScene.clone();
    c.name = item.id;
    c.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.name = item.id;
        if (item.color) {
          child.material = child.material.clone();
          child.material.color.set(item.color);
        }
      }
    });
    return c;
  }, [gltfScene, item.id, item.color]);

  return (
    <primitive 
      object={cloned} 
      name={item.id}
      position={item.pos}
      rotation={item.rot}
      scale={item.sca}
      onClick={(e: any) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {isSelected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#6366f1" transparent opacity={0.8} depthTest={false} />
        </mesh>
      )}
      {isHovered && !isSelected && (
        <mesh rotation-x={-Math.PI / 2} position-y={0.05}>
          <ringGeometry args={[0.5, 0.55, 32]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} depthTest={false} />
        </mesh>
      )}
    </primitive>
  );
}, (prev, next) => {
  return prev.item.id === next.item.id &&
         prev.isSelected === next.isSelected &&
         prev.isHovered === next.isHovered &&
         prev.item.pos[0] === next.item.pos[0] &&
         prev.item.pos[1] === next.item.pos[1] &&
         prev.item.pos[2] === next.item.pos[2] &&
         prev.item.rot[0] === next.item.rot[0] &&
         prev.item.rot[1] === next.item.rot[1] &&
         prev.item.rot[2] === next.item.rot[2] &&
         prev.item.sca[0] === next.item.sca[0] &&
         prev.item.sca[1] === next.item.sca[1] &&
         prev.item.sca[2] === next.item.sca[2] &&
         prev.item.color === next.item.color;
});

const ProceduralVegetationLayer = memo(({ items }: { items: MapItem[] }) => {
  const groups = useMemo(() => {
    const map = new Map<string, MapItem[]>();
    items.forEach(item => {
      if (!map.has(item.path)) map.set(item.path, []);
      map.get(item.path)!.push(item);
    });
    return Array.from(map.entries());
  }, [items]);

  if (items.length === 0) return null;

  return (
    <group>
      {groups.map(([path, groupItems]) => (
        <InstancedVegetationModel key={path} path={path} instances={groupItems} />
      ))}
    </group>
  );
}, (prev, next) => prev.items === next.items);

const InstancedVegetationModel = memo(({ path, instances }: { path: string, instances: MapItem[] }) => {
  const { scene } = useGLTF(path) as any;

  // Extract all meshes from the GLB scene
  const meshes = useMemo(() => {
    const extracted: { geometry: THREE.BufferGeometry, material: THREE.Material, localMatrix: THREE.Matrix4 }[] = [];
    
    // Ensure world matrices are updated before extracting
    scene.updateMatrixWorld(true);

    scene.traverse((child: any) => {
      if (child.isMesh) {
        extracted.push({
          geometry: child.geometry,
          material: child.material.clone(),
          localMatrix: child.matrixWorld.clone() // Save its local offset inside the GLB
        });
      }
    });
    return extracted;
  }, [scene]);

  return (
    <group>
      {meshes.map((mesh, index) => (
        <InstancedMeshPart 
          key={index} 
          meshData={mesh} 
          instances={instances} 
        />
      ))}
    </group>
  );
});

const InstancedMeshPart = ({ meshData, instances }: { meshData: any, instances: MapItem[] }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useEffect(() => {
    if (!meshRef.current) return;

    const tempObj = new THREE.Object3D();
    const tempMatrix = new THREE.Matrix4();
    const color = new THREE.Color();

    instances.forEach((item, i) => {
      // 1. Set the world position from the editor
      tempObj.position.set(item.pos[0], item.pos[1], item.pos[2]);
      tempObj.rotation.set(item.rot[0], item.rot[1], item.rot[2]);
      tempObj.scale.set(item.sca[0], item.sca[1], item.sca[2]);
      tempObj.updateMatrix();

      // 2. Combine world transform with the mesh's local offset
      tempMatrix.multiplyMatrices(tempObj.matrix, meshData.localMatrix);
      meshRef.current.setMatrixAt(i, tempMatrix);

      // 3. Apply custom color if requested
      if (item.color) {
        color.set(item.color);
        meshRef.current.setColorAt(i, color);
      } else {
        color.set(0xffffff); // Default
        meshRef.current.setColorAt(i, color);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [instances, meshData]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[meshData.geometry, meshData.material, instances.length]}
      castShadow
      receiveShadow
      frustumCulled={false}
    />
  );
};
