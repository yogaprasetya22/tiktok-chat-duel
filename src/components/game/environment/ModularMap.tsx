'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { STATIC_WORLD_MAP } from '@/src/core/logic/environment/mapConfig';
import { InstancedStaticCollider } from 'bvhecctrl';
import { useEditorStore } from '@/src/state/useEditorStore';
import * as THREE from 'three';

import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Add BVH support to THREE with type safety bypass for prototype augmentation
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

export const ModularMap = ({ debug }: { debug?: boolean }) => {
  const { items, loadFromStorage } = useEditorStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  const allItems = useMemo(() => {
    return items.length > 0 ? items : STATIC_WORLD_MAP;
  }, [items]);

  // Group items by their 3D model path
  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    allItems.forEach((item) => {
      if (!groups[item.path]) groups[item.path] = [];
      groups[item.path].push(item);
    });
    return groups;
  }, [allItems]);

  if (allItems.length === 0) return null;

  return (
    <>
      {Object.entries(groupedItems).map(([path, instances]) => (
        <InstancedModelGroup 
          key={`group-${path}-${instances.length}`} 
          path={path} 
          instances={instances} 
          debug={debug} 
        />
      ))}
    </>
  );
};

const InstancedModelGroup = ({ path, instances, debug }: { path: string, instances: any[], debug?: boolean }) => {
  const { scene } = useGLTF(path) as any;

  // Extract all meshes from the GLB scene
  const meshes = useMemo(() => {
    const extracted: { geometry: THREE.BufferGeometry, material: THREE.Material, localMatrix: THREE.Matrix4 }[] = [];
    
    // Ensure world matrices are updated before extracting
    scene.updateMatrixWorld(true);

    scene.traverse((child: any) => {
      if (child.isMesh) {
        // Optimize BVH generation for instanced physics
        if (child.geometry && !child.geometry.boundsTree) {
          child.geometry.computeBoundsTree({ maxDepth: 64, maxLeafSize: 10 });
        }
        
        extracted.push({
          geometry: child.geometry,
          material: child.material.clone(), // Clone to allow individual coloring
          localMatrix: child.matrixWorld.clone() // Save its local offset inside the GLB
        });
      }
    });
    return extracted;
  }, [scene]);

  return (
    <InstancedStaticCollider 
      debug={debug}
      restitution={0}
      friction={1}
    >
      {meshes.map((mesh, index) => (
        <InstancedMeshPart 
          key={index} 
          meshData={mesh} 
          instances={instances} 
        />
      ))}
    </InstancedStaticCollider>
  );
};

const InstancedMeshPart = ({ meshData, instances }: { meshData: any, instances: any[] }) => {
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
      frustumCulled={false} // Prevent objects from disappearing at certain camera angles
    />
  );
};
