import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "@/src/state/useStore";
import { useVFX } from "../systems/VFXManager";
import { applyPainterlyStyle, PainterlyShaderUtils } from "../systems/effects/PainterlyMaterials";


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
    ${PainterlyShaderUtils.brushstrokeNoise}
    ${PainterlyShaderUtils.toonMix}

    void main() {
      float strokes = brushstrokes(vUv * 100.0, 0.4);
      float t = smoothstep(0.0, 20.0, vElevation) + strokes * 0.1;
      vec3 finalColor = toonMix(baseColor, peakColor, t * 1.5);
      
      // Battlefield Road / Path (Z-axis focal point)
      float roadMask = smoothstep(6.0, 3.0, abs(vUv.x - 0.5) * 100.0);
      vec3 roadColor = vec3(0.5, 0.45, 0.4); // Dirt/Soil color
      finalColor = mix(finalColor, roadColor, roadMask * 0.4);
      
      gl_FragColor = vec4(finalColor, 1.0);
    }

  `,
  wireframe: false,
});

const Terrain = ({ baseDistance, potatoMode }: { baseDistance: number; potatoMode?: boolean }) => {
  const gameState = useStore(s => s.gameState);
  useFrame(() => {
    TerrainMaterial.uniforms.baseDist.value = baseDistance;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow={!potatoMode && gameState !== 'SETUP'}>
      <planeGeometry args={[400, 400, (potatoMode || gameState === 'SETUP') ? 1 : 40, (potatoMode || gameState === 'SETUP') ? 1 : 40]} />
      <primitive object={TerrainMaterial} attach="material" />
    </mesh>
  );
};

// --- 2. Environment Rocks ---
const ROCK_COUNT = 60;
const Rock = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    for (let i = 0; i < ROCK_COUNT; i++) {
        const r = 35 + Math.random() * 70;
        const angle = Math.random() * Math.PI * 2;
        const x = r * Math.cos(angle);
        const z = r * Math.sin(angle);
        
        if (Math.abs(x) < 12) continue;

        dummy.position.set(x, -0.2, z);
        dummy.rotation.set(Math.random(), Math.random(), Math.random());
        dummy.scale.setScalar(0.5 + Math.random() * 2.5);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, ROCK_COUNT]} castShadow receiveShadow>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial 
        color="#666666" 
        roughness={0.8} 
        onBeforeCompile={applyPainterlyStyle} 
      />
    </instancedMesh>

  );
};

// --- 3. Environment Trees ---
const TREE_COUNT = 120;
const Forest = ({ potatoMode }: { potatoMode?: boolean }) => {
    const trunkRef = useRef<THREE.InstancedMesh>(null);
    const topRef = useRef<THREE.InstancedMesh>(null);
    const dummy = useMemo(() => new THREE.Object3D(), []);

    useEffect(() => {
        if (!trunkRef.current || !topRef.current) return;
        const count = potatoMode ? Math.floor(TREE_COUNT / 2) : TREE_COUNT;
        for (let i = 0; i < count; i++) {
            const r = 45 + Math.random() * 100;
            const angle = Math.random() * Math.PI * 2;
            const x = r * Math.cos(angle);
            const z = r * Math.sin(angle);
            
            if (Math.abs(x) < 15) continue;

            const s = 1.0 + Math.random() * 2.0;

            dummy.position.set(x, 1, z);
            dummy.scale.set(s, s, s);
            dummy.updateMatrix();
            trunkRef.current.setMatrixAt(i, dummy.matrix);

            dummy.position.set(x, 4 * s, z);
            dummy.scale.set(s * 2, s * 3, s * 2);
            dummy.updateMatrix();
            topRef.current.setMatrixAt(i, dummy.matrix);
        }
        trunkRef.current.instanceMatrix.needsUpdate = true;
        topRef.current.instanceMatrix.needsUpdate = true;
    }, []);

    return (
        <group>
            <instancedMesh ref={trunkRef} args={[null as any, null as any, TREE_COUNT]} castShadow>
                <cylinderGeometry args={[0.2, 0.4, 4, 6]} />
                <meshStandardMaterial color="#4d2915" onBeforeCompile={(s: any) => applyPainterlyStyle(s as any)} />
            </instancedMesh>
            <instancedMesh ref={topRef} args={[null as any, null as any, TREE_COUNT]} castShadow>
                <coneGeometry args={[1, 2, 6]} />
                <meshStandardMaterial color="#1a3d1a" onBeforeCompile={(s: any) => applyPainterlyStyle(s as any)} />
            </instancedMesh>


        </group>
    );
};


// --- 2. GPU Accelerated Rain ---
const RAIN_COUNT = 500;
const RainMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
  },
  vertexShader: `
    uniform float time;
    void main() {
      vec4 worldPos = instanceMatrix * vec4(position, 1.0);
      float speed = 80.0;
      
      // Rain physics on GPU
      worldPos.y -= mod(time * speed + worldPos.y, 60.0);
      worldPos.x += mod(time * speed * 0.05, 5.0);
      worldPos.z -= mod(time * speed * 0.05, 5.0);
      
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    void main() {
      gl_FragColor = vec4(0.48, 0.54, 0.66, 0.6);
    }
  `,
  transparent: true,
});

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

  useFrame((state) => {
    RainMaterial.uniforms.time.value = state.clock.elapsedTime;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]}>
      <cylinderGeometry args={[0.015, 0.015, 1.2, 3]} />
      <primitive object={RainMaterial} attach="material" />
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

const GRASS_COUNT = 800;
const GrassMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    windStrength: { value: 1.0 },
  },
  vertexShader: `
    uniform float time;
    uniform float windStrength;
    varying float vY;

    void main() {
      vY = position.y;
      vec4 worldPos = instanceMatrix * vec4(position, 1.0);
      
      float wind = sin(time * (2.0 * windStrength) + worldPos.x * 0.1 + worldPos.z * 0.05) * 0.5 * windStrength;
      wind += sin(time * (3.5 * windStrength) + worldPos.x * 0.5) * 0.2 * windStrength;
      
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
  const weather = useStore(s => s.weather);

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
        
        if (Math.abs(x) < 18 && Math.abs(z) < baseDistance - 2) continue;

        dummy.position.set(x, -0.6, z);
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
    const targetWind = (weather === 'STORM' || weather === 'THUNDER') ? 2.5 : 1.0;
    GrassMaterial.uniforms.windStrength.value = THREE.MathUtils.lerp(GrassMaterial.uniforms.windStrength.value, targetWind, 0.05);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, GRASS_COUNT]}>
      <planeGeometry args={[0.3, 1.0, 1, 4]} />
      <primitive object={GrassMaterial} attach="material" />
    </instancedMesh>
  );
};


