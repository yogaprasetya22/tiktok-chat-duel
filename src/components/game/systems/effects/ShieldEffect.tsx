'use client';
/**
 * ShieldEffect — High-performance GLSL Energy Dome
 * Uses InstancedMesh and custom ShaderMaterial for cinematic hexagonal shields.
 */
import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { UnitRuntimeData, WORLD_UNIT_POOL_SIZE, ClassKey, SimulationSettings } from '@/src/core/domain/unit.types';

function getBaseScale(classKey: ClassKey, level: number, isBoss: boolean): number {
  if (isBoss) {
    return classKey === 'tank' ? 6.5 : (classKey === 'fighter' ? 4.5 : 4.0);
  }
  return classKey === 'tank' ? (2.5 + level * 0.15) : (1.4 + level * 0.1);
}

const ShieldMaterial = () => new THREE.ShaderMaterial({
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vInstanceColor;
        
        #ifndef USE_INSTANCING_COLOR
            attribute vec3 instanceColor;
        #endif
        
        void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
            vec4 mvPosition = modelViewMatrix * worldPosition;
            vViewDir = normalize(-mvPosition.xyz);
            vInstanceColor = instanceColor;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        varying vec3 vInstanceColor;
        uniform float uTime;

        // Function to create hexagonal pattern
        float hex(vec2 p) {
            p.x *= 1.1547;
            vec2 grid = floor(p);
            vec2 f = fract(p);
            if (mod(grid.x + grid.y, 2.0) > 0.5) f = 1.0 - f;
            return 1.0 - smoothstep(0.0, 0.1, abs(max(f.x, f.y) - 0.95));
        }

        void main() {
            // 1. Fresnel Effect (Outer glow)
            float fresnel = pow(1.0 - clamp(dot(vNormal, vViewDir), 0.0, 1.0), 3.0);
            
            // 2. Animated Hex Grid
            vec2 uv = vUv * 8.0;
            uv.y += uTime * 0.2;
            float pattern = hex(uv);
            
            // 3. Scanning Pulse
            float pulse = sin(vUv.y * 10.0 - uTime * 5.0) * 0.5 + 0.5;
            pulse = step(0.95, pulse) * 0.2;

            // Combine
            vec3 edgeColor = vInstanceColor * 2.0;
            vec3 bgColor = vInstanceColor * 0.3;
            
            float alpha = fresnel * 0.6 + pattern * 0.1 + pulse;
            vec3 finalColor = mix(bgColor, edgeColor, fresnel + pattern + pulse);
            
            gl_FragColor = vec4(finalColor, alpha * 0.8);
            
            // Discard very transparent pixels for performance
            if (gl_FragColor.a < 0.02) discard;
        }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    defines: { USE_INSTANCING: '', USE_INSTANCING_COLOR: '' }
});

interface ShieldEffectProps {
    unitRegistry: React.RefObject<UnitRuntimeData[]>;
    activeIndicesRef: React.RefObject<number[]>;
    settingsRef: React.RefObject<SimulationSettings>;
    simTimeRef: React.RefObject<number>;
}

export function ShieldEffect({ unitRegistry, activeIndicesRef, settingsRef, simTimeRef }: ShieldEffectProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const matRef = useRef<THREE.ShaderMaterial>(null!);
    const _obj = useMemo(() => new THREE.Object3D(), []);
    const _col = useMemo(() => new THREE.Color(), []);

    const geo = useMemo(() => new THREE.SphereGeometry(1, 32, 16), []);
    const mat = useMemo(() => ShieldMaterial(), []);

    useFrame((state) => {
        if (!meshRef.current || !unitRegistry.current) return;
        
        const units = unitRegistry.current;
        const indices = activeIndicesRef.current || [];
        const mesh = meshRef.current;
        const mat = matRef.current || (mesh.material as THREE.ShaderMaterial);
        const globalScale = settingsRef.current?.unitScale || 0.45;
        const simTime = simTimeRef.current || 0;
        
        if (mat.uniforms && mat.uniforms.uTime) {
            mat.uniforms.uTime.value = state.clock.elapsedTime;
        }

        let count = 0;
        for (let k = 0; k < indices.length; k++) {
            const i = indices[k];
            const u = units[i];
            
            if (!u.isActive || u.unitClass !== 'tank' || u.hp <= 0) continue;

            // Deployment Shield Logic: 5 second duration (5000ms)
            const age = simTime - (u.spawnTime || 0);
            
            if (age > 5000) continue; // Shield expires after 5 seconds

            // Fade out in the last second (4000ms - 5000ms)
            let opacity = 1.0;
            if (age > 4000) {
                opacity = 1.0 - (age - 4000) / 1000;
            }

            const bScale = getBaseScale(u.unitClass, u.level || 1, u.isBoss);
            const rarity = u.rarity || 'common';
            const rScale = u.isBoss ? 1.0 : (rarity === 'legendary' ? 1.8 : (rarity === 'epic' ? 1.4 : (rarity === 'elite' ? 1.2 : 1.0)));
            
            const totalVisualScale = bScale * globalScale * rScale;
            const shieldScale = totalVisualScale * 0.95; 
            
            _obj.position.set(u.position[0], u.position[1] + (u.isBoss ? 2.5 : 1.2) * totalVisualScale * 0.8, u.position[2]);
            _obj.scale.setScalar(shieldScale);
            _obj.updateMatrix();
            mesh.setMatrixAt(count, _obj.matrix);

            _col.set(u.type === 'player' ? '#4488ff' : '#ff4444').multiplyScalar(opacity);
            mesh.setColorAt(count, _col);
            
            count++;
        }

        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[geo, mat, WORLD_UNIT_POOL_SIZE]} frustumCulled={false}>
            <primitive object={mat} ref={matRef} attach="material" />
        </instancedMesh>
    );
}
