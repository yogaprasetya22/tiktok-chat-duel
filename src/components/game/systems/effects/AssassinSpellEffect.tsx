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

const CritMaterial = () => new THREE.ShaderMaterial({
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

            // 4-point star: cross beams
            float beamH = smoothstep(0.025, 0.0, abs(c.y)) * smoothstep(0.5, 0.05, abs(c.x));
            float beamV = smoothstep(0.025, 0.0, abs(c.x)) * smoothstep(0.5, 0.05, abs(c.y));

            // Diagonal beams (45°) for 8-point look
            float diag1 = smoothstep(0.02, 0.0, abs(c.y - c.x)) * smoothstep(0.4, 0.05, d);
            float diag2 = smoothstep(0.02, 0.0, abs(c.y + c.x)) * smoothstep(0.4, 0.05, d);

            // Soft core glow
            float core = smoothstep(0.15, 0.0, d);

            float alpha = beamH + beamV + (diag1 + diag2) * 0.6 + core * 0.8;
            vec3 col = mix(vColor * 4.0, vec3(1.0), core * 0.7 + (beamH + beamV) * 0.5);
            gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
            if (gl_FragColor.a < 0.04) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
});

export function AssassinSpellEffect({ assassinSpellsRef, simTimeRef }: { assassinSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const _obj = useMemo(() => new THREE.Object3D(), []);
    const _col = useMemo(() => new THREE.Color(), []);

    useFrame((state) => {
        if (!meshRef.current || !assassinSpellsRef.current) return;
        const spells = assassinSpellsRef.current;
        const simTime = simTimeRef.current || 0;
        const mesh = meshRef.current;
        let n = 0;

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;

            const age = simTime - s.startTime;
            const t = age / 280; // 280ms — snappy
            if (t >= 1) { s.active = false; continue; }

            // Sharp pop: fast in, eased out
            const ease = Math.pow(1 - t, 1.5);
            const sc = (0.6 + t * 1.8) * ease + 0.2;

            if (n >= MAX_FLASHES) break;

            _obj.position.set(s.x, s.y, s.z);
            _obj.quaternion.copy(state.camera.quaternion);
            _obj.scale.setScalar(sc * 2.2);
            _obj.updateMatrix();
            mesh.setMatrixAt(n, _obj.matrix);

            _col.set(s.color).multiplyScalar(ease * 3.0);
            mesh.setColorAt(n, _col);
            n++;
        }

        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    const geo = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const mat = useMemo(() => CritMaterial(), []);

    return <instancedMesh ref={meshRef} args={[geo, mat, MAX_FLASHES]} frustumCulled={false} />;
}
