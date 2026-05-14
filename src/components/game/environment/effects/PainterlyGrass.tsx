import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PainterlyGrassMaterial } from '../../systems/effects/PainterlyMaterials';
import { useStore } from "@/src/state/useStore";
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const GRASS_COUNT = 1500; // Total instances (each instance will be a cluster)

interface PainterlyGrassProps {
    baseDistance: number;
    mode: 'DIORAMA' | 'STORM';
}

export const PainterlyGrass = ({ baseDistance = 24, mode }: PainterlyGrassProps) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    const gameState = useStore(s => s.gameState);

    // Create a "Grass Cluster" geometry (3 blades in one instance)
    const clusterGeometry = useMemo(() => {
        const geometries: THREE.BufferGeometry[] = [];
        for (let i = 0; i < 3; i++) {
            const geo = new THREE.PlaneGeometry(0.25, 0.8, 1, 2);
            const angle = (i / 3) * Math.PI * 2;
            const r = 0.2;
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            geo.translate(x, 0.4, z);
            geo.rotateY(Math.random() * Math.PI);
            geometries.push(geo);
        }
        return BufferGeometryUtils.mergeGeometries(geometries);
    }, []);

    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;

        let count = 0;
        const radius = mode === 'DIORAMA' ? baseDistance + 15 : 400;
        const density = gameState === 'SETUP' ? GRASS_COUNT / 3 : GRASS_COUNT;
        
        // Use a seeded-like deterministic random for stability
        let seed = 123.456;
        const rnd = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };

        for (let i = 0; count < density && i < density * 3; i++) {
            const r = Math.sqrt(rnd()) * radius;
            const angle = rnd() * Math.PI * 2;
            const x = r * Math.cos(angle);
            const z = r * Math.sin(angle);

            // Avoid path/center
            if (Math.abs(x) < 12 && Math.abs(z) < 60) continue;

            // CRITICAL FIX: PlaneGeometry uses (x, y). When rotated -90 on X, geometry.y becomes world.-z.
            // So to match the terrain mesh elevation, we MUST sample noise at (x, -z).
            const elevation = getTerrainElevation(x, -z, mode, baseDistance);
            
            // Do not place grass on mountains!
            if (elevation > 0.5) continue;
            
            // Terrain mesh is positioned differently depending on mode
            const baseHeight = mode === 'DIORAMA' ? -0.6 : -0.3;

            dummy.position.set(x, elevation + baseHeight, z);
            dummy.rotation.set(0, rnd() * Math.PI, 0);
            dummy.scale.setScalar(0.8 + rnd() * 0.7);
            dummy.updateMatrix();
            mesh.setMatrixAt(count, dummy.matrix);
            count++;
        }
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        
        // Fix disappearing issue (Frustum Culling bounds)
        mesh.computeBoundingSphere();
    }, [baseDistance, dummy, gameState, mode]);

    useFrame((state) => {
        PainterlyGrassMaterial.uniforms.time.value = state.clock.elapsedTime;
    });

    return (
        <instancedMesh ref={meshRef} args={[clusterGeometry, undefined, GRASS_COUNT]} frustumCulled>
            <primitive object={PainterlyGrassMaterial} attach="material" />
        </instancedMesh>
    );
};
