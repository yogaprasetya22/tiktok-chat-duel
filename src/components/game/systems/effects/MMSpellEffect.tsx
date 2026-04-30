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

// ─── Material: Peluru biasa (Marksman basic attack) ──────────────────────────
const SuperBulletMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex }, uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        varying vec3 vColor;
        void main() {
            vUv = uv; vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            float pulse = 0.8 + 0.2 * sin(uTime * 30.0 + vUv.x * 5.0);
            vec3 core = mix(vColor * 15.0, vec3(20.0), (1.0 - vUv.x) * pulse);
            gl_FragColor = vec4(core * tex.rgb * 5.0, tex.a);
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

// ─── Material: Inti peluru sniper (silinder panjang, bersinar) ───────────────
const SniperCoreMat = () => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        void main() {
            vUv = uv; vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform float uTime;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            // vUv.y: 0=bottom, 1=top  |  Along cylinder axis = vUv.x
            float radial = 1.0 - smoothstep(0.0, 0.5, abs(vUv.y - 0.5));
            // ujung depan peluru lebih terang
            float nose   = smoothstep(0.3, 1.0, vUv.x);
            float body   = radial;
            float pulse  = 0.92 + 0.08 * sin(uTime * 40.0);

            // Warna: tim color di badan, putih-panas di ujung
            vec3 col = mix(vColor * 4.0, vec3(10.0, 10.0, 8.0), nose);
            float alpha = body * pulse;

            gl_FragColor = vec4(col, alpha);
            if (alpha < 0.05) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

// ─── Material: Jejak/lesatan energi di belakang peluru sniper ────────────────
const SniperTrailMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex }, uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        void main() {
            vUv = uv; vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            // vUv.x=0 = ujung ekor (transparan), vUv.x=1 = pangkal peluru (terang)
            float fade = vUv.x * vUv.x;
            // Shimmer bergerak ke arah ekor
            float shimmer = 0.7 + 0.3 * sin(vUv.x * 12.0 - uTime * 60.0);
            vec3 col = vColor * (2.5 + fade * 2.0) * shimmer;
            gl_FragColor = vec4(col * tex.rgb, tex.a * fade * 0.9);
            if (gl_FragColor.a < 0.01) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

// ─── Material: Aura bintang emas saat ulti aktif ─────────────────────────────
const EagleEyeMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex }, uTime: { value: 0 } },
    vertexShader: `
        varying vec2 vUv; varying vec3 vColor;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        void main() {
            vUv = uv; vColor = instanceColor;
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float uTime;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            float pulse = 0.5 + 0.5 * sin(uTime * 10.0);
            vec3 glow = vColor * (1.0 + pulse * 2.0);
            gl_FragColor = vec4(glow * tex.rgb * 5.0, tex.a * (0.8 + 0.2 * pulse));
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
});

// ─── Material: Impact spark & flash ──────────────────────────────────────────
const ImpactMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: tex } },
    vertexShader: `
        varying vec2 vUv;
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        varying vec3 vColor;
        void main() {
            vUv = uv; vColor = instanceColor;
            vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            float sc = length(vec3(instanceMatrix[0][0], instanceMatrix[0][1], instanceMatrix[0][2]));
            mvPosition.xy += position.xy * sc;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv; varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            gl_FragColor = vec4(vColor * tex.rgb * 8.0, tex.a);
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending,
});

// ─── Shared temp objects (zero allocation per frame) ─────────────────────────
const _obj   = new THREE.Object3D();
const _trObj = new THREE.Object3D();
const _from  = new THREE.Vector3();
const _to    = new THREE.Vector3();
const _dir   = new THREE.Vector3();
const _trPos = new THREE.Vector3();
const _lerp  = new THREE.Color(); // scratch for lerp inside hit loop — avoids new THREE.Color()

interface VFXEntry {
    x:number; y:number; z:number;
    startTime:number; color:string;
    active:boolean; scale:number;
    type: 'flash' | 'hit' | 'dust';
    rot: number;
}

