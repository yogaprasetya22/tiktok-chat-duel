'use client';

import * as THREE from 'three';
import React, { createContext, useContext, useRef, useMemo, useCallback, useEffect } from 'react';
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

const MAX_PARTICLES = 2500;

export const VFXProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // PERFORMANCE: Use TypedArrays instead of thousands of small objects to eliminate GC pressure
  const data = useMemo(() => ({
    positions: new Float32Array(MAX_PARTICLES * 3),
    velocities: new Float32Array(MAX_PARTICLES * 3),
    colors: new Float32Array(MAX_PARTICLES * 3),
    lifetimes: new Float32Array(MAX_PARTICLES),    // life
    maxLifetimes: new Float32Array(MAX_PARTICLES), // maxLife
    sizes: new Float32Array(MAX_PARTICLES),
    types: new Int8Array(MAX_PARTICLES), // 0: hit, 1: death, 2: blood, 3: boss, 4: explosion, 5: spark, 6: shockwave, 7: fire, 8: slash, 9: muzzle
  }), []);

  const typeToId = (type: VFXType): number => {
    switch(type) {
      case 'hit': return 0; case 'death': return 1; case 'blood': return 2;
      case 'boss-spawn': return 3; case 'mega_explosion': return 4;
      case 'spark': return 5; case 'shockwave': return 6;
      case 'fireball_hit': return 7; case 'slash': return 8; case 'muzzle': return 9;
      default: return 0;
    }
  };

  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const poolIndex = useRef(0);
  const activeIndices = useRef<Set<number>>(new Set());
  const lastSpawnAt = useRef<{ [key: string]: number }>({});

  useEffect(() => {
    return () => {
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        if (Array.isArray(meshRef.current.material)) {
           meshRef.current.material.forEach(m => m.dispose());
        } else {
           meshRef.current.material.dispose();
        }
      }
    };
  }, []);

  const spawnVFX = useCallback((position: [number, number, number], type: VFXType, colorStr: string = '#ffffff') => {
    const key = `${type}-${Math.round(position[0])}-${Math.round(position[2])}`;
    const now = performance.now();
    if (lastSpawnAt.current[key] && now - lastSpawnAt.current[key] < 20) return;
    lastSpawnAt.current[key] = now;

    const count = type === 'mega_explosion' ? 60 :
      type === 'fireball_hit' ? 20 : 
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
      type === 'fireball_hit' ? 0.45 : 
      type === 'blood' ? 0.35 : 
      type === 'mega_explosion' ? 0.4 :
        type === 'spark' ? 0.12 : 
        type === 'muzzle' ? 0.6 :
          type === 'slash' ? 0.8 : 0.25;

    const baseLife = type === 'shockwave' ? 0.3 :
      type === 'fireball_hit' ? 0.65 : 
      type === 'blood' ? 0.8 : 
      type === 'mega_explosion' ? 2.5 :
        type === 'spark' ? 0.3 : 
        type === 'muzzle' ? 0.15 :
          type === 'slash' ? 0.25 : 0.6;

    const typeId = typeToId(type);
    _tempColor.set(colorStr).convertLinearToSRGB();

    for (let i = 0; i < count; i++) {
      const idx = poolIndex.current;
      poolIndex.current = (poolIndex.current + 1) % MAX_PARTICLES;
      activeIndices.current.add(idx);

      data.types[idx] = typeId;
      data.positions[idx * 3] = position[0];
      data.positions[idx * 3 + 1] = position[1];
      data.positions[idx * 3 + 2] = position[2];

      if (type === 'shockwave') {
        data.velocities[idx * 3] = 0;
        data.velocities[idx * 3 + 1] = 0;
        data.velocities[idx * 3 + 2] = 0;
      } else if (type === 'slash') {
        const angle = Math.random() * Math.PI * 2;
        data.velocities[idx * 3] = Math.cos(angle) * speed;
        data.velocities[idx * 3 + 1] = (Math.random() - 0.5) * 2;
        data.velocities[idx * 3 + 2] = Math.sin(angle) * speed;
      } else {
        const spread = type === 'fireball_hit' ? 1.2 : 1.0;
        data.velocities[idx * 3] = (Math.random() - 0.5) * speed * spread;
        data.velocities[idx * 3 + 1] = (type === 'mega_explosion' || type === 'spark' || type === 'fireball_hit' ? Math.random() * speed + 2 : Math.random() * speed);
        data.velocities[idx * 3 + 2] = (Math.random() - 0.5) * speed * spread;
      }

      const life = baseLife * (0.8 + Math.random() * 0.4);
      data.lifetimes[idx] = life;
      data.maxLifetimes[idx] = life;
      
      if (type === 'fireball_hit' && Math.random() > 0.3) {
        data.colors[idx * 3] = 0.1; // Dark smoke
        data.colors[idx * 3 + 1] = 0.1;
        data.colors[idx * 3 + 2] = 0.1;
      } else {
        data.colors[idx * 3] = _tempColor.r;
        data.colors[idx * 3 + 1] = _tempColor.g;
        data.colors[idx * 3 + 2] = _tempColor.b;
      }
      
      data.sizes[idx] = baseSize * (0.8 + Math.random() * 0.4);
    }
  }, [data]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    activeIndices.current.forEach((idx) => {
      let life = data.lifetimes[idx] - delta;
      data.lifetimes[idx] = life;

      if (life <= 0) {
        dummy.position.set(0, -100, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(idx, dummy.matrix);
        activeIndices.current.delete(idx);
        return;
      }

      const typeId = data.types[idx];
      // 6: shockwave
      if (typeId !== 6) {
        if (typeId === 7) { // fireball_hit
           data.velocities[idx * 3 + 1] += delta * 3.5;
           data.positions[idx * 3] += data.velocities[idx * 3] * delta * 0.7;
           data.positions[idx * 3 + 1] += data.velocities[idx * 3 + 1] * delta * 0.7;
           data.positions[idx * 3 + 2] += data.velocities[idx * 3 + 2] * delta * 0.7;
           data.velocities[idx * 3] *= 0.97;
           data.velocities[idx * 3 + 1] *= 0.97;
           data.velocities[idx * 3 + 2] *= 0.97;
        } else if (typeId === 2) { // blood
           data.velocities[idx * 3 + 1] -= delta * 15;
           data.positions[idx * 3] += data.velocities[idx * 3] * delta;
           data.positions[idx * 3 + 1] += data.velocities[idx * 3 + 1] * delta;
           data.positions[idx * 3 + 2] += data.velocities[idx * 3 + 2] * delta;
           data.velocities[idx * 3] *= 0.96;
           data.velocities[idx * 3 + 1] *= 0.96;
           data.velocities[idx * 3 + 2] *= 0.96;
        } else {
           data.velocities[idx * 3 + 1] -= delta * 10;
           data.positions[idx * 3] += data.velocities[idx * 3] * delta;
           data.positions[idx * 3 + 1] += data.velocities[idx * 3 + 1] * delta;
           data.positions[idx * 3 + 2] += data.velocities[idx * 3 + 2] * delta;
        }
      }

      const progress = life / data.maxLifetimes[idx];
      const pSize = data.sizes[idx];
      let scale = typeId === 6 ? pSize * (1 - progress) : progress * pSize;

      if (typeId === 7) { // smoke expansion (Subtle)
          const expansion = 1.0 + (1.0 - progress) * 0.8;
          scale = pSize * Math.sin(progress * Math.PI) * expansion;
      }

      dummy.position.set(data.positions[idx * 3], data.positions[idx * 3 + 1], data.positions[idx * 3 + 2]);
      if (typeId === 6) {
        dummy.scale.set(scale, 0.05, scale);
      } else {
        dummy.scale.set(scale, scale, scale);
      }
      dummy.updateMatrix();

      meshRef.current.setMatrixAt(idx, dummy.matrix);
      
      // Flicker logic
      if (typeId === 7 && data.colors[idx * 3] > 0.4) {
          const flicker = 0.8 + Math.sin(life * 20) * 0.2;
          _tempColor.setRGB(data.colors[idx * 3] * flicker, data.colors[idx * 3 + 1] * flicker, data.colors[idx * 3 + 2] * flicker);
          meshRef.current.setColorAt(idx, _tempColor);
      } else {
          _tempColor.setRGB(data.colors[idx * 3], data.colors[idx * 3 + 1], data.colors[idx * 3 + 2]);
          meshRef.current.setColorAt(idx, _tempColor);
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