// --- Main Export ---
export const StormEnvironment = ({ baseDistance = 24, potatoMode = false }: { baseDistance?: number, potatoMode?: boolean }) => {
  const weather = useStore(s => s.weather);
  const setWeather = useStore(s => s.setWeather);
  const gameState = useStore(s => s.gameState);
  const isSetup = gameState === 'SETUP';
  const { spawnVFX } = useVFX();

  // Atmospheric Particles Spawning
  useFrame((state) => {
    if (isSetup || potatoMode) return;
    
    // Spawn atmospheric particles every ~100-200ms
    if (state.clock.elapsedTime % 0.2 < 0.02) {
      if (weather === 'CLEAR') {
        // Dust motes in sun
        const x = (Math.random() - 0.5) * 60;
        const z = (Math.random() - 0.5) * 60;
        spawnVFX([x, 1 + Math.random() * 5, z], 'dust-mote', '#ffffff');
      } else if (weather === 'RAIN' || weather === 'STORM' || weather === 'THUNDER') {
        // Mist during rain
        const x = (Math.random() - 0.5) * 80;
        const z = (Math.random() - 0.5) * 80;
        spawnVFX([x, 0.5, z], 'environment-mist', weather === 'THUNDER' ? '#a855f7' : '#ffffff');
      }
    }
  });

  // Random Weather Cycle
  useEffect(() => {
    if (isSetup) return; // Don't cycle weather during setup
    const cycle = () => {
      const weathers: ("CLEAR" | "RAIN" | "STORM" | "THUNDER")[] = ["CLEAR", "RAIN", "STORM", "THUNDER"];
      const next = weathers[Math.floor(Math.random() * weathers.length)];
      setWeather(next);
      setTimeout(cycle, 15000 + Math.random() * 20000); // 15-35s cycle
    };
    const timer = setTimeout(cycle, 40000); // Slower cycle
    return () => clearTimeout(timer);
  }, [setWeather]);

  if (potatoMode) {
      return (
        <group>
            <color attach="background" args={["#f0f5ff"]} />
            <hemisphereLight intensity={1.5} groundColor="#444444" />
            <ambientLight intensity={0.8} />
            <directionalLight position={[20, 100, 20]} intensity={1.5} castShadow={false} />
            <Terrain baseDistance={baseDistance} potatoMode={true} />
        </group>
      );
  }

  return (
    <group>
      <Sky 
        sunPosition={weather === 'CLEAR' ? [0, 100, 0] : [0, -10, 0]} 
        turbidity={weather === 'CLEAR' ? 1.0 : 10} 
        rayleigh={weather === 'CLEAR' ? 0.5 : 2} 
        mieCoefficient={0.005} 
        mieDirectionalG={0.8} 
      />
      <hemisphereLight 
        intensity={weather === 'CLEAR' ? 1.2 : 0.8} 
        color={weather === 'THUNDER' ? "#cfe2ff" : "#ffffff"} 
        groundColor="#444444" 
      />
      <ambientLight intensity={weather === 'CLEAR' ? 0.6 : 0.5} />
      <directionalLight 
        position={[20, 100, 20]} 
        intensity={weather === 'CLEAR' ? 4.5 : 1.5} 
        color={weather === 'RAIN' ? "#d1e9ff" : "#ffffff"} 
        castShadow={!isSetup}
        shadow-mapSize={isSetup ? [512, 512] : [1024, 1024]}
      />
      
      <Terrain baseDistance={baseDistance} />
      <Grass baseDistance={baseDistance} />
      <Rock />
      <Forest />
      
      {(weather === 'RAIN' || weather === 'THUNDER') && <Rain />}
      {weather === 'THUNDER' && <Lightning />}
      
      <fog attach="fog" args={[weather === 'CLEAR' ? "#f0f5ff" : "#1a1a1a", weather === 'CLEAR' ? 80 : 35, weather === 'CLEAR' ? 350 : 160]} />
    </group>
  );
};
