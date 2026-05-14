import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export const FloatingDebris = ({ count = 40 }: { count?: number }) => {
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
