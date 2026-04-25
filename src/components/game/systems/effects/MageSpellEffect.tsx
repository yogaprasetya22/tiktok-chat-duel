'use client';
/**
 * MageSpellEffect — Redesigned (Modern Energy Orb)
 * Clean orb projectile with velocity arc and radial impact burst.
 * No heavy displacement loops. 2 draw calls: orb + impact.
 */
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MAGE_PROJECTILE_TIME_MS } from "@/src/core/logic/combat/constants";

export interface SpellEntry {
  fromX: number; fromY: number; fromZ: number;
  toX: number;   toY: number;   toZ: number;
  progress: number;
  startTime: number;
  active: boolean;
  color?: string;
  targetId?: string;
  isBullet?: boolean;
}
export type SpellsRegistryRef = React.RefObject<SpellEntry[]>;

import { UnitRuntimeData } from "@/src/core/domain/unit.types";

const MAX_SPELLS = 200;
const MAX_IMPACTS = 60;

// ─── Orb shader: glowing sphere ──────────────────────────────────────────────
const OrbMat = () => new THREE.ShaderMaterial({
    vertexShader: `
        varying vec3 vNormal;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        varying vec3 vColor;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vColor;
        void main() {
            // Fresnel rim glow
            float fresnel = pow(1.0 - max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
            float core = pow(max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0))), 1.5);
            vec3 col = mix(vColor * 3.0, vec3(1.0), core * 0.7);
            float alpha = clamp(fresnel * 1.5 + core * 0.8, 0.0, 1.0);
            gl_FragColor = vec4(col, alpha);
            if (gl_FragColor.a < 0.04) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

// ─── Impact burst: flat ring expanding ───────────────────────────────────────
const ImpactMat = () => new THREE.ShaderMaterial({
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
            float d = length(c);
            float ring = smoothstep(0.03, 0.0, abs(d - 0.42));
            float inner = smoothstep(0.35, 0.0, d) * 0.4;
            float alpha = ring * 3.0 + inner;
            gl_FragColor = vec4(vColor * 3.5, clamp(alpha, 0.0, 1.0));
            if (gl_FragColor.a < 0.03) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const _obj = new THREE.Object3D();

interface Props {
  spellsRef: SpellsRegistryRef;
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  simTimeRef: React.RefObject<number>;
}

interface ImpactEntry { x: number; y: number; z: number; startTime: number; color: string; active: boolean; }

export function MageSpellEffect({ spellsRef, unitRegistry, simTimeRef }: Props) {
  const orbRef    = useRef<THREE.InstancedMesh>(null!);
  const impactRef = useRef<THREE.InstancedMesh>(null!);
  const impacts   = useRef<ImpactEntry[]>(
    Array.from({ length: MAX_IMPACTS }, () => ({ x:0,y:0,z:0, startTime:0, color:'#fff', active:false }))
  );
  const _c = useMemo(() => new THREE.Color(), []);

  useFrame((_) => {
    const orb = orbRef.current;
    const imp = impactRef.current;
    const spells = spellsRef?.current;
    if (!orb || !imp || !spells) return;

    const simNow = simTimeRef.current || 0;
    let oi = 0;

    for (let i = 0; i < spells.length; i++) {
      const s = spells[i];
      if (!s || !s.active || s.isBullet) continue;

      // Homing: update target position
      if (s.targetId && unitRegistry.current) {
        const tIdx = parseInt(s.targetId.split('-')[1]);
        const tar = unitRegistry.current[tIdx];
        if (tar && tar.isActive && tar.id === s.targetId) {
          s.toX = tar.position[0]; s.toY = tar.position[1] + 1.0; s.toZ = tar.position[2];
        }
      }

      const dur = MAGE_PROJECTILE_TIME_MS || 380;
      const t = Math.min(1, (simNow - s.startTime) / dur);
      s.progress = t;

      // Arc path: lerp + vertical arc
      const px = s.fromX + (s.toX - s.fromX) * t;
      const pz = s.fromZ + (s.toZ - s.fromZ) * t;
      const arc = Math.sin(t * Math.PI) * 1.5;
      const py = s.fromY + (s.toY - s.fromY) * t + arc;

      const fade = 1 - t * t;

      if (oi < MAX_SPELLS) {
        _obj.position.set(px, py, pz);
        _obj.scale.setScalar((0.28 + arc * 0.05) * fade + 0.05);
        _obj.updateMatrix();
        orb.setMatrixAt(oi, _obj.matrix);
        _c.set(s.color || '#44aaff').multiplyScalar(1.5);
        orb.setColorAt(oi, _c);
        oi++;
      }

      if (t >= 0.99) {
        // Spawn impact burst
        const e = impacts.current.find(x => !x.active);
        if (e) { e.x = s.toX; e.y = 0.1; e.z = s.toZ; e.startTime = simNow; e.color = s.color || '#44aaff'; e.active = true; }
        s.active = false;
      }
    }

    orb.count = oi;
    orb.instanceMatrix.needsUpdate = true;
    if (orb.instanceColor) orb.instanceColor.needsUpdate = true;

    // Impact rings
    let ii = 0;
    for (let i = 0; i < impacts.current.length; i++) {
      const e = impacts.current[i];
      if (!e.active) continue;
      const t = (simNow - e.startTime) / 350;
      if (t >= 1) { e.active = false; continue; }
      if (ii >= MAX_IMPACTS) break;

      _obj.position.set(e.x, e.y, e.z);
      _obj.rotation.set(-Math.PI / 2, 0, 0);
      _obj.scale.setScalar(1 + t * 3.5);
      _obj.updateMatrix();
      imp.setMatrixAt(ii, _obj.matrix);
      _c.set(e.color).multiplyScalar((1 - t) * 2.0);
      imp.setColorAt(ii, _c);
      ii++;
    }

    imp.count = ii;
    imp.instanceMatrix.needsUpdate = true;
    if (imp.instanceColor) imp.instanceColor.needsUpdate = true;
  });

  const orbGeo    = useMemo(() => new THREE.SphereGeometry(1, 10, 10), []);
  const impactGeo = useMemo(() => new THREE.CircleGeometry(1, 16), []);
  const orbMat    = useMemo(() => OrbMat(), []);
  const impactMat = useMemo(() => ImpactMat(), []);

  return (
    <group>
      <instancedMesh ref={orbRef}    args={[orbGeo,    orbMat,    MAX_SPELLS]}  frustumCulled={false} />
      <instancedMesh ref={impactRef} args={[impactGeo, impactMat, MAX_IMPACTS]} frustumCulled={false} />
    </group>
  );
}
