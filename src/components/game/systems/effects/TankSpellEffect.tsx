'use client';
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';

const MAX_CRACKS = 150;

const CrackShader = {
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
        
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        void main() {
            vec2 uv = vUv - 0.5;
            float dist = length(uv);
            
            // Per-pixel noise for crack jaggedness
            float angle = atan(uv.y, uv.x);
            float noise = hash(floor(uv * 20.0)) * 0.05;
            
            // Multiple crack branches
            float cracks = 0.0;
            for(float i = 1.0; i < 4.0; i++) {
                float beam = step(0.95, sin(angle * (6.0 + i * 2.0) + hash(vec2(i)) * 6.28));
                cracks = max(cracks, beam * dist);
            }
            
            float ring = smoothstep(0.5, 0.4, dist + noise);
            float hole = smoothstep(0.1, 0.2, dist); // Darker center
            
            float alpha = (cracks * 3.0 + ring * 0.5) * (0.5 - dist) * hole;
            
            vec3 earthColor = mix(vColor * 0.2, vColor, ring);
            gl_FragColor = vec4(earthColor, alpha);
            if (gl_FragColor.a < 0.01) discard;
        }
    `
};

export function TankSpellEffect({ tankSpellsRef, simTimeRef }: { tankSpellsRef: React.RefObject<any[]>, simTimeRef: React.RefObject<number> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const _tempObj = useMemo(() => new THREE.Object3D(), []);
    const _color = useMemo(() => new THREE.Color(), []);

    useFrame((_state) => {
        if (!meshRef.current || !tankSpellsRef.current) return;
        const spells = tankSpellsRef.current;
        const simTime = simTimeRef.current || 0;
        const mesh = meshRef.current;
        let activeCount = 0;

        for (let i = 0; i < spells.length; i++) {
            const s = spells[i];
            if (!s.active) continue;

            const age = simTime - s.startTime;
            const duration = 0.8; // 800ms duration
            const alpha = 1.0 - (age / duration);

            if (alpha <= 0) {
                s.active = false;
                continue;
            }

            _tempObj.position.set(s.x, s.y, s.z);
            _tempObj.rotation.set(-Math.PI / 2, 0, 0); // Flat on ground
            _tempObj.scale.setScalar(2.0 + (1.0 - alpha) * 1.5);
            _tempObj.updateMatrix();
            mesh.setMatrixAt(activeCount, _tempObj.matrix);
            
            _color.set(s.color).lerp(new THREE.Color('#333333'), 1.0 - alpha);
            mesh.setColorAt(activeCount, _color);
            activeCount++;
        }

        mesh.count = activeCount;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    const geometry = useMemo(() => new THREE.CircleGeometry(1, 16), []);
    const material = useMemo(() => new THREE.ShaderMaterial({
        ...CrackShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
    }), []);

    return <instancedMesh ref={meshRef} args={[geometry, material, MAX_CRACKS]} frustumCulled={false} />;
}
