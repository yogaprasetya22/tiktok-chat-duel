'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky, Float, Stars, Sparkles, useGLTF } from '@react-three/drei';

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
        <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]} frustumCulled={false}>
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

const GRASS_COUNT = 1800;
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
        <instancedMesh ref={meshRef} args={[undefined, undefined, GRASS_COUNT]} frustumCulled={false}>
            <planeGeometry args={[0.2, 0.8, 1, 1]} />
            <primitive object={PainterlyGrassMaterial} attach="material" />
        </instancedMesh>
    );
};

/**
 * Floating Ruins - Background islands that add scale and mystery
 */
const FloatingRuins = () => {
    const { scene: arch } = useGLTF('/kingdom/tower-square-arch.glb');
    const { scene: roof } = useGLTF('/kingdom/tower-slant-roof.glb');
    
    return (
        <group>
            {/* Ruined Arch Island */}
            <Float speed={2} rotationIntensity={0.5} floatIntensity={1} position={[45, 12, -40]}>
                <mesh>
                    <icosahedronGeometry args={[4, 1]} />
                    <primitive object={PainterlyTerrainMaterial} attach="material" />
                </mesh>
                <primitive object={arch.clone()} scale={0.4} position={[0, 4, 0]} />
            </Float>

            {/* Slanted Roof Island */}
            <Float speed={1.5} rotationIntensity={0.8} floatIntensity={1.5} position={[-50, 8, -25]}>
                <mesh>
                    <icosahedronGeometry args={[3, 1]} />
                    <primitive object={PainterlyTerrainMaterial} attach="material" />
                </mesh>
                <primitive object={roof.clone()} scale={2.5} position={[0, 3, 0]} rotation={[0, 2, 0.4]} />
            </Float>

            {/* Distant Pylon */}
            <Float speed={3} rotationIntensity={0.2} floatIntensity={2} position={[0, 25, -100]}>
                <mesh>
                    <octahedronGeometry args={[2, 0]} />
                    <meshToonMaterial color="#fca311" emissive="#ffaa00" emissiveIntensity={2} />
                </mesh>
            </Float>
        </group>
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
            {/* 1. SKYBOX & MAGICAL ATMOSPHERE */}
            <Sky sunPosition={[-10, 5, -10]} turbidity={0.1} rayleigh={2} />
            <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
            <Sparkles count={60} scale={[80, 20, 80]} size={6} speed={0.4} color="#ffcc00" opacity={0.6} />
            
            <ambientLight intensity={0.8} color="#f0f9ff" />
            <directionalLight 
                position={[-20, 30, -20]} 
                intensity={isSetup ? 4.0 : 8.0} 
                color="#fcd34d" 
                castShadow={!isSetup} 
                shadow-mapSize={[1024, 1024]}
                shadow-camera-left={-60}
                shadow-camera-right={60}
                shadow-camera-top={60}
                shadow-camera-bottom={-60}
                shadow-camera-far={150}
            />
            <pointLight position={[0, 10, 0]} intensity={3.0} color="#ff8800" distance={100} />
            <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#000000" />


            {/* 2. WEATHER EFFECTS */}
            {(weather === 'RAIN' || weather === 'STORM' || weather === 'THUNDER') && <Rain />}
            {(weather === 'THUNDER' || weather === 'STORM') && <Lightning />}



            {/* 3. TERRAIN ISLAND & MOUNTAINS */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow={!isSetup} frustumCulled={false}>
                <planeGeometry args={[baseDistance * 10.0, baseDistance * 10.0, isSetup ? 32 : 64, isSetup ? 32 : 64]} />
                <primitive object={PainterlyTerrainMaterial} attach="material" />
            </mesh>
            
            {/* 4. GRASS */}
            <PainterlyGrass baseDistance={baseDistance} />

            {/* 5. WATER PLANE */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]} frustumCulled={false}>
                <planeGeometry args={[500, 500]} />
                <primitive object={PainterlyWaterMaterial} attach="material" />
            </mesh>


            {/* 5. FLOATING RUINS & DEBRIS */}
            <FloatingRuins />

            {/* 6. ENCHANTED FOG */}
            <fog attach="fog" args={["#1e293b", 10, 200]} />
        </group>
    );
};
