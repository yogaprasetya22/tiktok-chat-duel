'use client';
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { VFX_TEXTURES } from './VFXAssets';

const MAX_WAVES = 150;
const MAX_DEBRIS = 200;
const MAX_RINGS = 50;

/**
 * INNOVATION: Magma Fissure Shader
 * Deep glowing magma cracks with a heated pulse.
 */
const MagmaFissureMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
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

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
        float noise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f*f*(3.0-2.0*f);
            return mix(mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),
                       mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x), u.y);
        }

        void main() {
            vec2 centeredUv = vUv - 0.5;
            float dist = length(centeredUv);
            
            float n = noise(vUv * 12.0 + uTime * 0.1);
            float crack = smoothstep(0.47, 0.5, n) * smoothstep(0.53, 0.5, n);
            
            float pulse = 1.0 + 0.5 * sin(uTime * 8.0 + n * 10.0);
            vec3 core = vec3(1.0, 0.3, 0.0) * pulse; // Magma Glow
            vec3 glow = vColor * 2.5; 
            vec3 finalCol = mix(vec3(0.08, 0.04, 0.0), core + glow, crack);
            
            float alpha = smoothstep(0.5, 0.2, dist) * (crack * 3.0 + 0.15);
            gl_FragColor = vec4(finalCol, alpha);
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, 
});

const EnergyRingMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
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
            float dist = length(vUv - 0.5);
            float ring = smoothstep(0.48, 0.5, dist) * smoothstep(0.52, 0.5, dist);
            float pulse = 0.5 + 0.5 * sin(uTime * 15.0);
            gl_FragColor = vec4(vColor * pulse * 50.0, ring);
            if (ring < 0.01) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const HexShieldMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
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
            vec2 centeredUv = vUv - 0.5;
            float dist = length(centeredUv);
            
            // Hexagonal grid pulse
            vec2 gUv = vUv * 8.0;
            float grid = sin(gUv.x * 6.28 + uTime * 4.0) * sin(gUv.y * 6.28 + uTime * 4.0);
            grid = step(0.8, grid);
            
            float edge = smoothstep(0.4, 0.5, dist) * smoothstep(0.5, 0.45, dist);
            float dome = smoothstep(0.5, 0.0, dist);
            
            vec3 glow = vColor * (0.5 + grid * 2.0);
            gl_FragColor = vec4(glow, (edge * 2.0 + grid * 0.4) * dome);
            if (gl_FragColor.a < 0.01) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

const _obj = new THREE.Object3D();
const _col = new THREE.Color();

interface TankVFX { 
    x:number; y:number; z:number; startTime:number; color:string; active:boolean; 
    type: 'fissure' | 'debris' | 'ring' | 'shield'; 
    vx: number; vy: number; vz: number; 
    scale:number; rot?: number; 
}

