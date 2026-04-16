import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { PainterlyGrassMaterial } from '../../systems/effects/PainterlyMaterials';
import { useStore } from "@/src/state/useStore";

const GRASS_COUNT = 2500;

export const PainterlyGrass = ({ baseDistance = 24 }: { baseDistance: number }) => {
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
    }, [baseDistance, dummy, gameState]);

    useFrame((state) => {
        PainterlyGrassMaterial.uniforms.time.value = state.clock.elapsedTime;
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, GRASS_COUNT]} frustumCulled>
            <planeGeometry args={[0.2, 0.8, 1, 3]} />
            <primitive object={PainterlyGrassMaterial} attach="material" />
        </instancedMesh>
    );
};
