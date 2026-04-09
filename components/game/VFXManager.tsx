'use client';

import * as THREE from 'three';
import React, { createContext, useContext, useRef, useMemo, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';

export type VFXType = 'hit' | 'death' | 'blood' | 'boss-spawn' | 'mega_explosion' | 'spark' | 'shockwave' | 'fireball_hit' | 'slash' | 'muzzle';


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
    if (lastSpawnAt.current[key] && now - lastSpawnAt.current[key] < 20) return;
    lastSpawnAt.current[key] = now;

      const count = type === 'mega_explosion' ? 60 :
      type === 'fireball_hit' ? 50 : 
      type === 'blood' ? 12 : 
      type === 'boss-spawn' ? 40 :
        type === 'death' ? 15 :
        type === 'slash' ? 12 :
          type === 'muzzle' ? 6 :
            type === 'shockwave' ? 1 : 8;


    const speed = type === 'mega_explosion' ? 10 :
      type === 'fireball_hit' ? 7 : 
      type === 'blood' ? 6 : 
      type === 'spark' ? 12 :
      type === 'slash' ? 15 :
        type === 'muzzle' ? 20 :
          type === 'death' ? 4 : 3;


    const baseSize = type === 'shockwave' ? 3.5 :
      type === 'fireball_hit' ? 1.5 : 
      type === 'blood' ? 0.35 : 
      type === 'mega_explosion' ? 0.4 :
        type === 'spark' ? 0.12 : 
        type === 'muzzle' ? 0.6 :
          type === 'slash' ? 0.8 : 0.25;


    const baseLife = type === 'shockwave' ? 0.3 :
      type === 'fireball_hit' ? 2.0 : 
      type === 'blood' ? 0.8 : 
      type === 'mega_explosion' ? 2.5 :
        type === 'spark' ? 0.3 : 
        type === 'muzzle' ? 0.15 :
          type === 'slash' ? 0.25 : 0.6;


    for (let i = 0; i < count; i++) {
      const idx = poolIndex.current;
      poolIndex.current = (poolIndex.current + 1) % MAX_PARTICLES;
      
      const p = particles[idx];
      activeIndices.current.add(idx);

      p.type = type;
      p.position.set(...position);

      if (type === 'shockwave') {
        p.velocity.set(0, 0, 0);
      } else if (type === 'slash') {
        // Flat, wide spread for slash
        const angle = Math.random() * Math.PI * 2;
        p.velocity.set(
          Math.cos(angle) * speed,
          (Math.random() - 0.5) * 2,
          Math.sin(angle) * speed
        );
      } else {

        const spread = type === 'fireball_hit' ? 1.2 : 1.0;
        p.velocity.set(
          (Math.random() - 0.5) * speed * spread,
          (type === 'mega_explosion' || type === 'spark' || type === 'fireball_hit' ? Math.random() * speed + 2 : Math.random() * speed),
          (Math.random() - 0.5) * speed * spread
        );
      }

      p.life = baseLife * (0.8 + Math.random() * 0.4);
      p.maxLife = p.life;
      
      // Fireball hit: 70% smoke, 30% fire
      if (type === 'fireball_hit') {
        if (Math.random() > 0.3) {
            p.color.set('#333333').convertLinearToSRGB(); // Darker smoke
        } else {
            p.color.set(color).convertLinearToSRGB(); // Fire color
        }
      } else {
        p.color.set(color).convertLinearToSRGB();
      }
      
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
        if (p.type === 'fireball_hit') {
           p.velocity.y += delta * 3.5; // Smoke rises faster
           p.position.addScaledVector(p.velocity, delta * 0.7); // Better air resistance feel
           p.velocity.multiplyScalar(0.97); // Drag
        } else if (p.type === 'blood') {
           p.velocity.y -= delta * 15; // Heavier gravity for blood
           p.position.addScaledVector(p.velocity, delta);
           p.velocity.multiplyScalar(0.96); // Air resistance
        } else {
           p.velocity.y -= delta * 10; // Standard gravity
           p.position.addScaledVector(p.velocity, delta);
        }
      }

      const progress = p.life / p.maxLife;
      let scale = p.type === 'shockwave' ? p.size * (1 - progress) : progress * p.size;

      // Special smoke scaling: expands as it ages then fades
      if (p.type === 'fireball_hit') {
          const expansion = 1.0 + (1.0 - progress) * 2.0; // Grows 3x
          scale = p.size * Math.sin(progress * Math.PI) * expansion;
      }

      dummy.position.copy(p.position);
      if (p.type === 'shockwave') {
        dummy.scale.set(scale, 0.05, scale);
      } else {
        dummy.scale.set(scale, scale, scale);
      }
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(idx, dummy.matrix);
      
      // Flicker fire particles
      if (p.type === 'fireball_hit' && p.color.r > 0.4) {
          const flicker = 0.8 + Math.sin(p.life * 20) * 0.2;
          meshRef.current.setColorAt(idx, _tempColor.copy(p.color).multiplyScalar(flicker));
      } else {
          meshRef.current.setColorAt(idx, p.color);
      }
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <VFXContext.Provider value={{ spawnVFX }}>
      {children}
      <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_PARTICLES]} frustumCulled={false}>
        <sphereGeometry args={[1, 4, 4]} />
        <meshStandardMaterial 
          transparent 
          opacity={0.7} 
          emissiveIntensity={2.0}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </instancedMesh>
    </VFXContext.Provider>
  );
};

const _tempColor = new THREE.Color();