export function TankSpellEffect({ tankSpellsRef, simTimeRef }: { tankSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const fissureRef = useRef<THREE.InstancedMesh>(null!);
    const debrisRef = useRef<THREE.InstancedMesh>(null!);
    const ringRef = useRef<THREE.InstancedMesh>(null!);
    const shieldRef = useRef<THREE.InstancedMesh>(null!);
    
    const vfxOrder = useRef(0);
    const pool = useRef<TankVFX[]>(Array.from({ length: 450 }, () => ({ 
        x:0, y:0, z:0, startTime:0, color:'#fff', active:false, type:'fissure', scale:1,
        vx:0, vy:0, vz:0
    })));
    const activeIndices = useRef<number[]>([]);
    
    const quadGeo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const fMat = useMemo(() => MagmaFissureMat(VFX_TEXTURES.shockwave), []);
    const dMat = useMemo(() => new THREE.MeshBasicMaterial({ map: VFX_TEXTURES.dirt, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
    const rMat = useMemo(() => EnergyRingMat(VFX_TEXTURES.shockwave), []);
    const sMat = useMemo(() => HexShieldMat(VFX_TEXTURES.shield), []);

    useFrame((state) => {
        if (!fissureRef.current || !tankSpellsRef.current || !debrisRef.current || !ringRef.current || !shieldRef.current) return;
        const spells = tankSpellsRef.current;
        const simTime = simTimeRef.current || 0;
        const time = state.clock.elapsedTime;

        const shIdx = Math.floor(time * 24) % 5;
        fMat.uniforms.tDiffuse.value = VFX_TEXTURES.shockwaves[shIdx];

        const RARITY_SCALE = { common: 0.8, elite: 1.1, epic: 1.3, legendary: 1.5 };
        const RARITY_COUNT = { common: 6, elite: 8, epic: 12, legendary: 15 };

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;
            
            const r = s.rarity || 'common';
            const rScale = (RARITY_SCALE as any)[r] || 1.0;
            const rCount = (RARITY_COUNT as any)[r] || 10;

            const age = simTime - s.startTime;
            const isShield = (s as any).isShield;
            const duration = isShield ? 3000 : 1000;
            if (age > duration) { s.active = false; continue; }

            if (age < 50 && (s as any)._lastVFX !== s.startTime) {
                (s as any)._lastVFX = s.startTime;
                
                // 1. Magma Tank Fissure (Scaled down)
                const p1 = pool.current[vfxOrder.current]; 
                if (!p1.active) activeIndices.current.push(vfxOrder.current);
                vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                p1.x = s.x; p1.y = 0.03; p1.z = s.z; p1.startTime = simTime; p1.color = '#FFAA00'; p1.active = true; p1.type = 'fissure'; p1.scale = 4.5 * rScale;
                
                // 2. Burning Stones
                const debrisCount = Math.floor(rCount * 1.5);
                for(let k=0; k<debrisCount; k++) {
                    const p2 = pool.current[vfxOrder.current];
                    if (!p2.active) activeIndices.current.push(vfxOrder.current);
                    vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                    p2.x = s.x; p2.y = 0.5; p2.z = s.z; p2.startTime = simTime; p2.color = s.color; p2.active = true; p2.type = 'debris';
                    p2.vx = (Math.random()-0.5)*14 * rScale;
                    p2.vy = 8 + Math.random()*15 * rScale;
                    p2.vz = (Math.random()-0.5)*14 * rScale;
                    p2.scale = (0.3 + Math.random() * 1.5) * rScale;
                }

                // 3. Energy Shockwave Ring (More focused)
                const p3 = pool.current[vfxOrder.current];
                if (!p3.active) activeIndices.current.push(vfxOrder.current);
                vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                p3.x = s.x; p3.y = 0.08; p3.z = s.z; p3.startTime = simTime; p3.color = s.color; p3.active = true; p3.type = 'ring'; p3.scale = 1.2 * rScale;

                // 4. Fortress Shield (Innovation)
                if (isShield) {
                    const p4 = pool.current[vfxOrder.current];
                    if (!p4.active) activeIndices.current.push(vfxOrder.current);
                    vfxOrder.current = (vfxOrder.current + 1) % pool.current.length;
                    p4.x = s.x; p4.y = 1.0; p4.z = s.z; p4.startTime = simTime; p4.color = '#00aaff'; p4.active = true; p4.type = 'shield'; p4.scale = 3.5 * rScale;
                }
            }
        }

        let fn = 0; let dn = 0; let rn = 0; let sn = 0;
        const currentActive = activeIndices.current;
        const energy = 12.0;

        for (let j = currentActive.length - 1; j >= 0; j--) {
            const idx = currentActive[j];
            const v = pool.current[idx];
            if (!v.active) { currentActive.splice(j, 1); continue; }
            const age = simTime - v.startTime;
            
            if (v.type === 'fissure') {
                const rt = age / 900; if (rt >= 1) { v.active = false; currentActive.splice(j, 1); continue; }
                if (fn < MAX_WAVES) {
                    const ease = 1.0 - rt;
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(-Math.PI/2, 0, 0);
                    _obj.scale.setScalar(v.scale * (1.1 + Math.sqrt(rt) * 0.7));
                    _obj.updateMatrix();
                    fissureRef.current.setMatrixAt(fn, _obj.matrix);
                    _col.set('#FF6600').lerp(new THREE.Color(v.color), 0.5).multiplyScalar(1.5 * ease);
                    fissureRef.current.setColorAt(fn, _col);
                    fn++;
                }
            } else if (v.type === 'debris') {
                const rt = age / 800; if (rt >= 1) { v.active = false; currentActive.splice(j, 1); continue; }
                if (dn < MAX_DEBRIS) {
                    const curAge = age * 0.001;
                    const px = v.x + v.vx * curAge;
                    const py = v.y + v.vy * curAge - 28.0 * 0.5 * curAge * curAge;
                    const pz = v.z + v.vz * curAge;
                    if (py < -3.0) { v.active = false; currentActive.splice(j, 1); continue; }
                    _obj.position.set(px, py, pz);
                    _obj.rotation.set(curAge * 15, curAge * 10, 0);
                    _obj.scale.setScalar(v.scale * (1.0 - rt * 0.3));
                    _obj.updateMatrix();
                    debrisRef.current.setMatrixAt(dn, _obj.matrix);
                    _col.set(v.color).multiplyScalar(8.0 * (1.0 - rt));
                    debrisRef.current.setColorAt(dn, _col);
                    dn++;
                }
            } else if (v.type === 'ring') {
                const rt = age / 350; if (rt >= 1) { v.active = false; currentActive.splice(j, 1); continue; }
                if (rn < MAX_RINGS) {
                    const ease = 1.0 - rt;
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(-Math.PI/2, 0, 0);
                    _obj.scale.setScalar(v.scale * (1.0 + rt * 2.5)); 
                    _obj.updateMatrix();
                    ringRef.current.setMatrixAt(rn, _obj.matrix);
                    _col.set(v.color).multiplyScalar(energy * ease);
                    ringRef.current.setColorAt(rn, _col);
                    rn++;
                }
            } else if (v.type === 'shield') {
                const rt = age / 3000; if (rt >= 1) { v.active = false; currentActive.splice(j, 1); continue; }
                if (sn < MAX_RINGS) {
                    const ease = Math.sin(rt * Math.PI);
                    _obj.position.set(v.x, v.y, v.z);
                    _obj.rotation.set(-Math.PI/2, 0, 0);
                    _obj.scale.setScalar(v.scale * (0.9 + ease * 0.1));
                    _obj.updateMatrix();
                    shieldRef.current.setMatrixAt(sn, _obj.matrix);
                    _col.set(v.color).multiplyScalar(2.0 * ease);
                    shieldRef.current.setColorAt(sn, _col);
                    sn++;
                }
            }
        }

        fissureRef.current.count = fn;
        fissureRef.current.instanceMatrix.needsUpdate = true;
        if (fissureRef.current.instanceColor) fissureRef.current.instanceColor.needsUpdate = true;
        
        debrisRef.current.count = dn;
        debrisRef.current.instanceMatrix.needsUpdate = true;
        if (debrisRef.current.instanceColor) debrisRef.current.instanceColor.needsUpdate = true;

        ringRef.current.count = rn;
        ringRef.current.instanceMatrix.needsUpdate = true;
        if (ringRef.current.instanceColor) ringRef.current.instanceColor.needsUpdate = true;
        
        shieldRef.current.count = sn;
        shieldRef.current.instanceMatrix.needsUpdate = true;
        if (shieldRef.current.instanceColor) shieldRef.current.instanceColor.needsUpdate = true;

        fMat.uniforms.uTime.value = time;
        rMat.uniforms.uTime.value = time;
        sMat.uniforms.uTime.value = time;
    });

    return (
        <group>
            <instancedMesh ref={fissureRef} args={[quadGeo, fMat, MAX_WAVES]} frustumCulled={false} />
            <instancedMesh ref={debrisRef} args={[quadGeo, dMat, MAX_DEBRIS]} frustumCulled={false} />
            <instancedMesh ref={ringRef} args={[quadGeo, rMat, MAX_RINGS]} frustumCulled={false} />
            <instancedMesh ref={shieldRef} args={[quadGeo, sMat, MAX_RINGS]} frustumCulled={false} />
        </group>
    );
}
