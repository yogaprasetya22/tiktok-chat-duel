'use client';
/**
 * FighterSpellEffect — Redesigned
 * Modern energy slash: sharp diagonal beam with fade edge, no heavy noise loops.
 * Single InstancedMesh, additive blending, ~1 draw call for all active slashes.
 */
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const MAX_SLASHES = 200;

const SlashMaterial = () => new THREE.ShaderMaterial({
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
            // Sharp diagonal slash: bright center, fade edges
            vec2 c = vUv - 0.5;
            // Primary slash beam along X
            float beam = smoothstep(0.12, 0.0, abs(c.y - c.x * 0.15));
            // Secondary thinner slash for depth
            float beam2 = smoothstep(0.06, 0.0, abs(c.y + c.x * 0.1)) * 0.5;
            // Fade at ends
            float fade = smoothstep(0.5, 0.1, abs(c.x));
            float alpha = (beam + beam2) * fade;
            // White-hot core
            vec3 col = mix(vColor * 3.0, vec3(1.0), beam * 0.9);
            gl_FragColor = vec4(col, alpha * 0.95);
            if (gl_FragColor.a < 0.04) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
});

export function FighterSpellEffect({ fighterSpellsRef, simTimeRef }: { fighterSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const _obj = useMemo(() => new THREE.Object3D(), []);
    const _col = useMemo(() => new THREE.Color(), []);

    useFrame(() => {
        if (!meshRef.current || !fighterSpellsRef.current) return;
        const spells = fighterSpellsRef.current;
        const simTime = simTimeRef.current || 0;
        const mesh = meshRef.current;
        let n = 0;

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;

            const age = simTime - s.startTime;
            const t = age / 350; // normalize 0→1 over 350ms
            if (t >= 1) { s.active = false; continue; }

            const ease = 1 - t * t; // quadratic fade out

            // Two diagonal slash layers
            for (let j = 0; j < 2; j++) {
                if (n >= MAX_SLASHES) break;
                _obj.position.set(s.x, s.y + j * 0.15, s.z);
                _obj.rotation.set(0, s.rotation + j * 0.25, 0);
                // Scale grows slightly then fades
                const sc = (1.5 + t * 0.8) * ease;
                _obj.scale.set(sc * 2.5, sc, sc);
                _obj.updateMatrix();
                mesh.setMatrixAt(n, _obj.matrix);
                _col.set(s.color).multiplyScalar(ease * 2.5);
                mesh.setColorAt(n, _col);
                n++;
            }
        }

        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const mat = useMemo(() => SlashMaterial(), []);

    return <instancedMesh ref={meshRef} args={[geo, mat, MAX_SLASHES]} frustumCulled={false} />;
}
