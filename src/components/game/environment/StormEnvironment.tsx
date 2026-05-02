import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "@/src/state/useStore";
import { cinematicState } from "@/src/state/cinematicState";

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
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]} receiveShadow={!potatoMode && gameState !== 'SETUP'} frustumCulled={false}>
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
    meshRef.current.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 150);
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[null as any, null as any, ROCK_COUNT]} castShadow receiveShadow frustumCulled={false}>
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
const _occRaycaster = new THREE.Raycaster();
const _occDir = new THREE.Vector3();

const Forest = ({ potatoMode }: { potatoMode?: boolean }) => {
    const trunkRef    = useRef<THREE.InstancedMesh>(null);
    const topRef      = useRef<THREE.InstancedMesh>(null);
    const trunkMatRef = useRef<THREE.MeshStandardMaterial>(null);
    const topMatRef   = useRef<THREE.MeshStandardMaterial>(null);
    const dummy       = useMemo(() => new THREE.Object3D(), []);
    const treeData    = useRef<{x: number, z: number, s: number}[]>([]);

    useEffect(() => {
        if (treeData.current.length === 0) {
            for (let i = 0; i < TREE_COUNT; ) {
                let valid = false;
                let x = 0, z = 0, r = 0;
                
                // Try 50 times to find a valid spot
                for (let attempt = 0; attempt < 50; attempt++) {
                    r = 65 + Math.random() * 100; // Push them further out minimum radius
                    const angle = Math.random() * Math.PI * 2;
                    x = r * Math.cos(angle);
                    z = r * Math.sin(angle);
                    
                    // FIX: Camera orbits around X = -55 to 55. Keep trees strictly OUTSIDE this zone
                    // so they NEVER block the cinematic view
                    if (Math.abs(x) < 65) continue;

                    // FIX: Prevent trees from intersecting (pohon saling tembus)
                    let overlap = false;
                    for (let j = 0; j < i; j++) {
                        const dx = x - treeData.current[j].x;
                        const dz = z - treeData.current[j].z;
                        if (dx * dx + dz * dz < 100) { // minimum distance 10 meters between trees
                            overlap = true;
                            break;
                        }
                    }
                    if (!overlap) {
                        valid = true;
                        break;
                    }
                }
                
                if (valid) {
                    treeData.current.push({ x, z, s: 1.0 + Math.random() * 2.0 });
                    i++;
                } else {
                    // If we can't find a spot after 50 attempts, just force it to avoid infinite loop
                    treeData.current.push({ x: 100 + Math.random() * 50, z: 100 + Math.random() * 50, s: 1.0 });
                    i++;
                }
            }
        }
    }, []);

    useEffect(() => {
        if (!trunkRef.current || !topRef.current) return;
        const count = potatoMode ? Math.floor(TREE_COUNT / 2) : TREE_COUNT;
        for (let i = 0; i < count; i++) {
            const { x, z, s } = treeData.current[i];
            if (Math.abs(x) < 15) continue;
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
        trunkRef.current.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 150);
        topRef.current.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 150);
    }, [potatoMode, dummy]);

    // Per-frame occlusion — throttled + early exits for performance
    const occFrameRef = useRef(0);
    const occBlockedRef = useRef(false);

    useFrame(({ camera }, delta) => {
        const tMat = trunkMatRef.current;
        const cMat = topMatRef.current;
        if (!tMat || !cMat) return;

        // Use module-level import (no runtime require())
        const isActive = cinematicState.isActive;

        if (!isActive) {
            if (tMat.opacity < 0.99) {
                const restored = Math.min(1, tMat.opacity + delta * 4);
                tMat.opacity = restored; cMat.opacity = restored;
            }
            return;
        }

        // Early exit: camera overhead (Y > 28) — no side occlusion possible
        if (camera.position.y > 28) {
            if (tMat.opacity < 0.99) {
                const restored = Math.min(1, tMat.opacity + delta * 3);
                tMat.opacity = restored; cMat.opacity = restored;
            }
            return;
        }

        // OPTIMIZATION: Throttle raycast to every 30 frames (~2x/sec).
        // The opacity lerp is slow (delta*10) so the eye never notices delayed detection.
        occFrameRef.current++;
        if (occFrameRef.current % 30 === 0) {
            const camPos = camera.position;
            _occDir.set(
                cinematicState.focusX - camPos.x,
                cinematicState.focusY - camPos.y,
                cinematicState.focusZ - camPos.z
            );
            const dist = _occDir.length();
            if (dist > 0.1) {
                _occDir.divideScalar(dist);
                _occRaycaster.set(camPos, _occDir);
                _occRaycaster.far = dist + 1;
                // Only check top mesh (simpler cone > cylinder for trees)
                const hits = topRef.current ? _occRaycaster.intersectObject(topRef.current) : [];
                occBlockedRef.current = hits.length > 0;
            }
        }

        // Apply cached occlusion result every frame (just an opacity lerp — cheap)
        const target = occBlockedRef.current ? 0.1 : 1.0;
        const speed  = occBlockedRef.current ? 10  : 3;
        const next   = tMat.opacity + (target - tMat.opacity) * Math.min(1, delta * speed);
        tMat.opacity = next; cMat.opacity = next;
    });

    return (
        <group>
            <instancedMesh ref={trunkRef} args={[null as any, null as any, TREE_COUNT]} castShadow frustumCulled={false}>
                <cylinderGeometry args={[0.2, 0.4, 4, 6]} />
                <meshStandardMaterial
                    ref={trunkMatRef}
                    color="#4d2915"
                    onBeforeCompile={(s: any) => applyPainterlyStyle(s as any)}
                    transparent opacity={1} depthWrite={true}
                />
            </instancedMesh>
            <instancedMesh ref={topRef} args={[null as any, null as any, TREE_COUNT]} castShadow frustumCulled={false}>
                <coneGeometry args={[1, 2, 6]} />
                <meshStandardMaterial
                    ref={topMatRef}
                    color="#1a3d1a"
                    onBeforeCompile={(s: any) => applyPainterlyStyle(s as any)}
                    transparent opacity={1} depthWrite={true}
                />
            </instancedMesh>
        </group>
    );
};




