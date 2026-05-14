/**
 * StormEnvironment — Open World Edition (Physics Stabilized)
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { StaticCollider, characterStatus } from "bvhecctrl";

import * as THREE from "three";
import { useStore } from "@/src/state/useStore";
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import { useVFX } from "../systems/VFXManager";
import { applyPainterlyStyle, PainterlyShaderUtils } from "../systems/effects/PainterlyMaterials";

// Add BVH support to THREE with any cast to avoid lint errors
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

const TerrainMaterial = new THREE.ShaderMaterial({
  uniforms: {
    baseColor: { value: new THREE.Color("#4a7c44") },
    peakColor: { value: new THREE.Color("#8fb386") },
    rockColor: { value: new THREE.Color("#6b7c5a") },
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

const Terrain = ({ baseDistance, potatoMode }: { baseDistance: number; potatoMode?: boolean }) => {
  const gameState = useStore(s => s.gameState);
  const isSetup   = gameState === "SETUP";

  // Compute terrain geometry on CPU to ensure physics matches visuals perfectly
  const terrainGeo = useMemo(() => {
    const segs = isSetup ? 12 : (potatoMode ? 24 : 48); // Optimize segments
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
    const pos = geo.attributes.position;
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const elevation = getTerrainElevation(x, y, "STORM", baseDistance);
        pos.setZ(i, elevation);
    }
    geo.computeVertexNormals();
    (geo as any).computeBoundsTree(); // CRITICAL: Enables collision for BVHEcctrl
    return geo;
  }, [baseDistance, isSetup, potatoMode]);

  return (
    <StaticCollider>
      <mesh 
        geometry={terrainGeo} 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, GROUND_Y, 0]} 
        receiveShadow={!potatoMode && !isSetup}
      >
        <primitive object={TerrainMaterial} attach="material" />
      </mesh>
    </StaticCollider>
  );
};

const MOUNTAIN_COUNT = 48;
const MountainMaterial = new THREE.MeshStandardMaterial({
  color: "#3a4a35",
  roughness: 1,
  flatShading: true,
});

const DistantMountains = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    for (let i = 0; i < MOUNTAIN_COUNT; i++) {
      const angle  = (i / MOUNTAIN_COUNT) * Math.PI * 2 + Math.random() * 0.3;
      const radius = 600 + Math.random() * 400;
      const scaleH = 40 + Math.random() * 80;
      const scaleW = 30 + Math.random() * 50;

      dummy.position.set(Math.cos(angle) * radius, scaleH * 0.3 - 0.6, Math.sin(angle) * radius);
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.scale.set(scaleW, scaleH, scaleW);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MOUNTAIN_COUNT]} frustumCulled>
      <coneGeometry args={[1, 1, 6]} />
      <primitive object={MountainMaterial} attach="material" />
    </instancedMesh>
  );
};

const ROCK_COUNT = 40;

const RockMat    = new THREE.MeshStandardMaterial({ color: "#6b7060", roughness: 0.85 });
RockMat.onBeforeCompile  = applyPainterlyStyle as any;

const Rocks = ({ potatoMode }: { potatoMode?: boolean }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy   = useMemo(() => new THREE.Object3D(), []);
  const count   = potatoMode ? Math.floor(ROCK_COUNT / 3) : ROCK_COUNT;

  useEffect(() => {
    let placed = 0;
    for (let i = 0; placed < count && i < count * 4; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 15 + Math.random() * 485;
      const x      = Math.cos(angle) * radius;
      const z      = Math.sin(angle) * radius;

      if (Math.abs(x) < 14 && Math.abs(z) < 30) continue;

      const s = 0.3 + Math.random() * 2.5;
      dummy.position.set(x, s * 0.4 - 0.6, z);
      dummy.rotation.set(Math.random(), Math.random() * Math.PI * 2, Math.random());
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    meshRef.current.count = placed;
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, dummy]);

  return (
    <StaticCollider>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow frustumCulled>
        <dodecahedronGeometry args={[1, 0]} />
        <primitive object={RockMat} attach="material" />
      </instancedMesh>
    </StaticCollider>
  );
};

const GRASS_COUNT  = 600;

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

const StaticGrass = ({ potatoMode }: { potatoMode?: boolean }) => {
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

    for (let row = 0; row < cols && idx < count; row++) {
      for (let col = 0; col < cols && idx < count; col++) {
        const x = -half + col * spacing + (Math.random() - 0.5) * spacing * 0.9;
        const z = -half + row * spacing + (Math.random() - 0.5) * spacing * 0.9;

        if (Math.abs(x) < 14 && Math.abs(z) < 60) continue;

        const elevation = getTerrainElevation(x, z, "STORM", 24) - 0.3; // baseDistance logic needs to match
        dummy.position.set(x, elevation, z);
        dummy.rotation.y = Math.random() * Math.PI;
        dummy.scale.set(0.8 + Math.random() * 0.6, 0.35 + Math.random() * 0.85, 0.8 + Math.random() * 0.6);
        dummy.updateMatrix();
        mesh.setMatrixAt(idx++, dummy.matrix);
      }
    }
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
  }, [count, dummy]);

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

const RAIN_COUNT   = 600;
const RainMaterial = new THREE.ShaderMaterial({
  uniforms: { time: { value: 0 } },
  vertexShader: `
    uniform float time;
    void main() {
      vec4 w = instanceMatrix * vec4(position, 1.0);
      w.y -= mod(time * 80.0 + w.y, 80.0);
      w.x += mod(time * 4.0, 6.0);
      w.z -= mod(time * 4.0, 6.0);
      gl_Position = projectionMatrix * viewMatrix * w;
    }
  `,
  fragmentShader: `void main() { gl_FragColor = vec4(0.48, 0.54, 0.66, 0.5); }`,
  transparent: true,
});

const Rain = () => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy   = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    for (let i = 0; i < RAIN_COUNT; i++) {
      dummy.position.set((Math.random() - 0.5) * 300, Math.random() * 80, (Math.random() - 0.5) * 300);
      dummy.rotation.set(0.1, 0, -0.08);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  useFrame(s => (RainMaterial.uniforms.time.value = s.clock.elapsedTime));

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, RAIN_COUNT]}>
      <cylinderGeometry args={[0.012, 0.012, 1.2, 3]} />
      <primitive object={RainMaterial} attach="material" />
    </instancedMesh>
  );
};

const Lightning = () => {
  const lightRef = useRef<THREE.PointLight>(null!);
  useEffect(() => {
    const trigger = () => {
      if (!lightRef.current) return;
      lightRef.current.intensity = 200 + Math.random() * 300;
      setTimeout(() => { if (lightRef.current) lightRef.current.intensity = 0; }, 50);
      setTimeout(trigger, 4000 + Math.random() * 8000);
    };
    const t = setTimeout(trigger, 3000);
    return () => clearTimeout(t);
  }, []);
  return <pointLight ref={lightRef} position={[0, 60, -20]} distance={500} color="#cce6ff" intensity={0} />;
};

export const StormEnvironment = ({ baseDistance = 24, potatoMode = false }: { baseDistance?: number; potatoMode?: boolean; }) => {
  const weather    = useStore(s => s.weather);
  const setWeather = useStore(s => s.setWeather);
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

  const fogNear = weather === "CLEAR" ? 120 : 60;
  const fogFar  = weather === "CLEAR" ? 1200 : 400;
  const fogColor = weather === "CLEAR" ? "#c8dff0" : "#1a1a1a";

  return (
    <group>
      <Sky
        sunPosition={weather === "CLEAR" ? [10, 100, 10] : [0, -10, 0]}

        turbidity={weather === "CLEAR" ? 2 : 12}
        rayleigh={weather === "CLEAR" ? 0.8 : 3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <hemisphereLight intensity={weather === "CLEAR" ? 1.2 : 0.6} color={weather === "THUNDER" ? "#cfe2ff" : "#ffffff"} groundColor="#445544" />
      <ambientLight intensity={1.2} />

      <directionalLight
        position={[10, 100, 10]}
        intensity={weather === "CLEAR" ? 8.0 : 1.2}

        castShadow={!isSetup}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0001}


        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />

      <Terrain baseDistance={baseDistance} />
      <Rocks potatoMode={potatoMode} />
      <StaticGrass potatoMode={potatoMode} />
      <DistantMountains />
      {(weather === "RAIN" || weather === "THUNDER") && <Rain />}
      {weather === "THUNDER" && <Lightning />}
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
    </group>
  );
};
