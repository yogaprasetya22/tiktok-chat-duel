'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame, useGraph } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';

const _v1 = new THREE.Vector3();

export type AnimationName = 'Idle' | 'Run' | 'Attack(1h)' | 'Defeat';

interface CharacterProps {
  animation: string;
  color?: string;
  characterScale?: number;
  isBoss?: boolean;
}

// Global Material Cache to avoid draw call overhead
const materialCache = new Map<string, THREE.MeshStandardMaterial>();

export const Character = React.memo(({ animation, color = 'blue', characterScale = 1, isBoss = false, ...props }: CharacterProps & any) => {
  const group = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.SkinnedMesh>(null);
  const { scene, animations } = useGLTF('/Floating Character.glb');
  
  // 1. CLONE SCENE (Optimized via SkeletonUtils)
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const { nodes } = useGraph(clone);

  // 2. MIXER SETUP
  const [mixer] = useState(() => new THREE.AnimationMixer(clone));
  const actions = useRef<Record<string, THREE.AnimationAction>>({});

  useEffect(() => {
    // Initial action setup
    animations.forEach((clip) => {
      actions.current[clip.name] = mixer.clipAction(clip);
    });

    const currentAction = actions.current[animation];
    if (currentAction) {
      currentAction.reset().fadeIn(0.2).play();
    }

    return () => {
      mixer.stopAllAction();
    };
  }, [mixer, animations, animation]);

  const currentAnim = useRef<string>('');

  // Handle animation changes with crossfade
  useEffect(() => {
    if (animation === currentAnim.current) return;
    
    const nextAction = actions.current[animation];
    if (nextAction) {
      // 1. One-Shot Logic for Death
      if (animation === 'Defeat') {
        nextAction.setLoop(THREE.LoopOnce, 1);
        nextAction.clampWhenFinished = true;
      } else {
        nextAction.setLoop(THREE.LoopRepeat, Infinity);
        nextAction.clampWhenFinished = false;
      }

      // 2. Crossfade Logic
      const prevAction = actions.current[currentAnim.current];
      if (prevAction && prevAction !== nextAction) {
        prevAction.fadeOut(0.2);
      }
      
      nextAction.reset().fadeIn(0.2).play();
      currentAnim.current = animation;
    }
  }, [animation]);

  // 3. COLOR & MATERIAL OPTIMIZATION
  useEffect(() => {
    const cacheKey = `${color}-${isBoss ? 'boss' : 'unit'}`;
    let material = materialCache.get(cacheKey);
    
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color),
        roughness: 0.7,
        metalness: 0.2,
      });
      materialCache.set(cacheKey, material);
    }

    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.material = material!;
        mesh.castShadow = isBoss; 
        mesh.receiveShadow = false;
        
        if ((child as THREE.SkinnedMesh).isSkinnedMesh) {
          (mesh as any).frustumCulled = true;
          if (!meshRef.current) (meshRef as any).current = child;
        }
      }
    });
  }, [clone, color, isBoss]);

  // 4. PERFORMANCE-AWARE ANIMATION THROTTLING (Aggressive Culling)
  const skipCount = useRef(0);

  useFrame((state, delta) => {
    if (!mixer || !clone.visible || !group.current) return;

    const groupPos = _v1.setFromMatrixPosition(group.current.matrixWorld);
    const dist = state.camera.position.distanceTo(groupPos);
    
    // 1. GENEROUS RADIUS: Animations stay alive for much further
    if (dist > 75 && !isBoss) return; 

    skipCount.current++;
    
    // 2. BROAD THROTTLING RANGES
    let skipInterval = 1;
    if (dist > 45) skipInterval = 4; // Very far (but moving!)
    else if (dist > 25) skipInterval = 2; // Mid-range
    
    if (skipCount.current % skipInterval !== 0) return;

    mixer.update(delta * skipInterval);
  });

  return (
    <group ref={group} {...props} dispose={null}>
      <primitive object={clone} scale={characterScale} />
    </group>
  );
});

Character.displayName = 'Character';

useGLTF.preload('/Floating Character.glb');
