'use client';
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { SpellsRegistryRef } from './MageSpellEffect';
import { UnitRuntimeData } from "@/src/core/domain/unit.types";
import { VFX_TEXTURES } from './VFXAssets';

interface Props {
  spellsRef: SpellsRegistryRef;
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  simTimeRef: React.RefObject<number>;
}

const MAX_BULLETS = 600;

const SuperBulletMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
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
            float pulse = 0.8 + 0.2 * sin(uTime * 30.0 + vUv.x * 5.0);
            vec3 core = mix(vColor * 8.0, vec3(2.0), (1.0 - vUv.x) * pulse);
            gl_FragColor = vec4(core * tex.rgb, tex.a);
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
});

const EagleEyeMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex }, uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
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
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            float pulse = 0.5 + 0.5 * sin(uTime * 10.0);
            vec3 glow = vColor * (1.0 + pulse * 2.0);
            gl_FragColor = vec4(glow * tex.rgb * 5.0, tex.a * (0.8 + 0.2 * pulse));
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const ImpactMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex } },
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
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            gl_FragColor = vec4(vColor * tex.rgb * 8.0, tex.a);
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const _obj  = new THREE.Object3D();
const _from = new THREE.Vector3();
const _to   = new THREE.Vector3();

interface VFXEntry { x:number; y:number; z:number; startTime:number; color:string; active:boolean; scale:number; type: 'flash' | 'hit' | 'dust'; rot: number; }

