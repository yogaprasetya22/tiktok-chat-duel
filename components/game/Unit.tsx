'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect, useState, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import { Character, AnimationName } from './Character';
import { useVFX } from './VFXManager';
import { useStore } from "../../hooks/useStore";

export interface UnitProps {
  id: string;
  userName: string;
  type: 'player' | 'enemy';
  level: number;
  hp: number;
  maxHp: number;
  status: 'marching' | 'attacking' | 'idling';
  teamColor: string;
  isDying?: boolean;
  isBoss?: boolean;
  debug?: boolean;
  unitRegistry: React.RefObject<Map<string, { hp: number; status: string; position: number[] }>>;
}

const LEVEL_COLORS = [
  "#FFFFFF", // Level 1 (Default)
  "#4CAF50", // Level 2
  "#2196F3", // Level 3
  "#e11d48", // Level 4 
  "#facc15", // Level 5 (Gold)
];

// --- STATIC OPTIMIZATION OBJECTS (Avoid GC) ---
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _e1 = new THREE.Euler();

export const Unit = React.memo(({
  id,
  type,
  level,
  hp: initialHp,
  maxHp,
  status: initialStatus,
  userName,
  teamColor,
  isDying,
  isBoss,
  unitRegistry
}: UnitProps) => {
  const meshRef = useRef<THREE.Group>(null!);
  const auraRef = useRef<THREE.Mesh>(null!);
  const currentHp = useRef(initialHp);
  const lastHp = useRef(initialHp);
  const labelRef = useRef<THREE.Group>(null!);
  const statusRef = useRef(initialStatus);
  const [currentAnimation, setCurrentAnimation] = useState<AnimationName>(initialStatus === 'attacking' ? 'Attack(1h)' : (initialStatus === 'marching' ? 'Run' : 'Idle'));
  const { spawnVFX } = useVFX();
  const characterRef = useRef<any>(null);

  // Scale variation for visual diversity
  const randomScale = useMemo(() => 0.8 + Math.random() * 0.4, []);

  useLayoutEffect(() => {
    const data = unitRegistry.current?.get(id);
    if (data && meshRef.current) {
      meshRef.current.position.set(data.position[0], data.position[1], data.position[2]);
    }
  }, []);

  useFrame((state, delta) => {
    if (!meshRef.current || isDying) return;

    const data = unitRegistry.current?.get(id);
    if (!data) return;

    // 1. DATA SYNC
    currentHp.current = data.hp;

    // 2. TRIGGER RE-RENDER ONLY ON STATUS CHANGE (Saves huge CPU)
    if (data.status !== statusRef.current) {
      statusRef.current = data.status as any;
      
      // Map status to animation name manually to trigger ONE re-render
      const nextAnim: AnimationName = data.status === 'attacking' ? 'Attack(1h)' : (data.status === 'marching' ? 'Run' : 'Idle');
      if (nextAnim !== currentAnimation) {
        setCurrentAnimation(nextAnim);
      }
    }

    // 3. MOVEMENT & ROTATION
    _v1.set(data.position[0], data.position[1], data.position[2]);
    meshRef.current.position.lerp(_v1, 0.25);

    if (data.status === 'attacking') {
      const targetAngle = type === 'player' ? Math.PI : 0;
      _q1.setFromEuler(_e1.set(0, targetAngle, 0));
      meshRef.current.quaternion.slerp(_q1, 0.4);
    } else {
      _v2.copy(_v1).sub(meshRef.current.position);
      if (_v2.lengthSq() > 0.001) {
        const angle = Math.atan2(_v2.x, _v2.z);
        _q1.setFromEuler(_e1.set(0, angle, 0));
        meshRef.current.quaternion.slerp(_q1, 0.1);
      }
    }


    // 4. HUD VISIBILITY & CULLING (Throttled for performance)
    if (state.clock.getElapsedTime() - ((meshRef.current as any)._lastCullTime || 0) > 0.15) {
      (meshRef.current as any)._lastCullTime = state.clock.getElapsedTime();
      const dist = state.camera.position.distanceTo(meshRef.current.position);
      
      if (labelRef.current) {
        const gState = useStore.getState().gameState;
        // Conservative Name Culling (Restored 60 FPS balance)
        const maxDist = isBoss ? 60 : 35;
        labelRef.current.visible = !isDying && gState !== 'SETUP' && dist < maxDist; 
      }
      (meshRef.current as any)._lastDist = dist;
    }
    const dist = (meshRef.current as any)._lastDist || 0;

    // 5. HP & VFX SYNC (Plays even if HUD is culled)
    if (currentHp.current < lastHp.current) {
      const pos = meshRef.current.position;
      if (currentHp.current <= 0) {
        spawnVFX([pos.x, pos.y, pos.z], 'death', teamColor);
      } else if (isBoss) {
        spawnVFX([pos.x, pos.y, pos.z], 'hit', teamColor);
      }
    }
    lastHp.current = currentHp.current;

    // 6. HUD Sync (Only Bosses)
    if (!labelRef.current || !labelRef.current.visible) {
      return; 
    }
  });

  const getAnimation = (): AnimationName => {
    if (isDying) return 'Defeat';
    return currentAnimation;
  };

  return (
    <group ref={meshRef}>
      {isBoss && (
        <mesh ref={auraRef} rotation-x={-Math.PI / 2} position-y={0.05}>
          <ringGeometry args={[1.5, 1.8, 24]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      <Character
        animation={getAnimation()}
        color={isBoss ? "#FFD700" : teamColor}
        characterScale={(isBoss ? 4.5 : 1.5) * randomScale}
      />

      {/* GPU-BASED UI BILLBOARD (ALL UNITS) */}
      {!isDying && (
        <Billboard
          ref={labelRef}
          position={[0, isBoss ? 7.6 : 3.2, 0]}
          visible={false} /* Controlled by useFrame */
        >
          <Text
            fontSize={isBoss ? 0.8 : 0.4}
            color="white"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0} // ABSOLUTELY NO OUTLINES FOR MAXIMUM PERFORMANCE
            outlineColor="#000000"
            position-y={0.25}
          >
            {isBoss ? `Boss ${userName}` : userName}
          </Text>
        </Billboard>
      )}
    </group>
  );
});
