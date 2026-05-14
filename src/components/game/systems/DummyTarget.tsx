'use client';

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DummyTargetProps {
  position: [number, number, number];
  name?: string;
}

/**
 * DummyTarget - A simple enemy/target placeholder for testing hit detection.
 * It changes color when hit and has a simple bobbing animation.
 */
export const DummyTarget = ({ position, name = "Dummy Target" }: DummyTargetProps) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hitEffect, setHitEffect] = useState(0);
  
  // Custom property to identify as target in raycast
  // In a real game, you might use userData or a specific layer
  const onHit = () => {
    setHitEffect(1.0);
    console.log(`Target ${name} was HIT!`);
  };

  useFrame((_, delta) => {
    if (hitEffect > 0) {
      setHitEffect(prev => Math.max(0, prev - delta * 5));
    }
    
    // Simple bobbing animation
    meshRef.current.position.y = position[1] + Math.sin(Date.now() * 0.005) * 0.2;
    meshRef.current.rotation.y += delta * 0.5;
  });

  return (
    <group position={position}>
      <mesh 
        ref={meshRef} 
        onClick={onHit} // For manual mouse testing
        name={name}
        userData={{ type: 'enemy', onHit }} // Used by ProjectilePool raycast
        castShadow
      >
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial 
          color={hitEffect > 0 ? "#ff0000" : "#555"} 
          emissive="#ff0000"
          emissiveIntensity={hitEffect * 2}
        />
      </mesh>
      
      {/* Label/Indicator */}
      <mesh position={[0, 1.5, 0]}>
        <sphereGeometry args={[0.2]} />
        <meshStandardMaterial color="#ff0000" />
      </mesh>
    </group>
  );
};
