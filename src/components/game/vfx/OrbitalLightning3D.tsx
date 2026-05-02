import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '@/src/state/useStore';

const LIGHTNING_COUNT = 12;

const lightningShader = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color("#ffffff") },
    glowColor: { value: new THREE.Color("#3b82f6") },
    opacity: { value: 1.0 },
    seed: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    varying float vNoise;
    uniform float time;
    uniform float seed;

    float noise(vec2 p) {
      return fract(sin(dot(p + seed, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // Jagged shape logic - scaled up for "Colossal" feel
      float n = noise(vec2(pos.y * 2.0, time * 15.0));
      vNoise = n;
      
      if (uv.y > 0.02 && uv.y < 0.98) {
        pos.x += (n - 0.5) * 2.5; // Bigger deviation
        pos.z += (n - 0.5) * 2.5;
      }
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vNoise;
    uniform float time;
    uniform vec3 color;
    uniform vec3 glowColor;
    uniform float opacity;

    void main() {
      float dist = abs(vUv.x - 0.5) * 2.5;
      float alpha = clamp(1.0 - dist, 0.0, 1.0) * opacity;
      
      float flicker = step(0.2, fract(time * 20.0 + vNoise));
      
      // Multi-layered color: White core, blue/purple glow
      vec3 finalColor = mix(glowColor, color, (1.0 - dist * 0.8));
      finalColor *= (3.0 + flicker * 5.0); // Extreme intensity
      
      gl_FragColor = vec4(finalColor, alpha * flicker);
    }
  `
};

const groundShader = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color("#3b82f6") },
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
      float ring = smoothstep(0.45, 0.5, dist) * (1.0 - smoothstep(0.5, 0.55, dist));
      float center = (1.0 - smoothstep(0.0, 0.45, dist)) * 0.5;
      
      float pulse = 0.8 + 0.2 * sin(time * 10.0);
      gl_FragColor = vec4(color * 4.0, (ring + center) * opacity * pulse);
    }
  `
};

export const OrbitalLightning3D = () => {
  const active = useStore(s => s.orbitalLightningActive);
  const boltRefs = useRef<THREE.Mesh[]>([]);
  const groundRefs = useRef<THREE.Mesh[]>([]);

  const bolts = useMemo(() => {
    return Array.from({ length: LIGHTNING_COUNT }, () => ({
      pos: new THREE.Vector3(),
      visible: false,
      timer: 0,
    }));
  }, []);

  const boltMaterials = useMemo(() => {
    return Array.from({ length: LIGHTNING_COUNT }, () => new THREE.ShaderMaterial({
      ...lightningShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: THREE.UniformsUtils.clone(lightningShader.uniforms)
    }));
  }, []);

  const groundMaterials = useMemo(() => {
    return Array.from({ length: LIGHTNING_COUNT }, () => new THREE.ShaderMaterial({
      ...groundShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: THREE.UniformsUtils.clone(groundShader.uniforms)
    }));
  }, []);

  useFrame((state, delta) => {
    bolts.forEach((bolt, i) => {
      const bMat = boltMaterials[i];
      const gMat = groundMaterials[i];
      bMat.uniforms.time.value = state.clock.elapsedTime;
      gMat.uniforms.time.value = state.clock.elapsedTime;

      if (active && !bolt.visible && Math.random() < 0.03) {
        bolt.visible = true;
        bolt.timer = 0.4; // Longer strike
        bolt.pos.set(
          (Math.random() - 0.5) * 60, // Wider range
          25, 
          (Math.random() - 0.5) * 60  // Covers ALL area
        );
        bMat.uniforms.seed.value = Math.random() * 100;
      }

      if (bolt.visible) {
        bolt.timer -= delta;
        if (bolt.timer <= 0) {
          bolt.visible = false;
        }
      }

      const bMesh = boltRefs.current[i];
      const gMesh = groundRefs.current[i];

      if (bMesh && gMesh) {
        bMesh.visible = bolt.visible;
        gMesh.visible = bolt.visible;
        
        bMesh.position.copy(bolt.pos);
        // Colosal scale: 3x wider, 50 units high
        bMesh.scale.set(2.5, 50, 2.5); 
        
        gMesh.position.set(bolt.pos.x, 0.2, bolt.pos.z);
        gMesh.scale.setScalar(8 + Math.random() * 4); // Big impact circles
        
        // Fade out
        const op = Math.min(1.0, bolt.timer * 4.0);
        bMat.uniforms.opacity.value = op;
        gMat.uniforms.opacity.value = op;
      }
    });
  });

  return (
    <group>
      {bolts.map((_, i) => (
        <group key={i}>
          <mesh ref={el => { if(el) boltRefs.current[i] = el; }}>
            <cylinderGeometry args={[0.5, 0.8, 1, 6]} />
            <primitive object={boltMaterials[i]} attach="material" />
          </mesh>
          <mesh ref={el => { if(el) groundRefs.current[i] = el; }} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[1, 1]} />
            <primitive object={groundMaterials[i]} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
