'use client';

import { useRef, useMemo, useEffect, Suspense } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import { SimplexNoise } from 'three-stdlib';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { InstancedStaticCollider } from 'bvhecctrl';

// ─────────────────────────────────────────────────────────────────────────────
// BVH prototype patch (idempotent)
// ─────────────────────────────────────────────────────────────────────────────
if (!(THREE.BufferGeometry.prototype as any)._bvhPatched) {
    (THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
    (THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
    (THREE.Mesh.prototype as any).raycast = acceleratedRaycast;
    (THREE.BufferGeometry.prototype as any)._bvhPatched = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// ASSET PATHS
// ─────────────────────────────────────────────────────────────────────────────
const BIRCH_PATHS: string[] = [
    '/assets-model/asset-enverement/BirchTree_1.glb',
    '/assets-model/asset-enverement/BirchTree_2.glb',
    '/assets-model/asset-enverement/BirchTree_3.glb',
    '/assets-model/asset-enverement/BirchTree_4.glb',
    '/assets-model/asset-enverement/BirchTree_5.glb',
];
const MAPLE_PATHS: string[] = [
    '/assets-model/asset-enverement/MapleTree_1.glb',
    '/assets-model/asset-enverement/MapleTree_2.glb',
    '/assets-model/asset-enverement/MapleTree_3.glb',
    '/assets-model/asset-enverement/MapleTree_4.glb',
    '/assets-model/asset-enverement/MapleTree_5.glb',
];
const ALL_TREE_PATHS = [...BIRCH_PATHS, ...MAPLE_PATHS];

// Default values (also used if settingsRef not provided)
const DEFAULT_TREE_COUNT = 150;
const DEFAULT_TREE_SCALE = 0.8;


// ─────────────────────────────────────────────────────────────────────────────
// HELPER — setup leaf material transparency  
// ─────────────────────────────────────────────────────────────────────────────
function setupLeafMaterial(mat: THREE.Material | THREE.Material[]) {
    const mats = Array.isArray(mat) ? mat : [mat];
    mats.forEach((m: any) => {
        const isLeaf = (m.name && (
            m.name.toLowerCase().includes('leaf') ||
            m.name.toLowerCase().includes('leaves') ||
            m.name.toLowerCase().includes('foliage')
        )) || m.map; // any textured material likely has alpha
        if (isLeaf) {
            // INDUSTRY STANDARD for foliage: alphaTest with transparent=false
            m.transparent = false;
            m.alphaTest = 0.5;
            m.side = THREE.DoubleSide; 
            m.needsUpdate = true;
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — ekstrak mesh parts dari GLB, bake transform, build BVH
// ─────────────────────────────────────────────────────────────────────────────
function extractMeshParts(
    scene: THREE.Group,
): { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] {
    const parts: { geometry: THREE.BufferGeometry; material: THREE.Material | THREE.Material[] }[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((child) => {
        if (!(child as THREE.Mesh).isMesh || !child.visible) return;
        const mesh = child as THREE.Mesh;
        
        // Skip common collision mesh naming conventions
        if (mesh.name.toLowerCase().includes('collision') || mesh.name.toLowerCase().includes('physic')) return;
        const geom = mesh.geometry.clone();
        geom.applyMatrix4(mesh.matrixWorld); // bake local transform
        (geom as any).computeBoundsTree({ maxLeafSize: 8 });
        setupLeafMaterial(mesh.material);
        parts.push({ geometry: geom, material: mesh.material });
    });
    return parts;
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — InstancedMesh for one mesh-part
// ─────────────────────────────────────────────────────────────────────────────
interface PartProps {
    geometry: THREE.BufferGeometry;
    material: THREE.Material | THREE.Material[];
    positions: [number, number, number][];
    scales: number[];
    rotations: number[];
    count: number;
    globalScale: number;
}

const TreePartInstanced = ({ geometry, material, positions, scales, rotations, count, globalScale }: PartProps) => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        for (let i = 0; i < count; i++) {
            dummy.position.set(...positions[i]);
            dummy.rotation.y = rotations[i];
            dummy.scale.setScalar(scales[i] * globalScale);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        // Crucial for frustum culling accuracy as we moved geometry
        mesh.computeBoundingSphere();
    }, [count, dummy, positions, scales, rotations, globalScale]);

    return (
        <InstancedStaticCollider restitution={0} friction={1}>
            <instancedMesh
                ref={meshRef}
                args={[geometry, material as THREE.Material, count]}
                castShadow
                receiveShadow
                frustumCulled={true}
            />
        </InstancedStaticCollider>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENT — load one GLB variant, render N instances
// ─────────────────────────────────────────────────────────────────────────────
interface VariantProps {
    path: string;
    positions: [number, number, number][];
    scales: number[];
    rotations: number[];
    globalScale: number;
}

const TreeVariantInstances = ({ path, positions, scales, rotations, globalScale }: VariantProps) => {
    const { scene } = useGLTF(path) as any;

    const parts = useMemo(() => {
        if (!scene) return [];
        return extractMeshParts(scene);
    }, [scene]);

    const count = positions.length;
    if (count === 0 || parts.length === 0) return null;

    return (
        <group>
            {parts.map((part, pi) => (
                <TreePartInstanced
                    key={pi}
                    geometry={part.geometry}
                    material={part.material}
                    positions={positions}
                    scales={scales}
                    rotations={rotations}
                    count={count}
                    globalScale={globalScale}
                />
            ))}
        </group>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT — Forest
// ─────────────────────────────────────────────────────────────────────────────
interface ForestProps {
    baseDistance: number;
    /** From settingsRef.current – optional live overrides */
    treeCount?: number;
    treeScale?: number;
}

export const Forest = ({ baseDistance, treeCount = DEFAULT_TREE_COUNT, treeScale = DEFAULT_TREE_SCALE }: ForestProps) => {
    const placement = useMemo(() => {
        const noise = new SimplexNoise();
        const maxRadius = 400;
        const clampedCount = Math.max(10, Math.min(600, treeCount));

        const variantData: Record<
            string,
            { positions: [number, number, number][]; scales: number[]; rotations: number[] }
        > = {};
        for (const p of ALL_TREE_PATHS) variantData[p] = { positions: [], scales: [], rotations: [] };

        let placed = 0;
        const attempts = clampedCount * 6;

        for (let i = 0; i < attempts && placed < clampedCount; i++) {
            const angle = (i / clampedCount) * Math.PI * 2 + Math.sin(i * 13.7) * 0.9;
            const radius = baseDistance + 18 + (i % 200) * (maxRadius / 200);
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            // Skip battle arena and center
            if (Math.abs(x) < 15 && Math.abs(z) < 15) continue;
            if (Math.hypot(x, z) < baseDistance + 12) continue;

            // Elevation matching WhimsicalDiorama terrain shader
            const dist = Math.sqrt(x * x + z * z);
            const mask = THREE.MathUtils.smoothstep(dist, baseDistance + 15.0, baseDistance + 50.0);
            let elevation = noise.noise(x * 0.015, z * 0.015) * 35.0;
            elevation += noise.noise(x * 0.04, z * 0.04) * 8.0;
            elevation *= mask;
            elevation = Math.max(elevation, 0.0);

            const variantPath = ALL_TREE_PATHS[i % ALL_TREE_PATHS.length];
            const isBirch = variantPath.includes('Birch');
            // Birch 3.5–8, Maple 4–10 (Tuned for more compact mobile feel)
            const s = isBirch
                ? 3.5 + Math.abs(Math.sin(i * 7.3)) * 4.5
                : 4.0 + Math.abs(Math.sin(i * 5.7)) * 6.0;


            variantData[variantPath].positions.push([x, elevation - 0.6, z]);
            variantData[variantPath].scales.push(s);
            variantData[variantPath].rotations.push(Math.sin(i * 3.14) * Math.PI * 2);
            placed++;
        }

        return variantData;
        // NOTE: we intentionally NOT include treeScale in deps here — 
        // globalScale is passed as prop so instancing updates per frame without re-generating placement
    }, [baseDistance, treeCount]);

    return (
        <Suspense fallback={null}>
            <group>
                {ALL_TREE_PATHS.map((path) => {
                    const d = placement[path];
                    if (!d || d.positions.length === 0) return null;
                    return (
                        <TreeVariantInstances
                            key={path}
                            path={path}
                            positions={d.positions}
                            scales={d.scales}
                            rotations={d.rotations}
                            globalScale={treeScale}
                        />
                    );
                })}
            </group>
        </Suspense>
    );
};

// Preload all 10 GLB assets at module load time → eliminates pop-in
ALL_TREE_PATHS.forEach((path) => useGLTF.preload(path));
