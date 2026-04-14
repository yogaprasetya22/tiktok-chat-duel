'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky } from '@react-three/drei';

import { 
    PainterlyWaterMaterial, 
    PainterlyTerrainMaterial, 
    PainterlyGrassMaterial
} from '../systems/effects/PainterlyMaterials';

import { useStore } from "@/src/state/useStore";

const RAIN_COUNT = 500;
const RainMaterial = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader: `
    uniform float time;
    void main() {
      vec4 worldPos = instanceMatrix * vec4(position, 1.0);
      float speed = 80.0;
      worldPos.y -= mod(time * speed + worldPos.y, 60.0);
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `void main() { gl_FragColor = vec4(0.48, 0.54, 0.66, 0.6); }`,
  transparent: true,
});

const Rain = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    useEffect(() => {
        for (let i = 0; i < RAIN_COUNT; i++) {
            dummy.position.set((Math.random()-0.5)*200, Math.random()*60, (Math.random()-0.5)*200);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, []);
    useFrame((state) => { RainMaterial.uniforms.time.value = state.clock.elapsedTime; });
    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]}>
            <cylinderGeometry args={[0.015, 0.015, 1.2, 3]} />
            <primitive object={RainMaterial} attach="material" />
        </instancedMesh>
    );
};

const Lightning = () => {
  const lightRef = useRef<THREE.PointLight>(null!);
  useEffect(() => {
    const trigger = () => {
      if (lightRef.current) {
        lightRef.current.intensity = 200 + Math.random() * 300;
        setTimeout(() => { if (lightRef.current) lightRef.current.intensity = 0; }, 50);
      }
      setTimeout(trigger, 3000 + Math.random() * 6000);
    };
    trigger();
  }, []);
  return <pointLight ref={lightRef} position={[0, 40, -10]} distance={200} color="#cce6ff" intensity={0} />;
};

const GRASS_COUNT = 2500;
const PainterlyGrass = ({ baseDistance = 24 }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const gameState = useStore(s => s.gameState);
    useEffect(() => {
        let count = 0;
        const radius = baseDistance + 10;
        const density = gameState === 'SETUP' ? GRASS_COUNT / 2 : GRASS_COUNT;
        while (count < density) {
            const r = Math.sqrt(Math.random()) * radius;
            const angle = Math.random() * Math.PI * 2;
            const x = r * Math.cos(angle);
            const z = r * Math.sin(angle);
            
            // Avoid very center
            if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;

            dummy.position.set(x, -0.6, z);
            dummy.rotation.set(0, Math.random() * Math.PI, 0);
            dummy.scale.set(1.0, 0.4 + Math.random() * 0.8, 1.0);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(count, dummy.matrix);
            count++;
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [baseDistance, dummy]);

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, GRASS_COUNT]}>
            <planeGeometry args={[0.2, 0.8, 1, 3]} />
            <primitive object={PainterlyGrassMaterial} attach="material" />
        </instancedMesh>
    );
};

/**
 * Floating Debris - Bobbing objects for the whimsical feel
 */
const FloatingDebris = ({ count = 40 }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const seeds = useMemo(() => Array.from({ length: count }, () => Math.random() * Math.PI * 2), [count]);

    useEffect(() => {
        for (let i = 0; i < count; i++) {
            const r = 25 + Math.random() * 50;
            const angle = Math.random() * Math.PI * 2;
            const x = r * Math.cos(angle);
            const z = r * Math.sin(angle);
            
            dummy.position.set(x, 0, z);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            dummy.scale.setScalar(0.2 + Math.random() * 0.8);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [count, dummy]);

    useFrame((state) => {
        const time = state.clock.elapsedTime;
        for (let i = 0; i < count; i++) {
            meshRef.current.getMatrixAt(i, dummy.matrix);
            dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
            
            // Bobbing animation: sine wave on Y and slight rotation
            dummy.position.y = -0.4 + Math.sin(time + seeds[i]) * 0.15;
            dummy.rotation.x += Math.sin(time * 0.5 + seeds[i]) * 0.002;
            dummy.rotation.z += Math.cos(time * 0.3 + seeds[i]) * 0.002;
            
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshToonMaterial color="#fca311" />
        </instancedMesh>
    );
};

/**
 * WhimsicalDiorama - The main environment component
 */
export const WhimsicalDiorama = ({ baseDistance = 24 }) => {
    const weather = useStore(s => s.weather);
    const gameState = useStore(s => s.gameState);
    const isSetup = gameState === 'SETUP';

    useFrame((state) => {
        const time = state.clock.elapsedTime;
        PainterlyWaterMaterial.uniforms.time.value = time;
        PainterlyTerrainMaterial.uniforms.time.value = time;
        PainterlyTerrainMaterial.uniforms.baseDist.value = baseDistance;
        PainterlyGrassMaterial.uniforms.time.value = time;
    });

    return (
        <group>
            {/* 1. SKYBOX & SUNLIGHT (High Noon / 12 PM) */}
            <Sky sunPosition={[0, 100, 0]} />
            <ambientLight intensity={1.0} color="#ffffff" />
            <directionalLight 
                position={[0, 100, 0]} 
                intensity={isSetup ? 5.0 : 10.0} 
                color="#ffffff" 
                castShadow={!isSetup} 
                shadow-mapSize={isSetup ? [512, 512] : [2048, 2048]}
            />
            <pointLight position={[0, 15, 0]} intensity={2.0} color="#ffaa00" distance={150} />


            {/* 2. WEATHER EFFECTS */}
            {(weather === 'RAIN' || weather === 'STORM' || weather === 'THUNDER') && <Rain />}
            {(weather === 'THUNDER' || weather === 'STORM') && <Lightning />}



            {/* 3. TERRAIN ISLAND & MOUNTAINS */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow={!isSetup}>
                <planeGeometry args={[baseDistance * 10.0, baseDistance * 10.0, isSetup ? 32 : 64, isSetup ? 32 : 64]} />
                <primitive object={PainterlyTerrainMaterial} attach="material" />
            </mesh>
            
            {/* 4. GRASS */}
            <PainterlyGrass baseDistance={baseDistance} />

            {/* 5. WATER PLANE */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]}>
                <planeGeometry args={[500, 500]} />
                <primitive object={PainterlyWaterMaterial} attach="material" />
            </mesh>


            {/* 5. FLOATING DEBRIS */}
            <FloatingDebris count={60} />

            {/* 6. FOG FOR DEPTH */}
            <fog attach="fog" args={["#000000", 20, 250]} />
        </group>
    );
};
