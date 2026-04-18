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
            return fract(sin(dot(p, vec2(12.71, 31.17))) * 43758.5453);
        }

        void main() {
            vec2 uv = vUv - 0.5;
            float dist = length(uv);
            
            // Jittered cracks
            float angle = atan(uv.y, uv.x);
            float noise = hash(vUv * 30.0) * 0.05;
            float cracks = 0.0;
            for(float i = 1.0; i < 5.0; i++) {
                float beam = step(0.96, sin(angle * (4.0 + i * 3.0) + hash(vec2(i)) * 6.28));
                cracks = max(cracks, beam * (0.5 - dist));
            }
            
            // Outer shockwave ring
            float ring = smoothstep(0.5, 0.4, dist + noise);
            float hole = smoothstep(0.05, 0.25, dist); // Central impact hole
            
            // "Busy" debris fragments
            float debris = step(0.99, hash(uv * 10.0 + noise));
            
            float alpha = (cracks * 4.0 + ring * 1.5 + debris * 2.0) * (0.5 - dist) * hole;
            
            vec3 color = mix(vColor * 0.1, vColor * 2.5, ring);
            color += vec3(1.0, 0.8, 0.6) * cracks * 2.0; // Glow in cracks
            
            gl_FragColor = vec4(color, alpha);
            if (gl_FragColor.a < 0.05) discard;
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
            const duration = 800; // 800ms duration
            const alpha = 1.0 - (age / duration);

            if (alpha <= 0) {
                s.active = false;
                continue;
            }

            const scaleBase = 1.2 + (1.0 - alpha) * 2.0;
            
            // SEISMIC LAYERS: 2 instances per impact (Ground and Dust)
            for (let j = 0; j < 2; j++) {
                if (activeCount >= MAX_CRACKS) break;
                
                _tempObj.position.set(s.x, s.y + j * 0.1, s.z);
                _tempObj.rotation.set(-Math.PI / 2, j * Math.PI * 0.25, 0); 
                
                const layerScale = scaleBase * (j === 0 ? 1.0 : 1.2);
                _tempObj.scale.setScalar(layerScale);
                _tempObj.updateMatrix();
                mesh.setMatrixAt(activeCount, _tempObj.matrix);
                
                _color.set(s.color).multiplyScalar(j === 0 ? 0.8 : 1.5);
                mesh.setColorAt(activeCount, _color);
                activeCount++;
            }
        }

        mesh.count = activeCount;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    const geometry = useMemo(() => new THREE.CircleGeometry(1, 12), []);
    const material = useMemo(() => new THREE.ShaderMaterial({
        ...CrackShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
    }), []);

    return <instancedMesh ref={meshRef} args={[geometry, material, MAX_CRACKS]} frustumCulled={false} />;
}
