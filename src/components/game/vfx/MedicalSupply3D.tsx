import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/src/state/useStore';

const PARTICLE_COUNT = 40;

const healingFieldShader = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color("#10b981") }, // Emerald green
    opacity: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform float time;
    uniform vec3 color;
    uniform float opacity;

    void main() {
      float dist = length(vUv - 0.5);
      
      // Pulsing rings logic
      float ring1 = smoothstep(0.4, 0.45, dist) * (1.0 - smoothstep(0.45, 0.5, dist));
      float ring2 = smoothstep(0.2, 0.25, dist) * (1.0 - smoothstep(0.25, 0.3, dist));
      
      float wave = fract(dist * 3.0 - time * 0.8);
      float glow = (1.0 - smoothstep(0.0, 0.5, dist)) * 0.4;
      
      float finalAlpha = (ring1 + ring2 + glow + (1.0 - wave) * 0.2) * opacity;
      
      gl_FragColor = vec4(color * 2.0, finalAlpha);
      if (gl_FragColor.a < 0.01) discard;
    }
  `
};

const ascendingParticleShader = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color("#6ee7b7") },
    seed: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    uniform float time;
    uniform float seed;
    
    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // Floating upwards logic
      float t = mod(time * 0.2 + seed, 1.0);
      pos.y += t * 15.0;
      
      // Wobble
      pos.x += sin(time + seed) * 0.5;
      pos.z += cos(time + seed) * 0.5;
      
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    uniform vec3 color;
    void main() {
      float dist = length(vUv - 0.5);
      float alpha = smoothstep(0.5, 0.2, dist);
      gl_FragColor = vec4(color * 3.0, alpha);
      if (gl_FragColor.a < 0.1) discard;
    }
  `
};

export const MedicalSupply3D = () => {
  const active = useStore(s => s.medicalSupplyActive);
  const fieldRef = useRef<THREE.Mesh>(null!);
  const particlesRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const fieldMat = useMemo(() => new THREE.ShaderMaterial({
    ...healingFieldShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  const particleMat = useMemo(() => new THREE.ShaderMaterial({
    ...ascendingParticleShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  // Initialize particles once
  useMemo(() => {
    // This is just to satisfy the instancedMesh requirement before useFrame
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.elapsedTime;
    fieldMat.uniforms.time.value = time;
    particleMat.uniforms.time.value = time;

    const targetOpacity = active ? 0.8 : 0.0;
    fieldMat.uniforms.opacity.value += (targetOpacity - fieldMat.uniforms.opacity.value) * delta * 2.0;

    if (particlesRef.current) {
        if (active) {
            particlesRef.current.visible = true;
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                dummy.position.set(
                    (Math.random() - 0.5) * 15, // Spread within radius
                    -2,
                    (Math.random() - 0.5) * 15
                );
                dummy.scale.setScalar(0.2 + Math.random() * 0.3);
                dummy.updateMatrix();
                particlesRef.current.setMatrixAt(i, dummy.matrix);
            }
            particlesRef.current.instanceMatrix.needsUpdate = true;
        } else {
            particlesRef.current.visible = false;
        }
    }

    if (fieldRef.current) {
        fieldRef.current.visible = fieldMat.uniforms.opacity.value > 0.01;
        fieldRef.current.rotation.z = time * 0.2;
    }
  });

  return (
    <group>
      {/* 10m Radius Healing Field on Ground (centered) */}
      <mesh ref={fieldRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.3, 0]}>
        <planeGeometry args={[20, 20]} />
        <primitive object={fieldMat} attach="material" />
      </mesh>

      {/* Rising Energy Particles */}
      <instancedMesh ref={particlesRef} args={[undefined, undefined, PARTICLE_COUNT]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <primitive object={particleMat} attach="material" />
      </instancedMesh>
    </group>
  );
};
