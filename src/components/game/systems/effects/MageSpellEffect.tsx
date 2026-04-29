'use client';
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MAGE_PROJECTILE_TIME_MS } from "@/src/core/logic/combat/constants";
import { UnitRuntimeData, UnitRarity } from "@/src/core/domain/unit.types";
import { VFX_TEXTURES } from './VFXAssets';

export interface SpellEntry {
  fromX: number; fromY: number; fromZ: number;
  toX: number; toY: number; toZ: number;
  progress: number;
  startTime: number;
  active: boolean;
  color?: string;
  targetId?: string;
  isBullet?: boolean;
  isMeteor?: boolean; // New: vertical falling projectile
  rarity?: UnitRarity;
}
export type SpellsRegistryRef = React.RefObject<SpellEntry[]>;

// ─── Optimized Magic Material (Billboarded for projectiles/flashes) ──────────
const SuperMagicMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: tex }, uTime: { value: 0 } },
  vertexShader: `
        varying vec2 vUv;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        varying vec3 vColor;
        void main() {
            vUv = uv;
            vColor = instanceColor;
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float sc = length(vec3(instanceMatrix[0][0], instanceMatrix[0][1], instanceMatrix[0][2]));
            mvPosition.xy += position.xy * sc;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
  fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            float dist = length(vUv - 0.5);
            float core = smoothstep(0.12, 0.0, dist) * 2.5;
            float pulse = 0.8 + 0.2 * sin(uTime * 10.0 + dist * 5.0);
            vec3 glow = vColor * tex.rgb * 5.0;
            vec3 whiteCore = vec3(1.5) * core * pulse;
            gl_FragColor = vec4(glow + whiteCore, tex.a * (0.7 + core));
            if (gl_FragColor.a < 0.01) discard;
        }
    `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

