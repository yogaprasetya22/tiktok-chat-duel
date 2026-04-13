'use client';

import { useGLTF } from '@react-three/drei';
import { MeshoptDecoder } from 'meshoptimizer';
import { useMemo } from 'react';
import * as THREE from 'three';

export function Environment() {
  const { scene } = useGLTF('/low_poly_forest_4_optimized.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
  
  // Advanced Optimization: Automatically instance repeated meshes in the forest
  const instancedForest = useMemo(() => {
    const instances: Map<string, { geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[] }> = new Map();
    const result: React.ReactNode[] = [];
    
    scene.traverse((child: any) => {
      if (child.isMesh) {
        // Create a unique key for geometry + material combination
        const key = `${child.geometry.uuid}_${child.material.uuid}`;
        if (!instances.has(key)) {
          instances.set(key, { geometry: child.geometry, material: child.material, matrices: [] });
        }
        instances.get(key)!.matrices.push(child.matrixWorld);
      }
    });

    // Create InstancedMesh for each unique geometry+material found more than once
    instances.forEach((data, key) => {
      if (data.matrices.length > 2) {
        const iMesh = new THREE.InstancedMesh(data.geometry, data.material, data.matrices.length);
        data.matrices.forEach((matrix, i) => iMesh.setMatrixAt(i, matrix));
        iMesh.instanceMatrix.needsUpdate = true;
        result.push(<primitive key={key} object={iMesh} />);
      } else {
        // For unique items, just keep them as they are
        data.matrices.forEach((matrix, i) => {
          const mesh = new THREE.Mesh(data.geometry, data.material);
          mesh.applyMatrix4(matrix);
          result.push(<primitive key={`${key}-${i}`} object={mesh} />);
        });
      }
    });
    
    return result;
  }, [scene]);

  return (
    <group position={[0, -0.5, 0]} scale={0.8} rotation={[0, Math.PI / 4, 0]}>
      {instancedForest}
      
      {/* Additional ground for better blending */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#2d5a27" />
      </mesh>
    </group>
  );
}

useGLTF.preload('/low_poly_forest_4_optimized.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
