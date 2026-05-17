'use client';

import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { applyPainterlyStyle } from '../../systems/effects/PainterlyMaterials';
import { registerCollider, unregisterCollider } from '@/src/core/utils/globalRaycaster';
import { InstancedStaticCollider } from 'bvhecctrl';

const TREE_COUNT = 120;

export const InstancedTrees = ({ mode, baseDistance = 24 }: { mode: 'DIORAMA' | 'STORM', baseDistance?: number }) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    
    // Create a high-quality low-poly tree geometry
    const treeGeometry = useMemo(() => {
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 2.5, 6);
        trunkGeo.translate(0, 1.25, 0);
        
        const leaves1 = new THREE.ConeGeometry(1.2, 2.5, 6);
        leaves1.translate(0, 2.5, 0);
        
        const leaves2 = new THREE.ConeGeometry(0.9, 2.0, 6);
        leaves2.translate(0, 3.8, 0);
        
        const merged = BufferGeometryUtils.mergeGeometries([trunkGeo, leaves1, leaves2]);
        return merged;
    }, []);

    const treeMaterial = useMemo(() => {
        const mat = new THREE.MeshStandardMaterial({
            color: mode === 'STORM' ? '#3a4a35' : '#4a7c44',
            roughness: 0.8,
            metalness: 0.1,
            flatShading: true,
        });
        applyPainterlyStyle(mat);
        return mat;
    }, [mode]);

    useEffect(() => {
        const dummy = new THREE.Object3D();
        const mesh = meshRef.current;
        if (!mesh) return;

        let placed = 0;
        const area = 1200;
        
        // Seeded random for stable placement
        let seed = 42;
        const rnd = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };

        for (let i = 0; placed < TREE_COUNT && i < 2000; i++) {
            const angle = rnd() * Math.PI * 2;
            const r = (baseDistance + 20) + rnd() * (area / 2 - (baseDistance + 20));
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;

            // Avoid path
            if (Math.abs(x) < 15 && Math.abs(z) < 60) continue;

            // CRITICAL FIX: Match PlaneGeometry -z rotation mapping
            const elevation = getTerrainElevation(x, -z, mode, baseDistance);
            
            // Do not place trees on mountains!
            if (elevation > 0.5) continue;
            
            // Terrain mesh base position depending on mode
            const baseHeight = mode === 'DIORAMA' ? -0.6 : -0.3;

            dummy.position.set(x, elevation + baseHeight, z);
            dummy.rotation.y = rnd() * Math.PI;
            
            const s = 1.0 + rnd() * 2.5;
            dummy.scale.set(s, s * (0.9 + rnd() * 0.4), s);
            dummy.updateMatrix();
            
            mesh.setMatrixAt(placed, dummy.matrix);
            placed++;
        }
        
        mesh.count = placed;
        mesh.instanceMatrix.needsUpdate = true;
        
        // Prevent disappearing from camera (Frustum culling fix)
        mesh.computeBoundingSphere();
    }, [mode, baseDistance]);

    useEffect(() => {
        if (meshRef.current) {
            registerCollider(meshRef.current as any);
            return () => unregisterCollider(meshRef.current as any);
        }
    }, []);

    return (
        <InstancedStaticCollider restitution={0} friction={1}>
            <instancedMesh 
                ref={meshRef} 
                args={[treeGeometry, treeMaterial, TREE_COUNT]} 
                castShadow 
                receiveShadow 
            />
        </InstancedStaticCollider>
    );
};
