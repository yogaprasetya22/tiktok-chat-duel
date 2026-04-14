'use client';
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const MAX_SLASHES = 200;

const SlashShader = {
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
            // Arc slash shape
            float dist = length(vUv - vec2(0.5, 0.0));
            float mask = smoothstep(0.5, 0.48, dist) * smoothstep(0.35, 0.38, dist);
            
            // Bloom / Glow layer
            float glow = smoothstep(0.5, 0.3, dist) * smoothstep(0.2, 0.4, dist);
            
            // Fade along the arc length (u-coordinate)
            float fade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.4, vUv.x);
            
            float alpha = (mask + glow * 0.4) * fade;
            
            vec3 finalColor = vColor * 2.0;
            // White core for intensity
            finalColor = mix(finalColor, vec3(1.0), mask * 0.5);
            
            gl_FragColor = vec4(finalColor * 2.0, alpha);
            if (gl_FragColor.a < 0.01) discard;
        }
    `
};

export function FighterSpellEffect({ fighterSpellsRef, simTimeRef }: { fighterSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const _tempObj = useMemo(() => new THREE.Object3D(), []);
    const _color = useMemo(() => new THREE.Color(), []);

    useFrame((_state) => {
        if (!meshRef.current || !fighterSpellsRef.current) return;
        const spells = fighterSpellsRef.current;
        const simTime = simTimeRef.current || 0;
        const mesh = meshRef.current;
        let activeCount = 0;

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;

            const age = simTime - s.startTime;
            const duration = 0.4; // 400ms duration
            const alpha = 1.0 - (age / duration);

            if (alpha <= 0) {
                s.active = false;
                continue;
            }

            _tempObj.position.set(s.x, s.y, s.z);
            _tempObj.rotation.set(0, s.rotation, 0);
            _tempObj.scale.setScalar(1.5 + (1.0 - alpha) * 0.5);
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

    const geometry = useMemo(() => new THREE.PlaneGeometry(2, 1), []);
    const material = useMemo(() => new THREE.ShaderMaterial({
        ...SlashShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    }), []);

    return <instancedMesh ref={meshRef} args={[geometry, material, MAX_SLASHES]} frustumCulled={false} />;
}