export function MMSpellEffect({ spellsRef, unitRegistry, simTimeRef }: Props) {
  // ── Refs ──────────────────────────────────────────────────────────────────
  const meshRef        = useRef<THREE.InstancedMesh>(null!); // basic bullets
  const SniperCoreRef  = useRef<THREE.InstancedMesh>(null!); // sniper bullet core
  const SniperTrailRef = useRef<THREE.InstancedMesh>(null!); // sniper trail streak
  const FlashRef       = useRef<THREE.InstancedMesh>(null!);
  const HitRef         = useRef<THREE.InstancedMesh>(null!);
  const DustRef        = useRef<THREE.InstancedMesh>(null!);
  const AuraRef        = useRef<THREE.InstancedMesh>(null!);

  const ringIdx   = useRef(0);
  const vfxPool   = useRef<VFXEntry[]>(
      Array.from({ length: 400 }, () => ({ x:0,y:0,z:0, startTime:0, color:'#fff', active:false, scale:1, type: 'flash', rot: 0 }))
  );
  const activeVfx = useRef<number[]>([]);
  const _col      = useMemo(() => new THREE.Color(), []);

  // ── Geometri ──────────────────────────────────────────────────────────────
  // Peluru biasa
  const bulletGeo  = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  // Inti peluru sniper: CylinderGeometry memanjang sepanjang Y, kita rotate via instanceMatrix
  const coreGeo    = useMemo(() => {
      // Membuat capsule tipis memanjang: radius kecil, height = 1 (akan di-scale)
      const g = new THREE.CylinderGeometry(0.5, 0.3, 1, 8, 1);
      // Putar agar sumbu panjangnya = Z (arah terbang), karena lookAt() mengarahkan Z ke target
      g.rotateX(Math.PI / 2);
      return g;
  }, []);
  // Trail: plane yang akan di-scale panjang
  const trailGeo   = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
  const quadGeo    = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  // ── Material ──────────────────────────────────────────────────────────────
  const bulletMat  = useMemo(() => SuperBulletMat(VFX_TEXTURES.bullet), []);
  const coreMat    = useMemo(() => SniperCoreMat(), []);
  const trailMat   = useMemo(() => SniperTrailMat(VFX_TEXTURES.bullet), []);
  const flashMat   = useMemo(() => ImpactMat(VFX_TEXTURES.muzzles[0]), []);
  const hitMat     = useMemo(() => ImpactMat(VFX_TEXTURES.sparks[0]), []);
  const dustMat    = useMemo(() => ImpactMat(VFX_TEXTURES.smoke), []);
  const auraMat    = useMemo(() => EagleEyeMat(VFX_TEXTURES.star), []);

  useFrame((state) => {
    const mesh    = meshRef.current;
    const spells  = spellsRef?.current;
    const fMesh   = FlashRef.current;
    const hMesh   = HitRef.current;
    const dMesh   = DustRef.current;
    const aMesh   = AuraRef.current;
    const coreMesh  = SniperCoreRef.current;
    const trailMesh = SniperTrailRef.current;
    if (!mesh || !spells || !fMesh || !hMesh || !dMesh || !aMesh || !coreMesh || !trailMesh || !unitRegistry.current) return;

    const simNow = simTimeRef.current || 0;
    const time   = state.clock.elapsedTime;
    const units  = unitRegistry.current;

    const RARITY_SCALE = { common: 0.8, elite: 1.0, epic: 1.2, legendary: 1.4 };
    const RARITY_GLOW  = { common: 4.0, elite: 6.0, epic: 8.0, legendary: 12.0 };

    // ── Aura bintang emas di atas MM saat ulti ────────────────────────────
    // FIX: Only scan active units via sorted buckets instead of all 1500
    let an = 0;
    const sortedUnits = (state as any).sortedActiveUnits;
    const activeUnitList = sortedUnits || units;
    const auraLimit = sortedUnits ? activeUnitList.length : units.length;
    for (let i = 0; i < auraLimit; i++) {
        const u = activeUnitList[i];
        if (u.isActive && u.unitClass === 'marksman' && u.isBuffed) {
            if (an < 50) {
                _obj.position.set(u.position[0], u.position[1] + 2.5, u.position[2]);
                _obj.rotation.set(0, 0, time * 2.5);
                _obj.scale.setScalar(1.5);
                _obj.updateMatrix();
                aMesh.setMatrixAt(an, _obj.matrix);
                _col.set('#ffd700').multiplyScalar(5.0);
                aMesh.setColorAt(an, _col);
                an++;
            }
        }
        // Dust trail saat marksman dash/roll
        if (u.isActive && u.unitClass === 'marksman' && u.isRolling) {
            if (Math.random() > 0.4) {
                const vIdx = ringIdx.current;
                const v = vfxPool.current[vIdx];
                if (!v.active) activeVfx.current.push(vIdx);
                ringIdx.current = (ringIdx.current + 1) % vfxPool.current.length;
                v.x = u.position[0] + (Math.random()-0.5); v.y = 0.2; v.z = u.position[2] + (Math.random()-0.5);
                v.startTime = simNow; v.color = '#fff'; v.active = true; v.scale = 1.8; v.type = 'dust'; v.rot = Math.random()*7;
            }
        }
    }
    aMesh.count = an;
    aMesh.instanceMatrix.needsUpdate = true;
    if (aMesh.instanceColor) aMesh.instanceColor.needsUpdate = true;

    // Animasi spark flipbook
    const sIdx = Math.floor(time * 15) % 5;
    hitMat.uniforms.tDiffuse.value = VFX_TEXTURES.sparks[sIdx];

    // ── Render semua peluru ───────────────────────────────────────────────
    let n = 0; // basic bullet count
    let sn = 0; // sniper core count
    let tn = 0; // sniper trail count

    for (let i = 0; i < spells.length; i++) {
        const s = spells[i];
        if (!s || !s.active || !s.isBullet) continue;

        const r      = s.rarity || 'common';
        const rScale = (RARITY_SCALE as any)[r] || 1.0;
        const rGlow  = (RARITY_GLOW  as any)[r] || 6.0;
        const isSniper = (s as any).isSniper;

        // Track target yang bergerak
        const targetPoolIdx = (s as any).targetPoolIdx;
        if (targetPoolIdx !== undefined && unitRegistry.current) {
          const tar = unitRegistry.current[targetPoolIdx];
          if (tar?.isActive && tar.id === s.targetId) {
            s.toX = tar.position[0]; s.toY = tar.position[1] + 1.2; s.toZ = tar.position[2];
          }
        }
        
        // --- Velocity-Based Movement (Fixes 'stuttering' when target moves) ---
        const speed = isSniper ? ((s as any).sniperSpeed || 55.0) : ((s as any).bulletSpeed || 110.0);
        
        // Initialize current position if not set
        if ((s as any).curX === undefined) {
          (s as any).curX = s.fromX;
          (s as any).curY = s.fromY;
          (s as any).curZ = s.fromZ;
          (s as any).lastSimTime = s.startTime;
        }

        // Calculate time delta since last update (simulated time)
        const dt = (simNow - (s as any).lastSimTime) / 1000;
        (s as any).lastSimTime = simNow;

        if (dt > 0) {
          _from.set((s as any).curX, (s as any).curY, (s as any).curZ);
          _to.set(s.toX, s.toY, s.toZ);
          
          _dir.subVectors(_to, _from).normalize();
          const step = speed * dt;
          const distToTarget = _from.distanceTo(_to);

          if (step >= distToTarget) {
            (s as any).curX = s.toX; (s as any).curY = s.toY; (s as any).curZ = s.toZ;
            (s as any).isHit = true;
          } else {
            _from.addScaledVector(_dir, step);
            (s as any).curX = _from.x; (s as any).curY = _from.y; (s as any).curZ = _from.z;
          }
        }

        _obj.position.set((s as any).curX, (s as any).curY, (s as any).curZ);
        _obj.lookAt(s.toX, s.toY, s.toZ); 

        const isFinisher = (s as any).isFinisher;

        if (isSniper) {
            // ── Inti peluru sniper: silinder tipis memanjang ──────────────
            // Regular: (0.18, 0.18, 2.5)  |  Finisher: (0.28, 0.28, 4.0)
            const bW = isFinisher ? 0.28 * rScale : 0.18 * rScale;
            const bL = isFinisher ? 4.5  * rScale : 2.8  * rScale;
            _obj.scale.set(bW, bW, bL);
            _obj.updateMatrix();
            coreMesh.setMatrixAt(sn, _obj.matrix);
            _col.set(s.color || '#ffffff').multiplyScalar(isFinisher ? 12.0 : 8.0);
            coreMesh.setColorAt(sn, _col);
            sn++;

            // ── Jejak/lesatan di belakang peluru ──────────────────────────
            if (tn < 200) {
                // Panjang trail tumbuh seiring progress
                // Trail growth factor
                const growth = Math.min(1, (simNow - s.startTime) / 200);
                const trailLen = (isFinisher ? 14.0 : 7.0) * rScale * (0.3 + growth * 0.7);
                const trailW   = isFinisher ? 0.18 * rScale : 0.1 * rScale;

                // Arah terbang: dari _from ke _to
                _dir.subVectors(_to, _from).normalize();
                // Posisi trail: tengah antara ujung ekor dan posisi peluru
                _trPos.copy(_obj.position).addScaledVector(_dir, -trailLen * 0.5);

                _trObj.position.copy(_trPos);
                _trObj.lookAt(_to); // sama arahnya
                _trObj.scale.set(trailW, trailW, trailLen);
                _trObj.updateMatrix();
                trailMesh.setMatrixAt(tn, _trObj.matrix);
                _col.set(s.color || '#88ccff').multiplyScalar(isFinisher ? 6.0 : 3.5);
                trailMesh.setColorAt(tn, _col);
                tn++;
            }
        } else {
            // Peluru basic attack biasa
            _obj.scale.set(0.6 * rScale, 0.6 * rScale, 7.0 * rScale);
            _obj.updateMatrix();
            mesh.setMatrixAt(n, _obj.matrix);
            _col.set(s.color || '#fff').multiplyScalar(rGlow);
            mesh.setColorAt(n, _col);
            n++;
        }

        // ── Impact explosion saat sampai di target ────────────────────────
        if ((s as any).isHit) {
            const vIdx = ringIdx.current;
            const v = vfxPool.current[vIdx];
            if (!v.active) activeVfx.current.push(vIdx);
            ringIdx.current = (ringIdx.current + 1) % vfxPool.current.length;
            v.x = s.toX; v.y = s.toY; v.z = s.toZ;
            v.startTime = simNow; v.color = s.color || '#fff';
            v.active = true;
            v.scale = isFinisher ? 8.0 : 3.5;
            v.type = 'hit'; v.rot = Math.random() * 7;
            (v as any).rScale = rScale * (isFinisher ? 2.0 : 1.0);
            (v as any).rGlow  = rGlow  * (isFinisher ? 2.5 : 1.0);
            
            // CLEANUP for pool reuse
            s.active = false;
            (s as any).isHit = false;
            (s as any).curX = undefined;
            (s as any).lastSimTime = undefined;
            (s as any)._tIdx = undefined;
        }
    }

    // Commit semua mesh
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    coreMesh.count = sn;
    coreMesh.instanceMatrix.needsUpdate = true;
    if (coreMesh.instanceColor) coreMesh.instanceColor.needsUpdate = true;

    trailMesh.count = tn;
    trailMesh.instanceMatrix.needsUpdate = true;
    if (trailMesh.instanceColor) trailMesh.instanceColor.needsUpdate = true;

    // Update time uniforms
    (mesh.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    coreMat.uniforms.uTime.value  = time;
    trailMat.uniforms.uTime.value = time;
    auraMat.uniforms.uTime.value  = time;

    // ── VFX pool: flash, dust, hit ────────────────────────────────────────
    let fn = 0; let hn = 0; let dn = 0;
    const currentVfx = activeVfx.current;
    let writeVfx = 0; // FIX: swap-remove instead of splice O(n²)
    for (let j = 0; j < currentVfx.length; j++) {
        const idx = currentVfx[j];
        const v = vfxPool.current[idx];
        if (!v.active) continue; // skip dead, don't copy to output

        const age    = simNow - v.startTime;
        const vrScale = (v as any).rScale || 1.0;
        const vrGlow  = (v as any).rGlow  || 6.0;

        if (v.type === 'flash') {
            const ft = age / 120;
            if (ft >= 1) { v.active = false; continue; }
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
            if (dt >= 1) { v.active = false; continue; }
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
        } else { // 'hit'
            const ht = age / 280;
            if (ht >= 1) { v.active = false; continue; }
            if (hn < 200) {
                _obj.position.set(v.x, v.y, v.z);
                _obj.rotation.set(0, 0, v.rot + time * 5.0);
                const sc = v.scale * (1.1 + ht * 5.0) * (1.0 - ht) * vrScale;
                _obj.scale.setScalar(sc);
                _obj.updateMatrix();
                hMesh.setMatrixAt(hn, _obj.matrix);
                _col.set('#fff').lerp(_lerp.set(v.color), ht).multiplyScalar(vrGlow * 1.5 * (1.0 - ht));
                hMesh.setColorAt(hn, _col);
                hn++;
            }
        }
        currentVfx[writeVfx++] = currentVfx[j]; // keep alive
    }
    currentVfx.length = writeVfx; // trim dead entries in-place (zero allocation)
    fMesh.count = fn; fMesh.instanceMatrix.needsUpdate = true; if (fMesh.instanceColor) fMesh.instanceColor.needsUpdate = true;
    hMesh.count = hn; hMesh.instanceMatrix.needsUpdate = true; if (hMesh.instanceColor) hMesh.instanceColor.needsUpdate = true;
    dMesh.count = dn; dMesh.instanceMatrix.needsUpdate = true; if (dMesh.instanceColor) dMesh.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Basic marksman bullets */}
      <instancedMesh ref={meshRef} args={[bulletGeo, bulletMat, MAX_BULLETS]} frustumCulled={false} />
      {/* Sniper bullet core — silinder tipis memanjang */}
      <instancedMesh ref={SniperCoreRef} args={[coreGeo, coreMat, 200]} frustumCulled={false} />
      {/* Sniper bullet trail — lesatan energi */}
      <instancedMesh ref={SniperTrailRef} args={[trailGeo, trailMat, 200]} frustumCulled={false} />
      {/* VFX */}
      <instancedMesh ref={FlashRef} args={[quadGeo, flashMat, 100]} frustumCulled={false} visible={false} />
      <instancedMesh ref={HitRef}  args={[quadGeo, hitMat,   200]} frustumCulled={false} />
      <instancedMesh ref={DustRef} args={[quadGeo, dustMat,  100]} frustumCulled={false} />
      <instancedMesh ref={AuraRef} args={[quadGeo, auraMat,   50]} frustumCulled={false} />
    </group>
  );
}
