import React, { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";

// --- 1. Terrain Shader ---
const TerrainMaterial = new THREE.ShaderMaterial({
  uniforms: {
    baseColor: { value: new THREE.Color("#4a7c44") }, // Vibrant green
    peakColor: { value: new THREE.Color("#8fb386") }, // Light green/sunny
    baseDist: { value: 24.0 },
  },
  vertexShader: `
    varying float vElevation;
    varying vec2 vUv;

    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy) );
      vec2 x0 = v -   i + dot(i, C.xx);
      vec2 i1;
      i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m ; m = m*m ;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    uniform float baseDist;

    void main() {
      vUv = uv;
      vec3 pos = position;
      
      float dist = length(pos.xy);
      float mask = smoothstep(baseDist + 10.0, baseDist + 35.0, dist); 
      
      float elevation = snoise(pos.xy * 0.015) * 20.0;
      elevation += snoise(pos.xy * 0.04) * 5.0;
      elevation *= mask;
      
      pos.z += max(elevation, 0.0);
      vElevation = pos.z;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying float vElevation;
    varying vec2 vUv;
    uniform vec3 baseColor;
    uniform vec3 peakColor;

    void main() {
      float t = smoothstep(0.0, 20.0, vElevation);
      vec3 finalColor = mix(baseColor, peakColor, t);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
  wireframe: false,
});

const Terrain = ({ baseDistance }: { baseDistance: number }) => {
  useFrame(() => {
    TerrainMaterial.uniforms.baseDist.value = baseDistance;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow>
      <planeGeometry args={[300, 300, 80, 80]} />
      <primitive object={TerrainMaterial} attach="material" />
    </mesh>
  );
};


// --- 2. Heavy Rain Array ---
const RAIN_COUNT = 5000;

const Rain = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < RAIN_COUNT; i++) {
      dummy.position.set(
        (Math.random() - 0.5) * 200,
        Math.random() * 60,
        (Math.random() - 0.5) * 200
      );
      dummy.rotation.set(0.1, 0, -0.1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const array = meshRef.current.instanceMatrix.array as Float32Array;
    const fallSpeed = delta * 80;

    for (let i = 0; i < RAIN_COUNT; i++) {
        const idx = i * 16;
        array[idx + 12] += fallSpeed * 0.05; // X wind drift
        array[idx + 13] -= fallSpeed; // Y fall
        array[idx + 14] -= fallSpeed * 0.05; // Z wind drift

        if (array[idx + 13] < 0) {
            array[idx + 12] = (Math.random() - 0.5) * 200;
            array[idx + 13] = 60 + Math.random() * 20;
            array[idx + 14] = (Math.random() - 0.5) * 200;
        }
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]}>
      <cylinderGeometry args={[0.015, 0.015, 1.2, 3]} />
      <meshBasicMaterial color="#7a8ba8" transparent opacity={0.6} />
    </instancedMesh>
  );
};


// --- 3. Lightning Flash ---
const Lightning = () => {
  const lightRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    const trigger = () => {
      if (lightRef.current) {
        lightRef.current.intensity = 200 + Math.random() * 300;
        setTimeout(() => { if (lightRef.current) lightRef.current.intensity = 0; }, 50);

        if (Math.random() > 0.5) {
          setTimeout(() => {
            if (lightRef.current) lightRef.current.intensity = 150 + Math.random() * 150;
            setTimeout(() => { if (lightRef.current) lightRef.current.intensity = 0; }, 50);
          }, 100 + Math.random() * 100);
        }
      }
      setTimeout(trigger, 3000 + Math.random() * 6000);
    };

    const timer = setTimeout(trigger, 2000);
    return () => clearTimeout(timer);
  }, []);

  return <pointLight ref={lightRef} position={[0, 40, -10]} distance={200} decay={1.5} color="#cce6ff" intensity={0} castShadow={false} />;
};

// --- 4. Procedural Wind Swaying Grass ---
const GRASS_COUNT = 15000;
const GrassMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
  },
  vertexShader: `
    uniform float time;
    varying float vY;

    void main() {
      vY = position.y;
      
      // Calculate world pos using instance matrix
      vec4 worldPos = instanceMatrix * vec4(position, 1.0);
      
      // Wind simulation based on X/Z coordinates
      float wind = sin(time * 2.0 + worldPos.x * 0.1 + worldPos.z * 0.05) * 0.5;
      wind += sin(time * 3.5 + worldPos.x * 0.5) * 0.2;
      
      // Only the tips of the grass sway
      if (position.y > -0.5) {
        worldPos.x += wind * (position.y + 0.5) * 0.3;
        worldPos.z += wind * (position.y + 0.5) * 0.3;
      }
      
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying float vY;
    void main() {
      vec3 rootColor = vec3(0.15, 0.35, 0.15); // Sunny green roots
      vec3 tipColor = vec3(0.4, 0.8, 0.3); // Bright lime-green tips
      // normalize vY from [-0.5, 0.5] to [0, 1]
      float mixFactor = clamp((vY + 0.5) * 1.0, 0.0, 1.0);
      gl_FragColor = vec4(mix(rootColor, tipColor, mixFactor), 1.0);
    }
  `,
  side: THREE.DoubleSide
});

const Grass = ({ baseDistance }: { baseDistance: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    
    // Fill the flattened area (safely avoiding rugged hills)
    // baseDistance + 10 is the flat mask size
    const maxRadius = baseDistance + 10.0;
    
    let instanceIndex = 0;
    for (let i = 0; i < GRASS_COUNT * 2; i++) {
      if (instanceIndex >= GRASS_COUNT) break;

      const r = Math.sqrt(Math.random()) * maxRadius;
      const angle = Math.random() * Math.PI * 2;
      const x = r * Math.cos(angle);
      const z = r * Math.sin(angle);
      
      // Anti-congestion mask: don't spawn grass strictly exactly on the middle battlefield marching lanes
      if (Math.abs(x) < 18 && Math.abs(z) < baseDistance - 2) continue;

      dummy.position.set(x, -0.6, z); // Adjust Y based on grass geometry (plane default centers at 0)
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.set(1, 0.5 + Math.random() * 0.8, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(instanceIndex, dummy.matrix);
      instanceIndex++;
    }
    meshRef.current.count = instanceIndex;
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy, baseDistance]);

  useFrame((state) => {
    GrassMaterial.uniforms.time.value = state.clock.elapsedTime;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, GRASS_COUNT]}>
      <planeGeometry args={[0.3, 1.0, 1, 4]} />
      <primitive object={GrassMaterial} attach="material" />
    </instancedMesh>
  );
};


// --- Main Export ---
export const StormEnvironment = ({ baseDistance = 24 }: { baseDistance?: number }) => {
  return (
    <group>
      <Sky 
        sunPosition={[0, 100, 0]} 
        turbidity={1.0} 
        rayleigh={0.5} 
        mieCoefficient={0.005} 
        mieDirectionalG={0.8} 
      />
      <hemisphereLight 
        intensity={1.2} 
        color="#ffffff" 
        groundColor="#666666" 
      />
      <ambientLight intensity={0.5} />
      <directionalLight 
        position={[0, 100, 0]} 
        intensity={4.0} 
        color="#ffffff" 
        castShadow={false}
      />
      
      <Terrain baseDistance={baseDistance} />
      <Grass baseDistance={baseDistance} />
      {/* <Rain /> */}
      {/* <Lightning /> */}
      
      {/* Daylight fog - push it back so battlefield is clear */}
      <fog attach="fog" args={["#f0f5ff", 40, 250]} />
    </group>
  );
};
