'use client';
/**
 * MMSpellEffect — Redesigned (Modern Energy Bullet)
 * Clean elongated streak with bright core, no hash/spark noise.
 * Homing bullet with smooth trail taper. 1 draw call.
 */
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { SpellsRegistryRef } from './MageSpellEffect';
import { UnitRuntimeData } from "@/src/core/domain/unit.types";

interface Props {
  spellsRef: SpellsRegistryRef;
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  simTimeRef: React.RefObject<number>;
  bulletSpeed?: number;
}

const MAX_BULLETS = 400;

const BulletMat = () => new THREE.ShaderMaterial({
    vertexShader: `
        varying vec2 vUv;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        varying vec3 vColor;
        void main() {
            vUv = uv;
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vec2 c = vUv - 0.5;
            // Elongated core: narrow on sides, bright in center
            float core = smoothstep(0.2, 0.0, abs(c.y));
            // Front taper: bright at tip, fades at tail
            float taper = smoothstep(-0.5, 0.2, c.x + 0.5) * smoothstep(0.5, 0.0, c.x + 0.5);
            // Side glow halo
            float halo = smoothstep(0.45, 0.0, abs(c.y)) * 0.3;
            float alpha = (core * taper + halo) * 0.95;
            vec3 col = mix(vColor * 3.0, vec3(1.0), core * taper * 0.8);
            gl_FragColor = vec4(col, alpha);
            if (gl_FragColor.a < 0.04) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexColors: true,
    defines: { USE_INSTANCING: '', USE_INSTANCING_COLOR: '' }
});

const _obj  = new THREE.Object3D();
const _from = new THREE.Vector3();
const _to   = new THREE.Vector3();
const _pos  = new THREE.Vector3();
const _hide = new THREE.Matrix4().setPosition(0, -100, 0);

export function MMSpellEffect({ spellsRef, unitRegistry, simTimeRef, bulletSpeed = 140 }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const _col = useMemo(() => new THREE.Color(), []);

  const bulletGeo = useMemo(() => {
    // Cylinder is perfect for a 3D bullet/laser streak
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    // Rotate to align length (Y axis of cylinder) with Z axis for lookAt
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);

  const bulletMat = useMemo(() => BulletMat(), []);

  useFrame((_) => {
    const mesh = meshRef.current;
    const spells = spellsRef?.current;
    if (!mesh || !spells) return;

    let n = 0;

    for (let i = 0; i < spells.length; i++) {
      const s = spells[i];
      if (!s || !s.active || !s.isBullet) continue;

      // Homing
      if (s.targetId && unitRegistry.current) {
        const tIdx = parseInt(s.targetId.split('-')[1]);
        const tar = unitRegistry.current[tIdx];
        if (tar && tar.isActive && tar.id === s.targetId) {
          s.toX = tar.position[0]; s.toY = tar.position[1] + 1.2; s.toZ = tar.position[2];
        }
      }

      const simNow = simTimeRef.current || 0;
      const t = Math.min(1, (simNow - s.startTime) / bulletSpeed);
      s.progress = t;

      _from.set(s.fromX, s.fromY, s.fromZ);
      _to.set(s.toX, s.toY, s.toZ);
      _pos.lerpVectors(_from, _to, t);

      if (n < MAX_BULLETS) {
        _obj.position.copy(_pos);
        _obj.lookAt(_to);
        // Bullet elongated: longer at start (high speed feel), shorter near end
        const stretch = (2.5 - t * 1.2);
        _obj.scale.set(0.18, 0.18, stretch);
        _obj.updateMatrix();
        mesh.setMatrixAt(n, _obj.matrix);
        _col.set(s.color || '#ffffff').multiplyScalar(1.5);
        mesh.setColorAt(n, _col);
        n++;
      }

      if (t >= 0.99) { s.active = false; }
    }

    // Hide unused slots
    for (let i = n; i < mesh.count; i++) {
      mesh.setMatrixAt(i, _hide);
    }

    mesh.count = Math.max(n, 1);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[bulletGeo, bulletMat, MAX_BULLETS]} frustumCulled={false} />
  );
}
