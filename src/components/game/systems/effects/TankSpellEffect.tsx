'use client';
/**
 * TankSpellEffect — Redesigned
 * Modern shockwave ring: expanding ring with sharp edge, no crack loops.
 * Clean minimal shader, 1 draw call.
 */
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const MAX_WAVES = 150;

const ShockwaveMaterial = () => new THREE.ShaderMaterial({
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
        uniform float uTime;
        void main() {
            vec2 c = vUv - 0.5;
            float d = length(c);

            // Expanding ring: tight band that moves outward with time
            float ring = smoothstep(0.02, 0.0, abs(d - 0.4)) * 4.0;

            // Inner glow that fades
            float core = smoothstep(0.35, 0.0, d) * 0.5;

            // Four directional spikes for impact feel
            float angle = atan(c.y, c.x);
            float spikes = step(0.97, abs(sin(angle * 4.0))) * smoothstep(0.45, 0.0, d);

            float alpha = clamp(ring + core + spikes * 0.6, 0.0, 1.0);
            gl_FragColor = vec4(vColor * 2.5 + vec3(ring * 0.5), alpha);
            if (gl_FragColor.a < 0.03) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

export function TankSpellEffect({ tankSpellsRef, simTimeRef }: { tankSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const _obj = useMemo(() => new THREE.Object3D(), []);
    const _col = useMemo(() => new THREE.Color(), []);

    useFrame(() => {
        if (!meshRef.current || !tankSpellsRef.current) return;
        const spells = tankSpellsRef.current;
        const simTime = simTimeRef.current || 0;
        const mesh = meshRef.current;
        let n = 0;

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;

            const age = simTime - s.startTime;
            const t = age / 600; // 600ms
            if (t >= 1) { s.active = false; continue; }

            const ease = 1 - t;
            const easeOut = Math.sqrt(t); // expand fast, linger

            if (n >= MAX_WAVES) break;

            _obj.position.set(s.x, 0.05, s.z);
            _obj.rotation.set(-Math.PI / 2, 0, 0);
            // Ring expands as t increases
            const sc = 1.0 + easeOut * 3.5;
            _obj.scale.setScalar(sc);
            _obj.updateMatrix();
            mesh.setMatrixAt(n, _obj.matrix);

            _col.set(s.color).multiplyScalar(ease * 2.0);
            mesh.setColorAt(n, _col);
            n++;
        }

        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    const geo = useMemo(() => new THREE.CircleGeometry(1, 16), []);
    const mat = useMemo(() => ShockwaveMaterial(), []);

    return <instancedMesh ref={meshRef} args={[geo, mat, MAX_WAVES]} frustumCulled={false} />;
}
