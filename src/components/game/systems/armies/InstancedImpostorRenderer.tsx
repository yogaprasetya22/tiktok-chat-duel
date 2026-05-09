'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  LOD_IMPOSTOR_MAX,
  LOD_IMPOSTOR_SCALE,
  LOD_IMPOSTOR_BOSS_SCALE,
} from "@/src/core/logic/combat/constants";

/**
 * InstancedImpostorRenderer
 * 
 * Renders ALL units that are FAR from the camera as flat billboard quads
 * using a single THREE.InstancedMesh per team. This converts hundreds
 * of individual draw calls into just 2 (one per team).
 * 
 * How it works:
 * - Each frame, iterate the unit registry
 * - Skip units already rendered by the full-3D army pools (via renderedIdsRef)
 * - Skip units closer than LOD_IMPOSTOR_DIST_SQ
 * - For remaining units: compute position/rotation/scale via Object3D dummy,
 *   call instancedMesh.setMatrixAt(idx, dummy.matrix) and setColorAt()
 * - Set instanceMatrix.needsUpdate = true once at end
 * 
 * Result: 2 draw calls for potentially 600+ far-away units
 */

import { UnitRuntimeData } from "@/src/core/domain/unit.types";

interface InstancedImpostorRendererProps {
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  renderedIdsRef: React.RefObject<Set<number>>;
  playerColor: string;
  enemyColor: string;
  settingsRef: React.RefObject<any>;
  activeIndices?: number[];
}

// Reusable dummy Object3D for matrix composition — zero-alloc pattern
const _dummy = new THREE.Object3D();
const _color = new THREE.Color();
const _hidePos = new THREE.Matrix4().compose(
  new THREE.Vector3(0, -1000, 0),
  new THREE.Quaternion(),
  new THREE.Vector3(0, 0, 0)
);

// Team color cache to avoid re-creating Color objects
const _playerColor = new THREE.Color();
const _enemyColor = new THREE.Color();
const _white = new THREE.Color('#ffffff');
const _black = new THREE.Color('#000000');

// Class-specific impostor colors (slightly tinted to differentiate)
const CLASS_TINT: Record<string, [number, number, number]> = {
  fighter:  [1.0, 0.95, 0.9],
  tank:     [0.9, 0.95, 1.0],
  mage:     [0.95, 0.85, 1.0],
  marksman: [1.0, 1.0, 0.85],
  assassin: [0.85, 0.85, 0.9],
};

export function InstancedImpostorRenderer({
  unitRegistry,
  renderedIdsRef,
  playerColor,
  enemyColor,
  settingsRef,
  activeIndices,
}: InstancedImpostorRendererProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const lastCountRef = useRef(0);

  // Billboard quad geometry (simple plane facing camera)
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1.5);
    return geo;
  }, []);

  // Impostor material — simple, unlit, transparent edges
  const material = useMemo(() => {
    return new THREE.RawShaderMaterial({
      uniforms: {},
      vertexShader: `
        precision highp float;
        uniform mat4 projectionMatrix;
        uniform mat4 modelViewMatrix;
        attribute vec3 position;
        attribute vec2 uv;
        attribute mat4 instanceMatrix;
        attribute vec3 instanceColor;

        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          vUv = uv;
          vColor = instanceColor;
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
          // Soldier silhouette: rounded rectangle with head
          vec2 p = vUv * 2.0 - 1.0;
          
          // Body (rounded rect)
          float bodyW = 0.6;
          float bodyH = 0.7;
          float bodyY = -0.15;
          vec2 bodyP = vec2(abs(p.x), p.y - bodyY);
          float bodyD = length(max(bodyP - vec2(bodyW * 0.5, bodyH * 0.5), 0.0));
          float body = smoothstep(0.15, 0.1, bodyD);
          
          // Head (circle)
          float headR = 0.22;
          float headY = 0.55;
          float headD = length(p - vec2(0.0, headY));
          float head = smoothstep(headR + 0.05, headR, headD);
          
          float alpha = max(body, head);
          if (alpha < 0.1) discard;
          
          // Use instance color passed from CPU
          gl_FragColor = vec4(vColor, alpha * 0.9);
        }
      `,
      transparent: true,
      depthWrite: false, // impostors are far and numerous, don't mess with depth
    });
  }, []);

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

  // Initialize all instances to hidden
  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < LOD_IMPOSTOR_MAX; i++) {
      meshRef.current.setMatrixAt(i, _hidePos);
      meshRef.current.setColorAt(i, _black);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, []);

  useFrame((state) => {
    const rawMap = unitRegistry.current;
    const renderedIds = renderedIdsRef.current;
    const mesh = meshRef.current;
    if (!rawMap || !mesh) return;

    // Pre-compute team colors
    _playerColor.set(playerColor);
    _enemyColor.set(enemyColor);

    // FIX #1: Hoist Date.now() OUTSIDE per-unit loop (saves 600+ syscalls/frame)
    const now = Date.now();

    let idx = 0;
    const indices = activeIndices || [];
    const frustum = (state as any).battleFrustum;
    const unitScale = settingsRef.current?.unitScale || 1.0;

    for (let k = 0; k < indices.length; k++) {
      if (idx >= LOD_IMPOSTOR_MAX) break;
      const i = indices[k];
      const u = rawMap[i];
      // Robust Check: skip if inactive, sunk, or already rendered by 3D pool
      if (!u || !u.isActive || u.position[1] < -10 || renderedIds.has(i)) continue;
      
      const isVisible = frustum ? frustum.containsPoint(_dummy.position.set(u.position[0], 0, u.position[2])) : true;
      
      if (!isVisible) {
        mesh.setMatrixAt(idx, _hidePos);
        idx++;
        continue;
      }

      // Compose the impostor transform via dummy Object3D
      const scale = u.isBoss ? LOD_IMPOSTOR_BOSS_SCALE : LOD_IMPOSTOR_SCALE;

      _dummy.position.set(u.position[0], u.position[1] + scale * 0.5 * unitScale, u.position[2]);
      _dummy.quaternion.copy(state.camera.quaternion);
      _dummy.scale.setScalar(scale * unitScale);
      _dummy.updateMatrix();

      mesh.setMatrixAt(idx, _dummy.matrix);

      const baseColor = u.type === 'player' ? _playerColor : _enemyColor;
      const tint = CLASS_TINT[u.unitClass] || [1, 1, 1];
      _color.setRGB(
        baseColor.r * tint[0],
        baseColor.g * tint[1],
        baseColor.b * tint[2]
      );

      const flashAge = now - (u.lastDamageTime || 0);
      if (flashAge < 120) {
        const t = 1.0 - flashAge / 120;
        _color.lerp(_white, t * 0.6);
      }

      mesh.setColorAt(idx, _color);
      idx++;
    }

    // Optimization: Only hide what was visible in previous frame or what changed
    // For simplicity, we still hide the rest but it's much faster if LOD_IMPOSTOR_MAX is smaller.
    // However, we only do it up to the previous count + some margin if needed.
    const hideStart = idx;
    const hideEnd = Math.max(idx, lastCountRef.current);
    for (let i = hideStart; i < hideEnd; i++) {
      mesh.setMatrixAt(i, _hidePos);
    }
    lastCountRef.current = idx;

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = idx; // FIX: Only draw visible instances, not full 1200 buffer
    
    // Clear for next frame so armies can repopulate
    renderedIdsRef.current.clear();
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, LOD_IMPOSTOR_MAX]}
      frustumCulled={false}
      renderOrder={1}
    />
  );
}