export function MMSpellEffect({ spellsRef, unitRegistry, simTimeRef }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const FlashRef = useRef<THREE.InstancedMesh>(null!);
  const HitRef = useRef<THREE.InstancedMesh>(null!);
  const DustRef = useRef<THREE.InstancedMesh>(null!);
  const AuraRef = useRef<THREE.InstancedMesh>(null!);
  
  const ringIdx = useRef(0);
  const vfxPool = useRef<VFXEntry[]>(Array.from({ length: 400 }, () => ({ x:0,y:0,z:0, startTime:0, color:'#fff', active:false, scale:1, type: 'flash', rot: 0 })));
  const activeVfx = useRef<number[]>([]);
  const _col = useMemo(() => new THREE.Color(), []);

  const quadGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const bulletGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateY(Math.PI / 2);
    return geo;
  }, []);

  const bulletMat = useMemo(() => SuperBulletMat(VFX_TEXTURES.bullet), []);
  const flashMat = useMemo(() => ImpactMat(VFX_TEXTURES.muzzles[0]), []);
  const hitMat = useMemo(() => ImpactMat(VFX_TEXTURES.sparks[0]), []);
  const dustMat = useMemo(() => ImpactMat(VFX_TEXTURES.smoke), []);
  const auraMat = useMemo(() => EagleEyeMat(VFX_TEXTURES.star), []);

  useFrame((state) => {
    const mesh = meshRef.current;
    const spells = spellsRef?.current;
    const fMesh = FlashRef.current;
    const hMesh = HitRef.current;
    const dMesh = DustRef.current;
    const aMesh = AuraRef.current;
    if (!mesh || !spells || !fMesh || !hMesh || !dMesh || !aMesh || !unitRegistry.current) return;

    const simNow = simTimeRef.current || 0;
    const time = state.clock.elapsedTime;
    const units = unitRegistry.current;

    const RARITY_SCALE = { common: 0.8, elite: 1.0, epic: 1.2, legendary: 1.4 };
    const RARITY_GLOW = { common: 4.0, elite: 6.0, epic: 8.0, legendary: 12.0 };

    // Update Aura for buffed units
    let an = 0;
    for (let i = 0; i < units.length; i++) {
        const u = units[i];
        if (u.isActive && u.unitClass === 'marksman' && u.isBuffed) {
            if (an < 50) {
                _obj.position.set(u.position[0], u.position[1] + 2.5, u.position[2]);
                _obj.rotation.set(0, 0, time * 2.5);
                _obj.scale.setScalar(1.5); // Slightly larger for visibility
                _obj.updateMatrix();
                aMesh.setMatrixAt(an, _obj.matrix);
                _col.set('#ffd700').multiplyScalar(5.0);
                aMesh.setColorAt(an, _col);
                an++;
            }
        }
        // Spawn Dust & Flash for rolling (blinking) units
        if (u.isActive && u.unitClass === 'marksman' && u.isRolling) {
            if (Math.random() > 0.4) { // Increased density
                const vIdx = ringIdx.current;
                const v = vfxPool.current[vIdx];
                if (!v.active) activeVfx.current.push(vIdx);
                ringIdx.current = (ringIdx.current + 1) % vfxPool.current.length;
                v.x = u.position[0] + (Math.random()-0.5); v.y = 0.2; v.z = u.position[2] + (Math.random()-0.5); 
                v.startTime = simNow; v.color = '#fff'; v.active = true; v.scale = 1.8; v.type = 'dust'; v.rot = Math.random()*7;
            }
            // Add a periodic flash while rolling/blinking
            if (Math.random() > 0.92) {
                const fIdx = ringIdx.current;
                const f = vfxPool.current[fIdx];
                if (!f.active) activeVfx.current.push(fIdx);
                ringIdx.current = (ringIdx.current + 1) % vfxPool.current.length;
                f.x = u.position[0]; f.y = 1.2; f.z = u.position[2]; f.startTime = simNow; f.color = '#fff'; f.active = true; f.scale = 3.0; f.type = 'flash'; f.rot = 0;
            }
        }
    }
    aMesh.count = an;
    aMesh.instanceMatrix.needsUpdate = true;
    if (aMesh.instanceColor) aMesh.instanceColor.needsUpdate = true;

    // Animation: Muzzle & Spark flipbooks
    const fIdx = Math.floor(time * 24) % 5;
    flashMat.uniforms.tDiffuse.value = VFX_TEXTURES.muzzles[fIdx];
    const sIdx = Math.floor(time * 15) % 5;
    hitMat.uniforms.tDiffuse.value = VFX_TEXTURES.sparks[sIdx];

    let n = 0;
    for (let i = 0; i < spells.length; i++) {
        const s = spells[i];
        if (!s || !s.active || !s.isBullet) continue;
        
        const r = s.rarity || 'common';
        const rScale = (RARITY_SCALE as any)[r] || 1.0;
        const rGlow = (RARITY_GLOW as any)[r] || 6.0;

        if (s.targetId && unitRegistry.current) {
          const tIdx = (s as any)._tIdx ??= parseInt(s.targetId.replace(/\D/g, '')) || 0;
          const tar = unitRegistry.current[tIdx];
          if (tar?.isActive && tar.id === s.targetId) {
            s.toX = tar.position[0]; s.toY = tar.position[1] + 1.2; s.toZ = tar.position[2];
          }
        }
        _from.set(s.fromX, s.fromY, s.fromZ);
        _to.set(s.toX, s.toY, s.toZ);
        
        const dist = _from.distanceTo(_to);
        const ratio = Math.min(1, (simNow - s.startTime) / ((dist / 85.0) * 1000)); 
        const t = Math.pow(ratio, 1.25);

        if (ratio < 0.05 && (s as any)._f !== s.startTime) {
            (s as any)._f = s.startTime;
            const vIdx = ringIdx.current;
            const v = vfxPool.current[vIdx];
            if (!v.active) activeVfx.current.push(vIdx);
            ringIdx.current = (ringIdx.current + 1) % vfxPool.current.length;
            v.x = s.fromX; v.y = s.fromY; v.z = s.fromZ; v.startTime = simNow; v.color = s.color || '#fff'; v.active = true; v.scale = 2.0; v.type = 'flash'; v.rot = Math.random()*7;
            (v as any).rScale = rScale; (v as any).rGlow = rGlow;
        }
        
        if (n < MAX_BULLETS) {
            _obj.position.copy(_from).lerp(_to, t);
            _obj.lookAt(_to);
            _obj.scale.set(0.8 * rScale, 0.8 * rScale, 7.0 * rScale); 
            _obj.updateMatrix();
            mesh.setMatrixAt(n, _obj.matrix);
            _col.set(s.color || '#fff').multiplyScalar(rGlow);
            mesh.setColorAt(n, _col);
            n++;
        }

        if (ratio >= 0.99) { 
            const vIdx = ringIdx.current;
            const v = vfxPool.current[vIdx];
            if (!v.active) activeVfx.current.push(vIdx);
            ringIdx.current = (ringIdx.current + 1) % vfxPool.current.length;
            v.x = s.toX; v.y = s.toY; v.z = s.toZ; v.startTime = simNow; v.color = s.color || '#fff'; v.active = true; v.scale = 2.2; v.type = 'hit'; v.rot = Math.random()*7; 
            (v as any).rScale = rScale; (v as any).rGlow = rGlow;
            s.active = false; 
            (s as any)._tIdx = undefined;
        }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;

    let fn = 0; let hn = 0; let dn = 0;
    const currentVfx = activeVfx.current;
    for (let j = currentVfx.length - 1; j >= 0; j--) {
        const idx = currentVfx[j];
        const v = vfxPool.current[idx];
        if (!v.active) { currentVfx.splice(j, 1); continue; }
        
        const age = simNow - v.startTime;
        const vrScale = (v as any).rScale || 1.0;
        const vrGlow = (v as any).rGlow || 6.0;

        if (v.type === 'flash') {
            const ft = age / 120;
            if (ft >= 1) { v.active = false; currentVfx.splice(j, 1); continue; }
            if (fn < 100) {
              _obj.position.set(v.x, v.y, v.z);
              _obj.scale.setScalar(v.scale * (1.1 - ft) * 2.5 * vrScale);
              _obj.updateMatrix();
              fMesh.setMatrixAt(fn, _obj.matrix);
              _col.set(v.color).multiplyScalar(vrGlow * (1.0 - ft));
              fMesh.setColorAt(fn, _col);
              fn++;
            }
        } else if (v.type === 'dust') {
            const dt = age / 400;
            if (dt >= 1) { v.active = false; currentVfx.splice(j, 1); continue; }
            if (dn < 100) {
              _obj.position.set(v.x, v.y, v.z);
              _obj.rotation.set(-Math.PI/2, 0, v.rot);
              _obj.scale.setScalar(v.scale * (0.5 + dt * 2.0) * (1.0 - dt));
              _obj.updateMatrix();
              dMesh.setMatrixAt(dn, _obj.matrix);
              _col.set('#fff').multiplyScalar(2.0 * (1.0-dt));
              dMesh.setColorAt(dn, _col);
              dn++;
            }
        } else {
            const ht = age / 250; 
            if (ht >= 1) { v.active = false; currentVfx.splice(j, 1); continue; }
            if (hn < 200) {
              _obj.position.set(v.x, v.y, v.z);
              _obj.rotation.set(0, 0, v.rot + time * 5.0);
              const sc = v.scale * (1.1 + ht * 5.0) * (1.0 - ht) * vrScale;
              _obj.scale.setScalar(sc);
              _obj.updateMatrix();
              hMesh.setMatrixAt(hn, _obj.matrix);
              _col.set('#fff').lerp(new THREE.Color(v.color), ht).multiplyScalar(vrGlow * 1.5 * (1.0 - ht));
              hMesh.setColorAt(hn, _col);
              hn++;
            }
        }
    }
    fMesh.count = fn;
    fMesh.instanceMatrix.needsUpdate = true;
    if (fMesh.instanceColor) fMesh.instanceColor.needsUpdate = true;
    hMesh.count = hn;
    hMesh.instanceMatrix.needsUpdate = true;
    if (hMesh.instanceColor) hMesh.instanceColor.needsUpdate = true;
    dMesh.count = dn;
    dMesh.instanceMatrix.needsUpdate = true;
    if (dMesh.instanceColor) dMesh.instanceColor.needsUpdate = true;

    auraMat.uniforms.uTime.value = time;
  });

  return (
    <group>
      <instancedMesh ref={meshRef} args={[bulletGeo, bulletMat, MAX_BULLETS]} frustumCulled={false} />
      <instancedMesh ref={FlashRef} args={[quadGeo, flashMat, 100]} frustumCulled={false} />
      <instancedMesh ref={HitRef} args={[quadGeo, hitMat, 200]} frustumCulled={false} />
      <instancedMesh ref={DustRef} args={[quadGeo, dustMat, 100]} frustumCulled={false} />
      <instancedMesh ref={AuraRef} args={[quadGeo, auraMat, 50]} frustumCulled={false} />
    </group>
  );
}
