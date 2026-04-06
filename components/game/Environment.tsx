'use client';

import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';

export function Environment() {
  const { scene } = useGLTF('/low_poly_forest_4_optimized.glb');
  
  // Clone to avoid side effects if reused
  const forestScene = useMemo(() => scene.clone(), [scene]);

  return (
    <group position={[0, -0.5, 0]} scale={0.8} rotation={[0, Math.PI / 4, 0]}>
      <primitive object={forestScene} />
      
      {/* Additional ground for better blending */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#2d5a27" />
      </mesh>
    </group>
  );
}

useGLTF.preload('/low_poly_forest_4_optimized.glb');
