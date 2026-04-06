'use client';

import * as THREE from 'three';
import React, { createContext, useContext, useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';

export type VFXType = 'hit' | 'death' | 'boss-spawn' | 'mega_explosion' | 'spark' | 'shockwave';

interface Particle {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
  type: VFXType;
}

interface VFXContextType {
  spawnVFX: (position: [number, number, number], type: VFXType, color?: string) => void;
}

const VFXContext = createContext<VFXContextType | null>(null);

export const useVFX = () => {
  const context = useContext(VFXContext);
  if (!context) throw new Error('useVFX must be used within VFXProvider');
  return context;
};

const MAX_PARTICLES = 2000;

export const VFXProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const particles = useMemo(() => {
    const p: Particle[] = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      p.push({
        position: new THREE.Vector3(0, -100, 0),
        velocity: new THREE.Vector3(),
        color: new THREE.Color(),
        size: 0,
        life: 0,
        maxLife: 0,
        type: 'hit'
      });
    }
    return p;
  }, []);

  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const poolIndex = useRef(0);
  const activeIndices = useRef<Set<number>>(new Set());
  const lastSpawnAt = useRef<{ [key: string]: number }>({});

  const spawnVFX = useCallback((position: [number, number, number], type: VFXType, color: string = '#ffffff') => {
    // PERFORMANCE: Spatial & Temporal Culling
    // If the same effect is requested at the same spot within 50ms, skip it.
    const key = `${type}-${Math.round(position[0])}-${Math.round(position[2])}`;
    const now = performance.now();
    if (lastSpawnAt.current[key] && now - lastSpawnAt.current[key] < 50) return;
    lastSpawnAt.current[key] = now;

    const count = type === 'mega_explosion' ? 60 :
      type === 'boss-spawn' ? 40 :
        type === 'death' ? 15 :
          type === 'shockwave' ? 1 : 8;

    const speed = type === 'mega_explosion' ? 10 :
      type === 'spark' ? 12 :
        type === 'death' ? 4 : 3;

    const baseSize = type === 'shockwave' ? 3.5 :
      type === 'mega_explosion' ? 0.4 :
        type === 'spark' ? 0.12 : 0.25;

    const baseLife = type === 'shockwave' ? 0.3 :
      type === 'mega_explosion' ? 2.5 :
        type === 'spark' ? 0.3 : 0.6;

    for (let i = 0; i < count; i++) {
      const idx = poolIndex.current;
      poolIndex.current = (poolIndex.current + 1) % MAX_PARTICLES;
      
      const p = particles[idx];
      activeIndices.current.add(idx);

      p.type = type;
      p.position.set(...position);

      if (type === 'shockwave') {
        p.velocity.set(0, 0, 0);
      } else {
        p.velocity.set(
          (Math.random() - 0.5) * speed,
          (type === 'mega_explosion' || type === 'spark' ? Math.random() * speed + 2 : Math.random() * speed),
          (Math.random() - 0.5) * speed
        );
      }

      p.life = baseLife * (0.8 + Math.random() * 0.4);
      p.maxLife = p.life;
      p.color.set(color).convertLinearToSRGB();
      p.size = baseSize * (0.8 + Math.random() * 0.4);
    }
  }, [particles]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    // PERFORMANCE: Only update ACTIVE indices
    activeIndices.current.forEach((idx) => {
      const p = particles[idx];
      p.life -= delta;

      if (p.life <= 0) {
        dummy.position.set(0, -100, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx, dummy.matrix);
        activeIndices.current.delete(idx);
        return;
      }

      if (p.type !== 'shockwave') {
        p.velocity.y -= delta * 10; // Gravity
        p.position.addScaledVector(p.velocity, delta);
      }

      const progress = p.life / p.maxLife;
      const scale = p.type === 'shockwave' ? p.size * (1 - progress) : progress * p.size;

      dummy.position.copy(p.position);
      if (p.type === 'shockwave') {
        dummy.scale.set(scale, 0.05, scale);
      } else {
        dummy.scale.set(scale, scale, scale);
      }
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(idx, dummy.matrix);
      meshRef.current.setColorAt(idx, p.color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <VFXContext.Provider value={{ spawnVFX }}>
      {children}
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]}>
        <sphereGeometry args={[1, 3, 3]} />
        <meshStandardMaterial 
          transparent 
          opacity={0.8} 
          emissiveIntensity={1.5}
          toneMapped={false}
        />
      </instancedMesh>
    </VFXContext.Provider>
  );
};
