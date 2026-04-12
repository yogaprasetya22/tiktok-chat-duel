'use client';
/**
 * MageSpellEffect – GLSL instanced magic projectile system.
 * Renders high-impact energy fireballs with pulsing cores and trails.
 */

import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVFX } from '../VFXManager';
import { useStore } from '../../../hooks/useStore';
import { MAGE_PROJECTILE_TIME_MS } from '../../../hooks/battle/constants';
import gsap from 'gsap';

// ─── Shared types ─────────────────────────────────────────────────────────────
export interface SpellEntry {
  fromX: number; fromY: number; fromZ: number;
  toX: number;   toY: number;   toZ: number;
  progress: number;  
  startTime: number; 
  active: boolean;
  color?: string;
  targetId?: string;
  isBullet?: boolean;
  targetPrevX?: number;
  targetPrevZ?: number;
}

export type SpellsRegistryRef = React.RefObject<SpellEntry[]>;

// ─── GLSL Shaders ─────────────────────────────────────────────────────────────
// ─── GLSL Shaders ─────────────────────────────────────────────────────────────
const LightningShader = {
    uniforms: {
        time: { value: 0 },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vGlow;
        
        #include <common>

        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif

        uniform float time;

        void main() {
            vUv = uv;
            vColor = instanceColor;
            
            // Zigzag logic: displace vertices based on Y (long axis)
            float displacement = sin(position.y * 12.0 + time * 50.0) * 0.25;
            displacement += sin(position.y * 28.0 - time * 40.0) * 0.15;
            displacement += sin(position.y * 45.0 + time * 70.0) * 0.08;
            
            // Only displace if not at the ends (staff/target)
            float endMask = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
            
            vec3 pos = position;
            pos.x += displacement * endMask;
            pos.z += displacement * endMask * 0.5;

            vec4 worldPosition = instanceMatrix * vec4(pos, 1.0);
            gl_Position = projectionMatrix * modelViewMatrix * worldPosition;
            
            vGlow = 1.0 + sin(time * 50.0) * 0.5;
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        varying float vGlow;
        uniform float time;

        void main() {
            // Bright core, outer glow
            float dist = abs(vUv.x - 0.5) * 2.0;
            float core = smoothstep(0.15, 0.0, dist);
            float glow = smoothstep(0.6, 0.0, dist);
            
            vec3 cyan = vec3(0.0, 1.0, 1.0);
            vec3 finalColor = mix(cyan * 0.5, vec3(1.0), core);
            finalColor += cyan * glow * vGlow;
            
            gl_FragColor = vec4(finalColor * 2.5, glow);
            if (gl_FragColor.a < 0.1) discard;
        }
    `
};

const ExplosionShader = {
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        #include <common>

        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif

        void main() {
            vUv = uv;
            vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        uniform float time;

        void main() {
            vec2 uv = vUv - 0.5;
            float dist = length(uv);
            
            // Plasma crackle pattern
            float angle = atan(uv.y, uv.x);
            float crackle = sin(angle * 10.0 + time * 20.0) * 0.1;
            crackle += sin(angle * 5.0 - time * 35.0) * 0.15;
            
            float ring = smoothstep(0.48 + crackle, 0.4, dist);
            float hole = smoothstep(0.35 + crackle, 0.45, dist);
            float core = smoothstep(0.15, 0.0, dist);
            
            vec3 cyan = vec3(0.0, 1.0, 1.0);
            vec3 color = mix(cyan * 0.5, vec3(1.0), core);
            color += cyan * ring * hole * 3.0;
            
            float alpha = (ring * hole + core) * (1.0 - dist * 2.0);
            gl_FragColor = vec4(color * 4.0, alpha);
            if (gl_FragColor.a < 0.05) discard;
        }
    `
};

// ─── Component ────────────────────────────────────────────────────────────────
const MAX_SPELLS = 200;
const MAX_EXPLOSIONS = 100;

interface ExplosionEntry {
    x: number; y: number; z: number;
    startTime: number;
    color: string;
    active: boolean;
}

import { UnitRuntimeData } from '../../../hooks/battle/types';

interface Props {
  spellsRef: SpellsRegistryRef;
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  simTimeRef: React.RefObject<number>;
}

const _tempObj = new THREE.Object3D();
const _from    = new THREE.Vector3();
const _to      = new THREE.Vector3();
const _pos     = new THREE.Vector3();
const _dir     = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _rocketEase = gsap.parseEase("power1.in");

export function MageSpellEffect({ spellsRef, unitRegistry, simTimeRef }: Props) {
  const { spawnVFX } = useVFX();
  const projectileMeshRef = useRef<THREE.InstancedMesh>(null!);
  const explosionMeshRef = useRef<THREE.InstancedMesh>(null!);
  const explosionsRef = useRef<ExplosionEntry[]>(
      Array.from({ length: MAX_EXPLOSIONS }, () => ({ x: 0, y: 0, z: 0, startTime: 0, color: '#ffffff', active: false }))
  );

  const _color = useMemo(() => new THREE.Color(), []);

  const projectileGeo = useMemo(() => {
    // Tall cylinder for hit-scan beams (32 segments for smooth zigzag)
    const geo = new THREE.CylinderGeometry(0.05, 0.05, 1, 4, 32);
    geo.translate(0, 0.5, 0); // Origin at bottom
    geo.rotateX(Math.PI / 2); // Point along Z
    return geo;
  }, []);

  const explosionGeo = useMemo(() => new THREE.SphereGeometry(1, 8, 8), []);

  const projectileMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: LightningShader.vertexShader,
    fragmentShader: LightningShader.fragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexColors: true,
    defines: { USE_INSTANCING: '', USE_INSTANCING_COLOR: '' }
  }), []);

  const explosionMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: ExplosionShader.vertexShader,
    fragmentShader: ExplosionShader.fragmentShader,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexColors: true,
    defines: { USE_INSTANCING: '', USE_INSTANCING_COLOR: '' }
  }), []);

  useFrame((state) => {
    const pMesh = projectileMeshRef.current;
    const eMesh = explosionMeshRef.current;
    const spells = spellsRef?.current;
    if (!pMesh || !eMesh || !spells) return;

    const simNow = simTimeRef.current || 0;
    (projectileMat as any).uniforms.time.value = state.clock.elapsedTime;

    let pIdx = 0;
    for (let i = 0; i < spells.length; i++) {
        const s = spells[i];
        if (!s || !s.active || (s as any).isBullet) continue;

        // Homing
        if (s.targetId && unitRegistry.current) {
            const tIdx = parseInt(s.targetId.split('-')[1]);
            const target = unitRegistry.current[tIdx];
            if (target && target.isActive && target.id === s.targetId && target.hp > 0) {
                s.toX = target.position[0]; s.toY = target.position[1] + 1.0; s.toZ = target.position[2];
            }
        }

        const alpha = (simNow - s.startTime) / (MAGE_PROJECTILE_TIME_MS || 400);
        s.progress = Math.min(1.0, Math.max(0, isNaN(alpha) ? 0 : alpha));
        
        // Lightning logic: Beam connects staff to target instantly
        const fadeOut = 1.0 - Math.pow(s.progress, 2.0); // Quadratic fade

        _from.set(s.fromX, s.fromY, s.fromZ);
        _to.set(s.toX, s.toY, s.toZ);
        
        const dist = _from.distanceTo(_to);
        _tempObj.position.copy(_from);
        _tempObj.lookAt(_to);
        _tempObj.scale.set(1, 1, dist);
        _tempObj.updateMatrix();
        
        pMesh.setMatrixAt(pIdx, _tempObj.matrix);
        // Cyan with fade-out
        _color.set('#00ffff').multiplyScalar(fadeOut);
        pMesh.setColorAt(pIdx, _color);
        pIdx++;

        if (s.progress >= 0.99) {
            // Spawn transient explosion
            const exp = explosionsRef.current.find(e => !e.active);
            if (exp) {
                exp.x = s.toX; exp.y = s.toY; exp.z = s.toZ;
                exp.startTime = simNow; exp.color = '#00ffff'; exp.active = true;
            }
            if (spawnVFX) {
                // Sharp impact
                spawnVFX([s.toX, s.toY, s.toZ], 'spark', '#00ffff');
                spawnVFX([s.toX, s.toY, s.toZ], 'muzzle', '#ffffff');
            }
            s.active = false;
        }
    }
    pMesh.count = pIdx;
    pMesh.instanceMatrix.needsUpdate = true;
    if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true;

    // Handle Explosions Visual (Shrunken Expanding Sphere)
    let eIdx = 0;
    const EXPLOSION_DURATION = 200;
    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
        const e = explosionsRef.current[i];
        if (!e.active) continue;

        const eAlpha = (simNow - e.startTime) / EXPLOSION_DURATION;
        if (eAlpha >= 1.0) { e.active = false; continue; }

        _tempObj.position.set(e.x, e.y, e.z);
        // Larger radius for AoE feedback: 5.0m expansion
        const scale = eAlpha * 5.0;
        _tempObj.scale.setScalar(scale);
        _tempObj.updateMatrix();
        eMesh.setMatrixAt(eIdx, _tempObj.matrix);
        _color.set(e.color).lerp(new THREE.Color('#ffffff'), 1.0 - eAlpha);
        eMesh.setColorAt(eIdx, _color);
        eIdx++;
    }
    eMesh.count = eIdx;
    eMesh.instanceMatrix.needsUpdate = true;
    if (eMesh.instanceColor) eMesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={projectileMeshRef} args={[projectileGeo, projectileMat, MAX_SPELLS]} frustumCulled={false} />
      <instancedMesh ref={explosionMeshRef} args={[explosionGeo, explosionMat, MAX_EXPLOSIONS]} frustumCulled={false} />
    </group>
  );
}
