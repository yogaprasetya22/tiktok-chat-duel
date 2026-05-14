'use client';

import { useMemo, useEffect } from 'react';
import React from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Sky } from '@react-three/drei';
import { StaticCollider } from 'bvhecctrl';
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import {
    PainterlyWaterMaterial,
    PainterlyTerrainMaterial,
    PainterlyGrassMaterial
} from '../systems/effects/PainterlyMaterials';

import { useStore } from "@/src/state/useStore";


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
        (geo as any).computeBoundsTree({ maxDepth: 64, maxLeafTris: 5 });
        return geo;
    }, [baseDistance]); // REMOVED isSetup — this was the root cause!

    // Signal parent that BVH is ready (next frame after geometry mounts)
    useEffect(() => {
        const id = requestAnimationFrame(() =>
            requestAnimationFrame(() => onReady?.())
        );
        return () => cancelAnimationFrame(id);
    }, [terrainGeometry, onReady]);

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
            <Sky sunPosition={[5, 100, 5]} />

            <ambientLight intensity={2.0} color="#ffffff" />

            <directionalLight
                position={[5, 100, 5]}
                intensity={12.0}

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
                    maxLeafTris: 5,
                    verbose: false
                }}
            >
                <mesh 
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
