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
        
        float hash(vec2 p) {
            return fract(sin(dot(p, vec2(12.1, 31.7))) * 43758.5453);
        }

        void main() {
            vec2 uv = vUv - vec2(0.5, 0.0);
            float dist = length(uv);
            
            // Primary intense arc
            float arc = smoothstep(0.5, 0.45, dist) * smoothstep(0.3, 0.38, dist);
            
            // "Busy" noise / heat distortion look
            float noise = hash(vUv * 20.0);
            float streaks = smoothstep(0.4, 0.5, hash(vUv * vec2(1.0, 50.0)));
            
            // Edge glow
            float glow = smoothstep(0.5, 0.2, dist) * smoothstep(0.1, 0.4, dist);
            
            float alpha = (arc * 1.5 + glow * 0.6 + streaks * 0.3) * smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
            
            vec3 color = vColor * (2.0 + noise);
            color = mix(color, vec3(1.0, 1.0, 1.0), arc * 0.8); // White hot core
            
            gl_FragColor = vec4(color * 3.0, alpha);
            if (gl_FragColor.a < 0.05) discard;
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
            const duration = 400; 
            const alpha = 1.0 - (age / duration);

            if (alpha <= 0) {
                s.active = false;
                continue;
            }

            const scale = 1.1 + (1.0 - alpha) * 1.6;
            
            // VOLUMETRIC TRIPLE-SLASH: Layer 3 instances per slash with different tilts
            for (let j = 0; j < 3; j++) {
                if (activeCount >= MAX_SLASHES) break;
                
                _tempObj.position.set(s.x, s.y, s.z);
                // Interleaved rotations to create a "thick" 3D volume
                _tempObj.rotation.set(
                    (j - 1) * 0.4, // Tilt X
                    s.rotation + (j - 1) * 0.1, // Offset Y
                    (j - 1) * 0.2 // Tilt Z
                );
                
                _tempObj.scale.set(scale, scale * 0.6, scale);
                _tempObj.updateMatrix();
                mesh.setMatrixAt(activeCount, _tempObj.matrix);
                
                _color.set(s.color).multiplyScalar(1.0 - j * 0.2); // inner layers darker
                mesh.setColorAt(activeCount, _color);
                activeCount++;
            }
        }

        mesh.count = activeCount;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    const geometry = useMemo(() => new THREE.PlaneGeometry(3, 1.5), []);
    const material = useMemo(() => new THREE.ShaderMaterial({
        ...SlashShader,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
    }), []);

    return <instancedMesh ref={meshRef} args={[geometry, material, MAX_SLASHES]} frustumCulled={false} />;
}