// --- 2. GPU Accelerated Rain ---
/*
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

/*
const Rain = () => {
...
};

const Lightning = () => {
...
};
*/

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
    <instancedMesh ref={meshRef} args={[undefined, undefined, GRASS_COUNT]} frustumCulled={false}>
      <planeGeometry args={[0.3, 1.0, 1, 4]} />
      <primitive object={GrassMaterial} attach="material" />
    </instancedMesh>
  );
};


// --- Main Export ---
export const StormEnvironment = ({ baseDistance = 36, potatoMode = false }: { baseDistance?: number, potatoMode?: boolean, isCinematic?: boolean }) => {
  const setWeather = useStore(s => s.setWeather);
  const gameState = useStore(s => s.gameState);
  
  // Refs for smooth lighting transitions (ECS-style direct update)
  const hemiRef = useRef<THREE.HemisphereLight>(null!);
  const ambientRef = useRef<THREE.AmbientLight>(null!);
  const dirRef = useRef<THREE.DirectionalLight>(null!);
  const fogRef = useRef<THREE.Fog>(null!);
  
  const targetColor = useRef(new THREE.Color());

  const weatherRef = useRef(useStore.getState().weather);

  useEffect(() => {
    // Subscribe to weather changes without re-rendering the whole tree
    const unsub = useStore.subscribe((state: any) => {
      weatherRef.current = state.weather;
    });
    return unsub;
  }, []);

  const isSetup = gameState === 'SETUP';

  // 3. Performance Optimized Weather Transition System (Running like a Bitecs System)
  useFrame((_state, _delta) => {
    const weather = weatherRef.current;
    
    // Calculate target values based on current weather
    const isClear = weather === 'CLEAR';
    const isThunder = weather === 'THUNDER';
    
    const tHemi = isClear ? 8.0 : (isThunder ? 7.0 : 6.0);
    const tAmb  = isClear ? 5.0 : 4.0;
    const tDir  = isClear ? 40.0 : 25.0;
    
    // Smooth Lerp Intensities
    if (hemiRef.current) hemiRef.current.intensity = THREE.MathUtils.smoothstep(hemiRef.current.intensity, tHemi, 0.05);
    if (ambientRef.current) ambientRef.current.intensity = THREE.MathUtils.smoothstep(ambientRef.current.intensity, tAmb, 0.05);
    if (dirRef.current) dirRef.current.intensity = THREE.MathUtils.smoothstep(dirRef.current.intensity, tDir, 0.05);
    
    // Direct Fog Update - Make it very far away so it doesn't obscure the battle
    if (fogRef.current) {
        const targetFogCol = isClear ? "#ffffff" : "#cccccc";
        targetColor.current.set(targetFogCol);
        fogRef.current.color.lerp(targetColor.current, 0.05);
        fogRef.current.near = THREE.MathUtils.lerp(fogRef.current.near, 1000, 0.05);
        fogRef.current.far = THREE.MathUtils.lerp(fogRef.current.far, 5000, 0.05);
    }

  });

  // Random Weather Cycle Disabled
  useEffect(() => {
    setWeather('CLEAR');
  }, [setWeather]);

  if (potatoMode) {
      return (
        <group>
            <color attach="background" args={["#f0f5ff"]} />
            <hemisphereLight intensity={2.0} groundColor="#d70f0fff" />
            <ambientLight intensity={1.5} />
            <directionalLight position={[20, 100, 20]} intensity={3.0} castShadow={false} />
            <Terrain baseDistance={baseDistance} potatoMode={true} />
        </group>
      );
  }

  const initialWeather = weatherRef.current;

  return (
    <group>
      {/* 
         Optimization: Use a SINGLE Environment without a 'key' swap.
         Changing the files property still triggers a reload, but 
         doesn't destroy the component entirely.
      */}
      <Environment 
        files={initialWeather === 'CLEAR' ? "/qwantani_sunset_1k.exr" : "/qwantani_night_1k.exr"} 
        background={true} 
        environmentIntensity={1.5}
      />

      <hemisphereLight
        ref={hemiRef}
        intensity={1.2}
        color={"#ffffff"}
        groundColor={"#222222"}
      />
      
      <ambientLight ref={ambientRef} intensity={0.8} />
      
      <directionalLight
        ref={dirRef}
        position={[100, 40, -100]}
        intensity={4.5}
        castShadow={!isSetup}
        shadow-mapSize={isSetup ? [512, 512] : [1024, 1024]}
        shadow-camera-far={120}
        shadow-camera-near={1}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
      />
      
      <Terrain baseDistance={baseDistance} />
      <Grass baseDistance={baseDistance} />
      <Rock />
      <Forest potatoMode={potatoMode} />
      
      {/* <RainManager active={weatherRef.current !== 'CLEAR'} />
      <LightningManager active={weatherRef.current === 'THUNDER'} /> */}
      
      <fog ref={fogRef} attach="fog" args={["#111111", 80, 400]} />
    </group>
  );
};

// Weather sub-components disabled
