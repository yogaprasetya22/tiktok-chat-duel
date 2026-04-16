import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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

export const Rain = () => {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const dummy = useMemo(() => new THREE.Object3D(), []);
    useEffect(() => {
        for (let i = 0; i < RAIN_COUNT; i++) {
            dummy.position.set((Math.random() - 0.5) * 200, Math.random() * 60, (Math.random() - 0.5) * 200);
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [dummy]);
    useFrame((state) => { RainMaterial.uniforms.time.value = state.clock.elapsedTime; });
    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]}>
            <cylinderGeometry args={[0.015, 0.015, 1.2, 3]} />
            <primitive object={RainMaterial} attach="material" />
        </instancedMesh>
    );
};

export const Lightning = () => {
    const lightRef = useRef<THREE.PointLight>(null!);
    useEffect(() => {
        let isMounted = true;
        const trigger = () => {
            if (!isMounted) return;
            if (lightRef.current) {
                lightRef.current.intensity = 200 + Math.random() * 300;
                setTimeout(() => { 
                    if (isMounted && lightRef.current) lightRef.current.intensity = 0; 
                }, 50);
            }
            setTimeout(trigger, 3000 + Math.random() * 6000);
        };
        trigger();
        return () => { isMounted = false; };
    }, []);
    return <pointLight ref={lightRef} position={[0, 40, -10]} distance={200} color="#cce6ff" intensity={0} />;
};
