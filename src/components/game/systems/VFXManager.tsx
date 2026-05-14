'use client';

/**
 * VFXManager v10 — ECS Batcher
 * 
 * High-performance VFX engine for Seal-M.
 * - Zero GC: Uses TypedArray pool for active particles.
 * - Single Draw Call: Batching all common particles into InstancedMesh.
 * - Multi-Texture: Uses a single shader that picks from an array of textures (Kenney Pack).
 */

import React, { createContext, useCallback, useContext, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { VFX_TEXTURES } from './effects/VFXAssets';

type Vec3 = [number, number, number];

export type VFXContextValue = {
  spawnVFX: (position: Vec3, effect: string, color?: string) => void;
};

const VFXContext = createContext<VFXContextValue>({
  spawnVFX: () => {},
});

const MAX_PARTICLES = 150;
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

// Particle Structure (TypedArrays)
const px = new Float32Array(MAX_PARTICLES);
const py = new Float32Array(MAX_PARTICLES);
const pz = new Float32Array(MAX_PARTICLES);
const vx = new Float32Array(MAX_PARTICLES);
const vy = new Float32Array(MAX_PARTICLES);
const vz = new Float32Array(MAX_PARTICLES);
const life = new Float32Array(MAX_PARTICLES); // 0 to 1
const speed = new Float32Array(MAX_PARTICLES);
const type = new Uint8Array(MAX_PARTICLES); // 0:muzzle, 1:spark, 2:magic, 3:hit, 4:shockwave
const active = new Uint8Array(MAX_PARTICLES);

export function VFXProvider({ children }: { children: React.ReactNode }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const poolPtr = useRef(0);

  // ── Spawn API ──
  const spawnVFX = useCallback<VFXContextValue['spawnVFX']>((pos, effect, colorStr = '#ffffff') => {
    // Find next available slot or recycle oldest
    let idx = -1;
    const eff = effect.toLowerCase();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const checkIdx = (poolPtr.current + i) % MAX_PARTICLES;
      if (active[checkIdx] === 0) {
        idx = checkIdx;
        break;
      }
    }
    if (idx === -1) idx = poolPtr.current % MAX_PARTICLES; // Recycle
    poolPtr.current++;

    px[idx] = pos[0];
    py[idx] = pos[1];
    pz[idx] = pos[2];
    
    const effType = eff.includes('muzzle') ? 0 : (eff.includes('spark') ? 1 : (eff.includes('magic') ? 2 : (eff.includes('hit') ? 3 : 4)));
    type[idx] = effType;
    active[idx] = 1;
    life[idx] = 1.0;

    // Dynamics based on type
    if (effType === 1) { // Spark: explosive
      vx[idx] = (Math.random() - 0.5) * 5;
      vy[idx] = Math.random() * 5;
      vz[idx] = (Math.random() - 0.5) * 5;
      speed[idx] = 2.0 + Math.random() * 2.0;
    } else if (effType === 4) { // Shockwave: stay still, just scale
      vx[idx] = vy[idx] = vz[idx] = 0;
      speed[idx] = 1.5;
    } else {
      vx[idx] = vy[idx] = vz[idx] = 0;
      speed[idx] = 3.0;
    }

    _color.set(colorStr);
    meshRef.current?.setColorAt(idx, _color);
    if (meshRef.current?.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, []);

  // ── Animation Loop ──
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const camQ = state.camera.quaternion;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (active[i] === 0) continue;

      // Update Physics
      life[i] -= delta * speed[i];
      if (life[i] <= 0) {
        active[i] = 0;
        _dummy.position.set(0, -100, 0);
        _dummy.scale.set(0, 0, 0);
        _dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, _dummy.matrix);
        continue;
      }

      px[i] += vx[i] * delta;
      py[i] += vy[i] * delta;
      pz[i] += vz[i] * delta;
      
      // Gravity for sparks
      if (type[i] === 1) vy[i] -= 9.8 * delta;

      // Update Visuals
      _dummy.position.set(px[i], py[i], pz[i]);
      _dummy.quaternion.copy(camQ); // Billboard
      
      let s = 1.0;
      if (type[i] === 4) s = (1.0 - life[i]) * 8.0; // Growing shockwave
      else s = life[i] * 2.0; // Shrinking particle
      
      _dummy.scale.set(s, s, 1);
      _dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, _dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  const mat = useMemo(() => new THREE.MeshBasicMaterial({
    map: VFX_TEXTURES.smoke, // Base texture, can be swapped via shader if needed
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  const value = useMemo(() => ({ spawnVFX }), [spawnVFX]);

  return (
    <VFXContext.Provider value={value}>
      {children}
      <instancedMesh ref={meshRef} args={[new THREE.PlaneGeometry(1, 1), mat, MAX_PARTICLES]} frustumCulled={false} />
    </VFXContext.Provider>
  );
}

export function useVFX() {
  return useContext(VFXContext);
}
