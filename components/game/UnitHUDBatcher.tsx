'use client';

import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m1 = new THREE.Matrix4();
const _q1 = new THREE.Quaternion();
const _c1 = new THREE.Color();
const _shiftM = new THREE.Matrix4();
const _scaleM = new THREE.Matrix4();

interface UnitHUDBatcherProps {
  unitRegistry: React.RefObject<Map<string, { hp: number; status: string; position: number[]; maxHp?: number; isBoss: boolean }>>;
}

/**
 * High-Performance HUD Batcher 
 * Renders all unit health bars in exactly 2 DRAW CALLS total.
 */
export const UnitHUDBatcher = ({ unitRegistry }: UnitHUDBatcherProps) => {
  const bgRef = useRef<THREE.InstancedMesh>(null!);
  const fillRef = useRef<THREE.InstancedMesh>(null!);

  const BAR_WIDTH = 1.2;
  const BAR_HEIGHT = 0.12;
  const BAR_OFFSET_Y = 3.2;

  useFrame((state) => {
    if (!unitRegistry.current) return;
    
    const registry = unitRegistry.current;
    const units = Array.from(registry.entries());
    const count = units.length;

    // Reset visibility by moving them far away initially
    for (let i = 0; i < 500; i++) {
        _m1.makeTranslation(0, -1000, 0);
        bgRef.current.setMatrixAt(i, _m1);
        fillRef.current.setMatrixAt(i, _m1);
    }

    let activeCount = 0;
    const camPos = state.camera.position;

    units.forEach(([id, data], index) => {
      if (activeCount >= 500) return;
      if (!data.isBoss) return; // FIX: Only render "darah" (HP bar) for Bosses

      _v1.set(data.position[0], data.position[1], data.position[2]);
      const dist = camPos.distanceTo(_v1);
      
      // HUD Cull + Dynamic Height
      if (dist > 35) return; 

      const yOffset = BAR_OFFSET_Y + (id.charCodeAt(0) % 10) * 0.1;
      const hpPercent = Math.max(0, data.hp / (data.maxHp || 100));

      // 1. BG Position & Billboard (Look at camera)
      _v2.set(_v1.x, _v1.y + yOffset, _v1.z);
      _m1.identity();
      _m1.setPosition(_v2);
      
      // Apply Billboarding
      _q1.copy(state.camera.quaternion);
      _m1.makeRotationFromQuaternion(_q1);
      _m1.setPosition(_v2);
      
      bgRef.current.setMatrixAt(activeCount, _m1);

      // 2. FILL Position (Scale and offset-x)
      _shiftM.makeTranslation((BAR_WIDTH * 0.5) * (hpPercent - 1), 0, 0.01);
      _scaleM.makeScale(hpPercent, 1, 1);
      
      const fillMatrix = _m1.clone(); 
      fillMatrix.multiply(_shiftM).multiply(_scaleM);
      fillRef.current.setMatrixAt(activeCount, fillMatrix);
      
      // HP Color mapping (Static Color Reuse)
      if (hpPercent < 0.25) {
        _c1.set(Math.sin(state.clock.elapsedTime * 15) > 0 ? '#ff0000' : '#7f0000');
      } else {
        _c1.set(hpPercent > 0.5 ? '#22c55e' : '#f59e0b');
      }
      fillRef.current.setColorAt(activeCount, _c1);

      activeCount++;
    });

    bgRef.current.count = activeCount;
    fillRef.current.count = activeCount;
    bgRef.current.instanceMatrix.needsUpdate = true;
    fillRef.current.instanceMatrix.needsUpdate = true;
    if (fillRef.current.instanceColor) fillRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Backgrounds */}
      <instancedMesh ref={bgRef} args={[undefined, undefined, 500]}>
        <planeGeometry args={[BAR_WIDTH + 0.05, BAR_HEIGHT + 0.05]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.6} depthWrite={false} />
      </instancedMesh>

      {/* Fills */}
      <instancedMesh ref={fillRef} args={[undefined, undefined, 500]}>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial depthWrite={false} />
      </instancedMesh>
    </group>
  );
};