// ─── Ground Magic Material (Respects Matrix rotation, used for flat seals) ───
const GroundMagicMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
  uniforms: { tDiffuse: { value: tex }, uTime: { value: 0 } },
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
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            float dist = length(vUv - 0.5);
            float pulse = 0.8 + 0.2 * sin(uTime * 5.0 + dist * 3.0);
            vec3 glow = vColor * tex.rgb * 3.0 * pulse;
            gl_FragColor = vec4(glow, tex.a);
            if (gl_FragColor.a < 0.01) discard;
        }
    `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

const _obj = new THREE.Object3D();
const MAX_ORB_INSTANCES = 800; // Optimized count

interface ImpactEntry { x: number; y: number; z: number; startTime: number; color: string; active: boolean; type: 'sigil' | 'embers' | 'charge'; rot: number; }

export function MageSpellEffect({ spellsRef, unitRegistry, simTimeRef }: { spellsRef: SpellsRegistryRef; unitRegistry: React.RefObject<UnitRuntimeData[]>; simTimeRef: React.RefObject<number>; }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const groundRef = useRef<THREE.InstancedMesh>(null!);
  const chargeRef = useRef<THREE.InstancedMesh>(null!);
  const impactRef = useRef<THREE.InstancedMesh>(null!);
  const impactIdx = useRef(0);
  const impacts = useRef<ImpactEntry[]>(Array.from({ length: 150 }, () => ({ x: 0, y: 0, z: 0, startTime: 0, color: '#fff', active: false, type: 'sigil', rot: 0 })));
  const activeImpacts = useRef<number[]>([]);
  const _c = useMemo(() => new THREE.Color(), []);

  const quadGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const orbMat = useMemo(() => SuperMagicMat(VFX_TEXTURES.magic[2]), []);
  const bottomMat = useMemo(() => GroundMagicMat(VFX_TEXTURES.magic[0]), []);
  const impMat = useMemo(() => GroundMagicMat(VFX_TEXTURES.magic[4]), []);

  useFrame((state) => {
    const mesh = meshRef.current;
    const grd = groundRef.current;
    const crg = chargeRef.current;
    const imp = impactRef.current;
    const spells = spellsRef?.current;
    if (!mesh || !grd || !imp || !crg || !spells) return;

    const simNow = simTimeRef.current || 0;
    const time = state.clock.elapsedTime;
    
    // Animation: Sequential textures
    const frameIdx = Math.floor(time * 12) % 5;
    orbMat.uniforms.tDiffuse.value = VFX_TEXTURES.magic[frameIdx];
    bottomMat.uniforms.tDiffuse.value = VFX_TEXTURES.magic[(frameIdx + 1) % 5];
    impMat.uniforms.tDiffuse.value = VFX_TEXTURES.magic[(frameIdx + 2) % 5];

    let oi = 0; let gi = 0; let ci = 0; let ii = 0;

    const RARITY_SCALE = { common: 0.8, elite: 1.1, epic: 1.3, legendary: 1.6 };
    const RARITY_GLOW = { common: 2.0, elite: 4.5, epic: 8.0, legendary: 18.0 };

    for (let i = 0; i < spells.length; i++) {
      const s = spells[i];
      if (!s || !s.active || s.isBullet) continue;

      const r = s.rarity || 'common';
      const rScale = (RARITY_SCALE as any)[r] || 1.0;
      const rGlow = (RARITY_GLOW as any)[r] || 4.0;

      // Cache target index
      if (s.targetId && unitRegistry.current) {
        const tIdx = (s as any)._tIdx ??= parseInt(s.targetId.replace(/\D/g, '')) || 0;
        const tar = unitRegistry.current[tIdx];
        if (tar?.isActive && tar.id === s.targetId) {
          s.toX = tar.position[0]; s.toY = tar.position[1] + 1.2; s.toZ = tar.position[2];
        }
      }

      if ((s as any)._charged !== s.startTime) {
        (s as any)._charged = s.startTime;
        const eIdx = impactIdx.current;
        const e = impacts.current[eIdx];
        if (!e.active) activeImpacts.current.push(eIdx);
        impactIdx.current = (impactIdx.current + 1) % impacts.current.length;
        e.x = s.fromX; e.y = 0.1; e.z = s.fromZ; e.startTime = simNow; e.color = s.color || '#fff'; e.active = true; e.type = 'charge'; e.rot = Math.random() * 7;
        (e as any).rScale = rScale; (e as any).rGlow = rGlow;
      }

      const dur = s.isMeteor ? (600 + Math.random() * 400) : (MAGE_PROJECTILE_TIME_MS || 450);
      const t = Math.min(1, (simNow - s.startTime) / dur);
      if (t < 0) continue; // Waiting for randomized start time
      
      let px, py, pz;
      if (s.isMeteor) {
        px = s.fromX + (s.toX - s.fromX) * t; // Slight diagonal fall
        pz = s.fromZ + (s.toZ - s.fromZ) * t;
        py = s.fromY - (s.fromY - s.toY) * Math.pow(t, 1.5); 
      } else {
        px = s.fromX + (s.toX - s.fromX) * t;
        pz = s.fromZ + (s.toZ - s.fromZ) * t;
        py = s.fromY + (s.toY - s.fromY) * t + Math.sin(t * Math.PI) * 2.0;
      }

      if (oi < MAX_ORB_INSTANCES) {
        _obj.position.set(px, py, pz);
        // Icy Shard Visual (Spiky/Elongated)
        const headScale = s.isMeteor ? (0.6 * rScale) : (0.8 * rScale);
        _obj.scale.set(headScale * 0.5, headScale * 1.5, headScale * 0.5); 
        _obj.rotation.set(Math.PI / 4, 0, time * 5.0);
        _obj.updateMatrix();
        mesh.setMatrixAt(oi, _obj.matrix);
        
        const teamCol = new THREE.Color(s.color || '#44aaff');
        _c.copy(teamCol).multiplyScalar(rGlow * (s.isMeteor ? 2.5 : 1.0));
        mesh.setColorAt(oi, _c);
        oi++;

        // Ice Crystals (Embers)
        if (s.isMeteor && t > 0.1 && t < 0.9) {
          const particleCount = 2;
          for (let k = 0; k < particleCount; k++) {
            const eIdx = impactIdx.current;
            const e = impacts.current[eIdx];
            if (!e.active) activeImpacts.current.push(eIdx);
            impactIdx.current = (impactIdx.current + 1) % impacts.current.length;
            e.x = px + (Math.random() - 0.5) * 1.0;
            e.y = py + (Math.random() - 0.5) * 1.0;
            e.z = pz + (Math.random() - 0.5) * 1.0;
            e.startTime = simNow - Math.random() * 100;
            e.color = '#ffffff'; // White ice crystals
            e.active = true;
            e.type = 'embers' as any;
            e.rot = Math.random() * 7;
            (e as any).rScale = 0.3 * rScale;
            (e as any).rGlow = rGlow * 0.5;
          }
        }
      }

      if (gi < 60) {
        _obj.position.set(px, 0.12, pz);
        _obj.rotation.set(-Math.PI / 2, 0, time * 2.0);
        _obj.scale.setScalar(s.isMeteor ? (2.0 * rScale * t) : (1.2 * (1.1 - t) * rScale));
        _obj.updateMatrix();
        grd.setMatrixAt(gi, _obj.matrix);
        _c.set(s.color || '#fff').multiplyScalar(1.2 * rScale);
        grd.setColorAt(gi, _c);
        gi++;
      }

      if (t >= 0.99) {
        const eIdx = impactIdx.current;
        const e = impacts.current[eIdx];
        if (!e.active) activeImpacts.current.push(eIdx);
        impactIdx.current = (impactIdx.current + 1) % impacts.current.length;
        e.x = s.toX; e.y = 1.2; e.z = s.toZ; e.startTime = simNow;
        e.color = s.color || '#00ffff'; 
        e.active = true; e.type = 'sigil'; e.rot = Math.random() * 7;
        (e as any).rScale = rScale * (s.isMeteor ? 1.2 : 1.0); 
        (e as any).rGlow = rGlow * (s.isMeteor ? 2.0 : 1.0);
        s.active = false;
      }
    }

    mesh.count = oi;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    grd.count = gi;
    grd.instanceMatrix.needsUpdate = true;
    if (grd.instanceColor) grd.instanceColor.needsUpdate = true;
    (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    (grd.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    (crg.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    (imp.material as THREE.ShaderMaterial).uniforms.uTime.value = time;

    const currentImpacts = activeImpacts.current;
    for (let j = currentImpacts.length - 1; j >= 0; j--) {
      const idx = currentImpacts[j];
      const e = impacts.current[idx];
      if (!e.active) { currentImpacts.splice(j, 1); continue; }
      
      const age = simNow - e.startTime;
      const erScale = (e as any).rScale || 1.0;
      const erGlow = (e as any).rGlow || 4.0;

      if (e.type === 'charge') {
        const t = age / 400;
        if (t >= 1) { e.active = false; currentImpacts.splice(j, 1); continue; }
        if (ci < 80) {
          _obj.position.set(e.x, 0.1, e.z);
          _obj.rotation.set(-Math.PI / 2, 0, time * 5.0);
          _obj.scale.setScalar((0.5 + t * 2.5) * (1.0 - t) * erScale);
          _obj.updateMatrix();
          crg.setMatrixAt(ci, _obj.matrix);
          _c.set(e.color).multiplyScalar(erGlow * (1.0 - t));
          crg.setColorAt(ci, _c);
          ci++;
        }
      } else if ((e.type as any) === 'embers') {
        const t = age / 600;
        if (t >= 1) { e.active = false; currentImpacts.splice(j, 1); continue; }
        if (ii < 120) {
          const fade = 1.0 - t;
          _obj.position.set(e.x, e.y, e.z);
          _obj.quaternion.copy(state.camera.quaternion);
          _obj.scale.setScalar(erScale * fade);
          _obj.updateMatrix();
          imp.setMatrixAt(ii, _obj.matrix);
          _c.set(e.color).multiplyScalar(erGlow * fade * 5.0);
          imp.setColorAt(ii, _c);
          ii++;
        }
      } else {
        const t = age / 500;
        if (t >= 1) { e.active = false; currentImpacts.splice(j, 1); continue; }
        if (ii < 120) {
          const easeOut = Math.sqrt(t);
          const fade = 1.0 - t;
          _obj.position.set(e.x, 0.15, e.z);
          _obj.rotation.set(-Math.PI / 2, 0, e.rot + time * 2.0);
          _obj.scale.setScalar((2.0 + easeOut * 8.0) * erScale);
          _obj.updateMatrix();
          imp.setMatrixAt(ii, _obj.matrix);
          _c.set(e.color).multiplyScalar(erGlow * fade * 2.0);
          imp.setColorAt(ii, _c);
          ii++;
        }
      }
    }
    imp.count = ii;
    imp.instanceMatrix.needsUpdate = true;
    if (imp.instanceColor) imp.instanceColor.needsUpdate = true;
    crg.count = ci;
    crg.instanceMatrix.needsUpdate = true;
    if (crg.instanceColor) crg.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[quadGeo, orbMat, MAX_ORB_INSTANCES]} frustumCulled={false} />
      <instancedMesh ref={groundRef} args={[quadGeo, bottomMat, 60]} frustumCulled={false} />
      <instancedMesh ref={chargeRef} args={[quadGeo, bottomMat, 80]} frustumCulled={false} />
      <instancedMesh ref={impactRef} args={[quadGeo, impMat, 120]} frustumCulled={false} />
    </group>
  );
}
