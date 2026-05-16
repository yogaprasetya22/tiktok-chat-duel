/**
 * StormEnvironment — Open World Edition (Physics Stabilized)
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { StaticCollider, characterStatus } from "bvhecctrl";

import * as THREE from "three";
import { useStore } from "@/src/state/useStore";
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import { useVFX } from "../systems/VFXManager";
import { applyPainterlyStyle, PainterlyShaderUtils } from "../systems/effects/PainterlyMaterials";
import { InstancedTrees } from "./effects/InstancedTrees";
import { registerCollider, unregisterCollider } from "@/src/core/utils/globalRaycaster";

// Add BVH support to THREE with any cast to avoid lint errors
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

const TerrainMaterial = new THREE.ShaderMaterial({
  uniforms: {
    baseColor: { value: new THREE.Color("#3d5c36") }, // Deeper forest green
    peakColor: { value: new THREE.Color("#95b58b") }, // Softer peak
    rockColor: { value: new THREE.Color("#5a5e52") }, // Darker rock
  },
  vertexShader: `
    varying float vElevation;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vElevation = position.z; // Elevation is already applied to geometry Z
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying float vElevation;
    varying vec2 vUv;
    uniform vec3 baseColor;
    uniform vec3 peakColor;
    uniform vec3 rockColor;
    ${PainterlyShaderUtils.brushstrokeNoise}
    ${PainterlyShaderUtils.toonMix}

    void main() {
      float strokes = brushstrokes(vUv * 80.0, 0.35);
      float t = smoothstep(0.0, 35.0, vElevation) + strokes * 0.08;
      vec3 finalColor = toonMix(baseColor, peakColor, t * 1.5);

      float rockMask = smoothstep(22.0, 35.0, vElevation);
      finalColor = mix(finalColor, rockColor, rockMask * 0.6);

      float road = smoothstep(6.0, 3.0, abs(vUv.x - 0.5) * 150.0);
      finalColor = mix(finalColor, vec3(0.5, 0.45, 0.4), road * 0.4);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
});

const TERRAIN_SIZE = 1500;
const GROUND_Y     = -0.3;

const Terrain = ({ baseDistance, potatoMode, debug, onReady }: {
  baseDistance: number;
  potatoMode?: boolean;
  debug?: boolean;
  onReady?: () => void;
}) => {
  // CRITICAL FIX: Do NOT use isSetup as a dependency.
  // When gameState changes SETUP -> PLAYING, terrain geometry was being rebuilt from scratch.
  // During the rebuild window, the old BVH was disposed but the new one not yet registered,
  // causing the character to fall through the map.
  // We now always build at full resolution and never rebuild on game state change.
  const terrainGeo = useMemo(() => {
    const segs = potatoMode ? 64 : 128;
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
    const pos = geo.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const elevation = getTerrainElevation(x, y, "STORM", baseDistance);
        pos.setZ(i, elevation);
    }
    geo.computeVertexNormals();
    (geo as any).computeBoundsTree({ maxDepth: 64, maxLeafTris: 5 });
    return geo;
  }, [baseDistance, potatoMode]); // REMOVED isSetup — this was the root cause!

  // Signal parent that terrain BVH is ready (1 frame after mount)
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(id);
  }, [terrainGeo, onReady]);

  const meshRef = useRef<THREE.Mesh>(null!);
  
  useEffect(() => {
    if (meshRef.current) {
      registerCollider(meshRef.current);
      return () => unregisterCollider(meshRef.current);
    }
  }, [terrainGeo]);

  return (
    <mesh 
      ref={meshRef}
      geometry={terrainGeo} 
      rotation={[-Math.PI / 2, 0, 0]} 
      position={[0, GROUND_Y, 0]} 
      receiveShadow={!potatoMode}
    >
      <primitive object={TerrainMaterial} attach="material" wireframe={debug} />
    </mesh>
  );
};

const MOUNTAIN_COUNT = 48;
const MountainMaterial = new THREE.MeshStandardMaterial({
  color: "#2a3a25", // Darker, more distant feel
  roughness: 1,
  flatShading: true,
});

const DistantMountains = () => {
  const mergedGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const dummy = new THREE.Object3D();

    for (let i = 0; i < MOUNTAIN_COUNT; i++) {
      const angle  = (i / MOUNTAIN_COUNT) * Math.PI * 2 + i * 0.3; // Deterministic random
      const radius = 600 + (Math.sin(i) * 0.5 + 0.5) * 400;
      const scaleH = 40 + (Math.cos(i) * 0.5 + 0.5) * 80;
      const scaleW = 30 + (Math.sin(i * 2) * 0.5 + 0.5) * 50;

      dummy.position.set(Math.cos(angle) * radius, scaleH * 0.3 - 0.6, Math.sin(angle) * radius);
      dummy.rotation.y = i * 0.5;
      dummy.scale.set(scaleW, scaleH, scaleW);
      dummy.updateMatrix();

      const cone = new THREE.ConeGeometry(1, 1, 6);
      cone.applyMatrix4(dummy.matrix);
      geometries.push(cone);
    }

    const merged = BufferGeometryUtils.mergeGeometries(geometries);
    (merged as any).computeBoundsTree();
    return merged;
  }, []);

  const meshRef = useRef<THREE.Mesh>(null!);
  
  useEffect(() => {
    if (meshRef.current) {
      registerCollider(meshRef.current);
      return () => unregisterCollider(meshRef.current);
    }
  }, [mergedGeo]);

  return (
    <mesh ref={meshRef} geometry={mergedGeo}>
      <primitive object={MountainMaterial} attach="material" />
    </mesh>
  );
};

const ROCK_COUNT = 40;

const RockMat    = new THREE.MeshStandardMaterial({ color: "#6b7060", roughness: 0.85 });
RockMat.onBeforeCompile  = applyPainterlyStyle as any;

const Rocks = ({ potatoMode }: { potatoMode?: boolean }) => {
  const count = potatoMode ? Math.floor(ROCK_COUNT / 3) : ROCK_COUNT;

  const mergedGeo = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    const dummy = new THREE.Object3D();
    let placed = 0;

    for (let i = 0; placed < count && i < count * 4; i++) {
      const angle = (i * 0.77); // Deterministic
      const radius = 15 + (Math.sin(i) * 0.5 + 0.5) * 485;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      if (Math.abs(x) < 14 && Math.abs(z) < 30) continue;

      const s = 0.3 + (Math.cos(i) * 0.5 + 0.5) * 2.5;
      dummy.position.set(x, s * 0.4 - 0.6, z);
      dummy.rotation.set(i * 0.1, i * 0.2, i * 0.3);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();

      const geo = new THREE.DodecahedronGeometry(1, 0);
      geo.applyMatrix4(dummy.matrix);
      geometries.push(geo);
      placed++;
    }

    const merged = BufferGeometryUtils.mergeGeometries(geometries);
    (merged as any).computeBoundsTree();
    return merged;
  }, [count]);

  const meshRef = useRef<THREE.Mesh>(null!);
  useEffect(() => {
    if (meshRef.current) {
      registerCollider(meshRef.current);
      return () => unregisterCollider(meshRef.current);
    }
  }, [mergedGeo]);

  return (
    <mesh ref={meshRef} geometry={mergedGeo} castShadow receiveShadow>
      <primitive object={RockMat} attach="material" />
    </mesh>
  );
};

const GRASS_COUNT  = 1800; // Increased for density

const GRASS_AREA   = 500;

const GrassMat = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 }, windStrength: { value: 1.0 } },
  vertexShader: `
    uniform float time; uniform float windStrength;
    varying float vY;
    void main() {
      vY = position.y;
      vec4 world = instanceMatrix * vec4(position, 1.0);
      if (position.y > -0.4) {
        float w = sin(time * 2.0 * windStrength + world.x * 0.1 + world.z * 0.07) * 0.4 * windStrength;
        world.x += w * (position.y + 0.5) * 0.4;
        world.z += w * (position.y + 0.5) * 0.2;
      }
      gl_Position = projectionMatrix * viewMatrix * world;
    }
  `,
  fragmentShader: `
    varying float vY;
    void main() {
      float t = clamp((vY + 0.5), 0.0, 1.0);
      vec3 c = mix(vec3(0.1, 0.28, 0.1), vec3(0.35, 0.75, 0.2), t);
      gl_FragColor = vec4(c, 1.0);
    }
  `,
  side: THREE.DoubleSide,
});

const StaticGrass = ({ potatoMode, baseDistance = 24 }: { potatoMode?: boolean, baseDistance?: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const weather = useStore(s => s.weather);
  const count   = potatoMode ? Math.floor(GRASS_COUNT / 4) : GRASS_COUNT;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const cols = Math.ceil(Math.sqrt(count));
    const spacing = GRASS_AREA / cols;
    const half = GRASS_AREA / 2;
    let idx = 0;

    // Seeded random for stable placement
    let seed = 99;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let row = 0; row < cols && idx < count; row++) {
      for (let col = 0; col < cols && idx < count; col++) {
        const x = -half + col * spacing + (rnd() - 0.5) * spacing * 0.9;
        const z = -half + row * spacing + (rnd() - 0.5) * spacing * 0.9;

        if (Math.abs(x) < 14 && Math.abs(z) < 60) continue;

        // CRITICAL FIX: Match PlaneGeometry -z rotation mapping
        const elevation = getTerrainElevation(x, -z, "STORM", baseDistance);

        // Do not place grass on mountains!
        if (elevation > 0.5) continue;

        dummy.position.set(x, elevation - 0.3, z);
        dummy.rotation.y = rnd() * Math.PI;
        dummy.scale.set(0.8 + rnd() * 0.6, 0.35 + rnd() * 0.85, 0.8 + rnd() * 0.6);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    
    // Prevent disappearing from camera
    mesh.computeBoundingSphere();
  }, [count, dummy, baseDistance]); // Added baseDistance to deps

  useFrame(state => {
    GrassMat.uniforms.time.value = state.clock.elapsedTime;
    const windTarget = (weather === "STORM" || weather === "THUNDER") ? 2.5 : 1.0;
    GrassMat.uniforms.windStrength.value = THREE.MathUtils.lerp(GrassMat.uniforms.windStrength.value, windTarget, 0.03);
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled>
      <planeGeometry args={[0.3, 1.0, 1, 4]} />
      <primitive object={GrassMat} attach="material" />
    </instancedMesh>
  );
};



export const StormEnvironment = ({ baseDistance = 24, potatoMode = false, debug = false, onReady }: {
  baseDistance?: number;
  potatoMode?: boolean;
  debug?: boolean;
  onReady?: () => void;
}) => {
  const weather    = useStore(s => s.weather);
  const gameState  = useStore(s => s.gameState);
  const isSetup    = gameState === "SETUP";
  const { spawnVFX } = useVFX();

  useFrame(state => {
    if (isSetup || potatoMode) return;
    if (state.clock.elapsedTime % 0.25 < 0.025) {
      if (characterStatus && characterStatus.position) {
          const px = characterStatus.position.x;
          const pz = characterStatus.position.z;
          if (weather === "CLEAR") {
            spawnVFX([px + (Math.random()-0.5)*60, 1+Math.random()*5, pz + (Math.random()-0.5)*60], "dust-mote", "#ffffff");
          } else if (weather === "THUNDER") {
            spawnVFX([px + (Math.random()-0.5)*80, 0.5, pz + (Math.random()-0.5)*80], "environment-mist", "#a855f7");
          }
      }
    }
  });

  // DISABLED: Weather rotation hidden to maintain permanent daytime
  /*
  useEffect(() => {
    if (isSetup) return;
    const cycle = () => {
      const opts = ["CLEAR","RAIN","STORM","THUNDER"] as const;
      setWeather(opts[Math.floor(Math.random() * opts.length)]);
      setTimeout(cycle, 20000 + Math.random() * 30000);
    };
    const t = setTimeout(cycle, 60000);
    return () => clearTimeout(t);
  }, [setWeather, isSetup]);
  */



  if (potatoMode) {
    return (
      <group>
        <color attach="background" args={["#c8d8f0"]} />
        <hemisphereLight intensity={1.5} groundColor="#556655" />
        <ambientLight intensity={0.8} />
        <Terrain baseDistance={baseDistance} potatoMode />
      </group>
    );
  }

  const fogNear = 120;
  const fogFar  = 1200;
  const fogColor = "#c8dff0";

  return (
    <group>
      <Environment 
        files="/qwantani_sunset_1k.exr"
        background
        blur={0}
      />
      <hemisphereLight intensity={2.5} color="#ffffff" groundColor="#445544" />
      <ambientLight intensity={3.0} />

      <directionalLight
        position={[10, 100, 10]}
        intensity={8.0}

        castShadow={!isSetup}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0001}


        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />

      <StaticCollider 
        debug={debug}
        BVHOptions={{
          strategy: 1, // SAH
          maxDepth: 64,
          maxLeafTris: 5,
          verbose: false
        }}
      >
        <Terrain baseDistance={baseDistance} debug={debug} onReady={onReady} />
        <Rocks potatoMode={potatoMode} />
        <DistantMountains />
      </StaticCollider>
      
      <StaticGrass potatoMode={potatoMode} baseDistance={baseDistance} />
      <InstancedTrees mode="STORM" baseDistance={baseDistance} />
      {/* Rain and Lightning disabled for permanent daytime */}
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
    </group>
  );
};
