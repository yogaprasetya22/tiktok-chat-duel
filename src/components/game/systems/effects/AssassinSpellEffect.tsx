'use client';
/**
 * AssassinSpellEffect — Redesigned
 * Modern crit flash: sharp star burst + ripple, no heavy streak computation.
 * Billboard quad, faces camera, 1 draw call.
 */
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const MAX_FLASHES = 150;

import { VFX_TEXTURES } from './VFXAssets';

const ShadowBurstMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
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
            float dist = length(vUv - 0.5);
            // Inverting and boosting for a shadow-kinetic look
            vec3 shadow = mix(vColor * 0.2, vec3(1.0), tex.r);
            gl_FragColor = vec4(shadow * 8.0 * tex.rgb, tex.a * smoothstep(0.5, 0.2, dist));
            if (gl_FragColor.a < 0.05) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

// ─── Luxurious Lethal Scratch Material ───────────────────────────────────────
const LuxuriousCritMat = (tex: THREE.Texture) => new THREE.ShaderMaterial({
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
            gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vec4 tex = texture2D(tDiffuse, vUv);
            // Ultra-bright intensity
            float bright = pow(tex.r, 2.5) * 5.0;
            vec3 finalCol = mix(vColor * 6.0, vec3(2.0), bright);
            gl_FragColor = vec4(finalCol * tex.rgb, tex.a * 0.95);
            if (gl_FragColor.a < 0.04) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

export function AssassinSpellEffect({ assassinSpellsRef, simTimeRef }: { assassinSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const sparkRef = useRef<THREE.InstancedMesh>(null!);
    const burstRef = useRef<THREE.InstancedMesh>(null!);
    const _obj = useMemo(() => new THREE.Object3D(), []);
    const _col = useMemo(() => new THREE.Color(), []);

    const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const mat = useMemo(() => LuxuriousCritMat(VFX_TEXTURES.slashes[0]), []);
    const sMat = useMemo(() => LuxuriousCritMat(VFX_TEXTURES.critical), []);
    const bMat = useMemo(() => ShadowBurstMat(VFX_TEXTURES.twirl), []);

    useFrame((state) => {
        if (!meshRef.current || !assassinSpellsRef.current || !sparkRef.current || !burstRef.current) return;
        const spells = assassinSpellsRef.current;
        const simTime = simTimeRef.current || 0;
        const time = state.clock.elapsedTime;
        const mesh = meshRef.current;
        const sMesh = sparkRef.current;
        const bMesh = burstRef.current;
        
        const slashIdx = Math.floor(time * 18) % 4;
        mat.uniforms.tDiffuse.value = VFX_TEXTURES.slashes[slashIdx];

        let n = 0; let sn = 0; let bn = 0;

        // NERFED for low-end hardware
        const RARITY_SCALE = { common: 0.8, elite: 1.0, epic: 1.1, legendary: 1.2 };
        const RARITY_GLOW = { common: 4.0, elite: 5.0, epic: 6.0, legendary: 7.0 };

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;

            const r = s.rarity || 'common';
            const rScale = (RARITY_SCALE as any)[r] || 1.0;
            const rGlow = (RARITY_GLOW as any)[r] || 5.0;

            const age = simTime - s.startTime;
            const isTeleport = (s as any).isTeleport;
            const duration = isTeleport ? 800 : 250;
            const t = age / duration; 
            if (t >= 1) { s.active = false; continue; }

            const ease = 1 - t;

            if (isTeleport) {
                // Shadow Burst Arrival (Innovation)
                if (bn < 50) {
                    _obj.position.set(s.x, s.y + 0.5, s.z);
                    _obj.quaternion.copy(state.camera.quaternion);
                    _obj.rotateZ(t * -4.0);
                    _obj.scale.setScalar((4.0 + t * 8.0) * ease * rScale);
                    _obj.updateMatrix();
                    bMesh.setMatrixAt(bn, _obj.matrix);
                    _col.set('#4400ff').multiplyScalar(ease * rGlow * 1.5);
                    bMesh.setColorAt(bn, _col);
                    bn++;
                }
            } else {
                // NERFED Layer 1: The Scratches (Regular Attack) - Reduced to 1 scratch for non-teleport
                for (let k = 0; k < 1; k++) {
                    if (n >= MAX_FLASHES) break;
                    _obj.position.set(s.x, s.y + k*0.1, s.z);
                    _obj.quaternion.copy(state.camera.quaternion);
                    _obj.rotateZ(i * 1.57 + k * 0.8 + time * 0.5);
                    const sc = (1.0 + t * 3.0) * ease * 1.8 * rScale;
                    _obj.scale.setScalar(sc);
                    _obj.updateMatrix();
                    mesh.setMatrixAt(n, _obj.matrix);
                    _col.set(s.color || '#FFFF00').multiplyScalar(ease * rGlow);
                    mesh.setColorAt(n, _col);
                    n++;
                }

                // Layer 2: The Critical Star Spark
                if (sn < 100) {
                    _obj.position.set(s.x, s.y + 0.5, s.z);
                    _obj.quaternion.copy(state.camera.quaternion);
                    _obj.rotateZ(t * 8.0);
                    _obj.scale.setScalar((2.0 + t * 5.0) * ease * 2.0 * rScale);
                    _obj.updateMatrix();
                    sMesh.setMatrixAt(sn, _obj.matrix);
                    _col.set('#ffffff').multiplyScalar(ease * rGlow * 0.6);
                    sMesh.setColorAt(sn, _col);
                    sn++;
                }
            }
        }

        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

        sMesh.count = sn;
        sMesh.instanceMatrix.needsUpdate = true;
        if (sMesh.instanceColor) sMesh.instanceColor.needsUpdate = true;

        bMesh.count = bn;
        bMesh.instanceMatrix.needsUpdate = true;
        if (bMesh.instanceColor) bMesh.instanceColor.needsUpdate = true;

        bMat.uniforms.uTime.value = time;
    });

    return (
        <group>
            <instancedMesh ref={meshRef} args={[geo, mat, MAX_FLASHES]} frustumCulled={false} />
            <instancedMesh ref={sparkRef} args={[geo, sMat, 100]} frustumCulled={false} />
            <instancedMesh ref={burstRef} args={[geo, bMat, 50]} frustumCulled={false} />
        </group>
    );
}
