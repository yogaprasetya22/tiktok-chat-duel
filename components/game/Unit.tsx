'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect, useState, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text, Plane } from '@react-three/drei';
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
  const hpBarRef = useRef<HTMLDivElement>(null!);
  const auraRef = useRef<THREE.Mesh>(null!);
  const currentHp = useRef(initialHp);
  const lastHp = useRef(initialHp);
  const hpPercentRef = useRef(initialHp / maxHp);
  const labelRef = useRef<THREE.Group>(null!);
  const barInnerRef = useRef<THREE.Mesh>(null!);
  const [internalStatus, setInternalStatus] = useState(initialStatus);
  const [showLabel, setShowLabel] = useState(false);
  const { spawnVFX } = useVFX();
  const gameState = useStore(s => s.gameState);
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
    if (data.status !== internalStatus) {
      setInternalStatus(data.status as any);
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
        meshRef.current.quaternion.slerp(_q1, 0.2);
      }
    }

    
    // 4. HP BAR & LABEL SYNC (GPU-BASED)
    const hpPercent = Math.max(0, currentHp.current / maxHp);
    hpPercentRef.current = hpPercent;
    
    if (barInnerRef.current) {
        const barWidth = isBoss ? 2.4 : 1.2;
        barInnerRef.current.scale.x = hpPercent;
        barInnerRef.current.position.x = (barWidth * 0.5) * (hpPercent - 1);
        
        // Critical Color logic
        const material = barInnerRef.current.material as THREE.MeshBasicMaterial;
        if (hpPercent < 0.25) {
            material.color.set(Math.sin(state.clock.elapsedTime * 15) > 0 ? '#ff0000' : '#7f0000');
        } else {
            material.color.set(hpPercent > 0.5 ? '#22c55e' : '#f59e0b');
        }
    }

    if (labelRef.current) {
        labelRef.current.visible = !isDying;
    }

    // 6. VFX & SOUND (Throttled)
    if (currentHp.current < lastHp.current) {
      if (Math.random() > 0.5 || isBoss) { // 50% chance for particle on normal hit to reduce clutter
        const pos = meshRef.current.position;
        spawnVFX([pos.x, pos.y, pos.z], currentHp.current <= 0 ? 'death' : 'hit', teamColor);
      }
    }

    lastHp.current = currentHp.current;
  });

  const getAnimation = (): AnimationName => {
    if (isDying) return 'Defeat';
    if (internalStatus === 'attacking') return 'Attack(1h)';
    if (internalStatus === 'marching') return 'Run';
    return 'Idle';
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

      {/* GPU-BASED UI BILLBOARD (SUPER FAST) */}
      {!isDying && gameState !== 'SETUP' && (
        <Billboard
          ref={labelRef}
          position={[0, isBoss ? 7.6 : 3.2 + (id.charCodeAt(0) % 10) * 0.15, 0]}
        >
          {/* UserName Text */}
          <Text
            fontSize={isBoss ? 0.8 : 0.45}
            color="white"
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.04}
            outlineColor="#000000"
            position-y={0.25}
          >
            {isBoss ? `🔥 ${userName} 🔥` : userName}
          </Text>

          {/* 3D HP BAR */}
          <group position-y={0.1}>
            {/* Background */}
            <Plane args={[isBoss ? 2.5 : 1.25, isBoss ? 0.25 : 0.12]}>
              <meshBasicMaterial color="#000000" transparent opacity={0.6} />
            </Plane>
            {/* Health Inner */}
            <mesh ref={barInnerRef} position-z={0.01}>
              <planeGeometry args={[isBoss ? 2.4 : 1.2, isBoss ? 0.2 : 0.08]} />
              <meshBasicMaterial color="#22c55e" />
            </mesh>
          </group>
        </Billboard>
      )}
    </group>
  );
});
