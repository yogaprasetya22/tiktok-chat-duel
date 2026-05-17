'use client';

import { useMemo, useEffect, useRef } from 'react';
import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment } from '@react-three/drei';
import { StaticCollider } from 'bvhecctrl';
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import {
    PainterlyWaterMaterial,
    PainterlyTerrainMaterial,
    PainterlyGrassMaterial
} from '../systems/effects/PainterlyMaterials';

import { useStore } from "@/src/state/useStore";
import { registerCollider, unregisterCollider } from '@/src/core/utils/globalRaycaster';


import { PainterlyGrass } from './effects/PainterlyGrass';

import { Rain, Lightning } from './effects/WeatherEffects';
import { FloatingDebris } from './effects/FloatingDebris';
import { InstancedTrees } from './effects/InstancedTrees';

/**
 * WhimsicalDiorama - The main environment component
 */
interface WhimsicalDioramaProps {
    baseDistance?: number;
    settingsRef?: React.RefObject<any>;
    debug?: boolean;
    onReady?: () => void;
}

export const WhimsicalDiorama = ({ baseDistance = 24, settingsRef, debug = false, onReady }: WhimsicalDioramaProps) => {
    const weather = useStore(s => s.weather);
    const meshRef = useRef<THREE.Mesh>(null!);

    const terrainGeometry = useMemo(() => {
        const size = 1500.0;
        // CRITICAL FIX: Removed isSetup dependency — rebuilding geometry on SETUP->PLAYING
        // caused a BVH registration gap, allowing the character to fall through the map.
        const resolution = settingsRef?.current?.potatoMode ? 64 : 128;
        const geo = new THREE.PlaneGeometry(size, size, resolution, resolution);
        const pos = geo.attributes.position;
        
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const elevation = getTerrainElevation(x, y, "DIORAMA", baseDistance);
            pos.setZ(i, elevation);
        }

        geo.computeVertexNormals();
        (geo as any).computeBoundsTree({ maxDepth: 64, maxLeafSize: 5 });
        return geo;
    }, [baseDistance]); // REMOVED isSetup — this was the root cause!

    // Signal parent that BVH is ready (next frame after geometry mounts)
    useEffect(() => {
        const id = requestAnimationFrame(() =>
            requestAnimationFrame(() => onReady?.())
        );
        return () => cancelAnimationFrame(id);
    }, [terrainGeometry, onReady]);

    useEffect(() => {
        if (meshRef.current) {
            registerCollider(meshRef.current);
            return () => unregisterCollider(meshRef.current);
        }
    }, [terrainGeometry]);

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
            <Environment 
                files="/qwantani_sunset_1k.exr" 
                background 
                blur={0}
            />

            <ambientLight intensity={3.5} color="#ffffff" />

            <directionalLight
                position={[10, 100, 10]}
                intensity={15.0}

                color="#ffffff"
                castShadow
                shadow-mapSize={[1024, 1024]}

                shadow-camera-left={-200}
                shadow-camera-right={200}
                shadow-camera-top={200}
                shadow-camera-bottom={-200}
                shadow-camera-near={0.5}
                shadow-camera-far={500}
            />
            <pointLight position={[0, 15, 0]} intensity={4.0} color="#ffaa00" distance={250} />


            {/* 2. WEATHER EFFECTS */}
            {(weather === 'RAIN' || weather === 'STORM' || weather === 'THUNDER') && <Rain />}
            {(weather === 'THUNDER' || weather === 'STORM') && <Lightning />}



            {/* 3. TERRAIN ISLAND & MOUNTAINS */}
            <StaticCollider 
                debug={debug}
                BVHOptions={{
                    strategy: 1, // SAH
                    maxDepth: 64,
                    maxLeafSize: 5,
                    verbose: false
                } as any}
            >
                <mesh 
                    ref={meshRef}
                    name="terrain"
                    geometry={terrainGeometry}
                    rotation={[-Math.PI / 2, 0, 0]} 
                    position={[0, -0.6, 0]} 
                    receiveShadow
                >
                    <primitive object={PainterlyTerrainMaterial} attach="material" wireframe={debug} />
                </mesh>
            </StaticCollider>

            {/* 4. GRASS & ENVIRONMENT */}
            <PainterlyGrass baseDistance={baseDistance} mode="DIORAMA" />
            <InstancedTrees mode="DIORAMA" baseDistance={baseDistance} />


            {/* 5. WATER PLANE (NO COLLIDER) */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.85, 0]}>
                <planeGeometry args={[1500, 1500]} />
                <primitive object={PainterlyWaterMaterial} attach="material" />
            </mesh>


            {/* 6. FLOATING DEBRIS */}
            <FloatingDebris count={60} />

            {/* 7. FOG FOR DEPTH */}
            <fog attach="fog" args={["#1a1a2e", settingsRef?.current?.fogNear ?? 60, settingsRef?.current?.fogFar ?? 450]} />
        </group>
    );
};
