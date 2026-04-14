'use client';
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const MAX_FLASHES = 150;

const CritShader = {
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
        void main() {
            vec2 uv = vUv - 0.5;
            
            // Cross/Star shape
            float beamH = smoothstep(0.05, 0.0, abs(uv.y)) * smoothstep(0.5, 0.2, abs(uv.x));
            float beamV = smoothstep(0.05, 0.0, abs(uv.x)) * smoothstep(0.5, 0.2, abs(uv.y));
            float core = smoothstep(0.1, 0.0, length(uv));
            
            float alpha = max(max(beamH, beamV), core);
            gl_FragColor = vec4(vColor * 5.0, alpha);
            if (gl_FragColor.a < 0.1) discard;
        }
    `
};

export function AssassinSpellEffect({ assassinSpellsRef, simTimeRef }: { assassinSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const _tempObj = useMemo(() => new THREE.Object3D(), []);
    const _color = useMemo(() => new THREE.Color(), []);

    useFrame((state) => {
        if (!meshRef.current || !assassinSpellsRef.current) return;
        const spells = assassinSpellsRef.current;
        const simTime = simTimeRef.current || 0;
        const mesh = meshRef.current;
        let activeCount = 0;

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;

            const age = simTime - s.startTime;
            const duration = 0.3; // 300ms duration (very fast)
            const alpha = 1.0 - (age / duration);

            if (alpha <= 0) {
                s.active = false;
                continue;
            }

            _tempObj.position.set(s.x, s.y, s.z);
            _tempObj.quaternion.copy(state.camera.quaternion); // Face camera
            _tempObj.scale.setScalar(1.2 + (1.0 - alpha) * 2.0);
            _tempObj.updateMatrix();
            mesh.setMatrixAt(activeCount, _tempObj.matrix);
            
            _color.set(s.color);
            mesh.setColorAt(activeCount, _color);
            activeCount++;
        }

        mesh.count = activeCount;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const material = useMemo(() => new THREE.ShaderMaterial({
        ...CritShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    }), []);

    return <instancedMesh ref={meshRef} args={[geometry, material, MAX_FLASHES]} frustumCulled={false} />;
}
