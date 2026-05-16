'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { TransformControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { useEditorStore, MapItem } from '@/src/state/useEditorStore';

// --- EDITOR COMPONENT (3D Scene Only) ---
export const WorldEditor = () => {
  const { scene, raycaster, mouse, camera } = useThree();
  const {
    items,
    selectedId,
    setSelectedId,
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
  } = useEditorStore();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<THREE.Vector3 | null>(null);
  const [isOverUI, setIsOverUI] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

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

    const newItem: MapItem = {
      id: "item_" + Math.random().toString(36).substr(2, 9),
      type: activeAsset.name,
      path: activeAsset.path,
      pos: snappedPos,
      rot: [0, 0, 0],
      sca: [1, 1, 1],
    };
    updateItemsWithHistory(prev => [...prev, newItem]);
    setSelectedId(newItem.id);
  }, [activeAsset, updateItemsWithHistory, setSelectedId, snap]);

  const deleteSelected = useCallback(() => {
    if (selectedId) {
      updateItemsWithHistory(prev => prev.filter(i => i.id !== selectedId));
      setSelectedId(null);
    }
  }, [selectedId, updateItemsWithHistory, setSelectedId]);

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
        if (selectedId && !document.activeElement?.matches('input, textarea')) {
          deleteSelected();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isEditorOpen, undo, redo, selectedId, deleteSelected]);

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
      // Skip if clicking any UI (custom UI or Leva)
      if (
        target.closest('.world-editor-ui') || 
        target.closest('[data-leva]') || 
        target.closest('#leva__root') ||
        ['BUTTON', 'INPUT', 'SELECT', 'LABEL'].includes(target.tagName)
      ) return;

      raycaster.setFromCamera(mouse, camera);
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
        i.object.name.toLowerCase().includes('terrain') || 
        i.object.name.toLowerCase().includes('ground')
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
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [isEditorOpen, isOverUI, selectedId, activeAsset, scene, camera, mouse, raycaster, spawnAtPoint, setSelectedId]);

  useFrame(() => {
    if (!isEditorOpen || isOverUI) {
      if (hoverPos) setHoverPos(null);
      if (hoveredId) setHoveredId(null);
      document.body.style.cursor = 'auto';
      return;
    }

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);
    
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

  return (
    <group>
      {/* Ground Placement Cursor */}
      {hoverPos && (
        <mesh position={[hoverPos.x, hoverPos.y + 0.1, hoverPos.z]} rotation-x={-Math.PI/2}>
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial color="#4f46e5" transparent opacity={0.5} />
        </mesh>
      )}
      
      {items.map((item) => (
        <EditorItem 
          key={item.id} 
          item={item} 
          isSelected={selectedId === item.id} 
          isHovered={hoveredId === item.id}
          onClick={() => {
            if (isEditorOpen) setSelectedId(item.id);
          }}
        />
      ))}

      {isEditorOpen && selectedId && (
        <TransformControls 
          object={scene.getObjectByName(selectedId)} 
          mode={mode} 
          translationSnap={gridEnabled ? gridSize : null}
          onMouseDown={() => {
            if (controls) controls.enabled = false;
          }}
          onMouseUp={() => {
            if (controls) controls.enabled = true;

            const obj = scene.getObjectByName(selectedId);
            if (obj) {
              updateItemsWithHistory(prev => prev.map(i => i.id === selectedId ? {
                ...i,
                pos: [
                  snap(obj.position.x),
                  obj.position.y,
                  snap(obj.position.z)
                ],
                rot: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
                sca: [obj.scale.x, obj.scale.y, obj.scale.z],
              } : i));
            }
          }}
        />
      )}
    </group>
  );
};

const EditorItem = ({ item, isSelected, isHovered, onClick }: { 
  item: MapItem; 
  isSelected: boolean; 
  isHovered: boolean;
  onClick: () => void;
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
        onClick();
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
};
