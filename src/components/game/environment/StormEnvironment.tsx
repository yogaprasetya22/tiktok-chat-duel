/**
 * StormEnvironment — Open World Edition
 *
 * Arsitektur:
 *  - Ground StaticCollider: Satu plane FLAT 2000×2000 → BVH ringan, collision solid
 *  - Visual terrain: ShaderMaterial dengan noise displacement (hanya visual, tidak
 *    mempengaruhi collision karena BVH baca buffer asli yang flat)
 *  - Instancing untuk semua props (trees, rocks, grass) → GPU render, bukan CPU
 *  - Distant Mountains: ring geometry dekoratif di radius jauh, tanpa collider
 *  - Follow-Grass: repositioned setiap n detik di sekitar player → ilusi infinite grass
 *  - Fog extended untuk open world feel
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Sky } from "@react-three/drei";
import { StaticCollider } from "bvhecctrl";
import * as THREE from "three";
import { useStore } from "@/src/state/useStore";
import { useVFX } from "../systems/VFXManager";
import { applyPainterlyStyle, PainterlyShaderUtils } from "../systems/effects/PainterlyMaterials";
import { characterStatus } from "bvhecctrl";

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN SHADER (ShaderMaterial — visual displacement saja, bukan geometry)
// StaticCollider tetap membaca flat plane geometry → BVH build cepat
// ─────────────────────────────────────────────────────────────────────────────
const TerrainMaterial = new THREE.ShaderMaterial({
  uniforms: {
    baseColor: { value: new THREE.Color("#4a7c44") },
    peakColor: { value: new THREE.Color("#8fb386") },
    rockColor: { value: new THREE.Color("#6b7c5a") },
    baseDist:  { value: 24.0 },
  },
  vertexShader: `
    varying float vElevation;
    varying vec2 vUv;

    vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
    float snoise(vec2 v){
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod(i, 289.0);
      vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x2 = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x2) - 0.5;
      vec3 ox = floor(x2 + 0.5);
      vec3 a0 = x2 - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x = a0.x * x0.x + h.x * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    uniform float baseDist;

    void main() {
      vUv = uv;
      vec3 pos = position;

      float dist = length(pos.xy);
      // Flat battle arena di tengah, terrain mulai naik mulai dist > baseDist+10
      float mask = smoothstep(baseDist + 10.0, baseDist + 60.0, dist);

      // Multi-octave noise untuk variasi terrain yang natural
      float elevation = snoise(pos.xy * 0.008) * 35.0;  // bukit besar
      elevation += snoise(pos.xy * 0.025) * 10.0;        // medium undulation
      elevation += snoise(pos.xy * 0.08)  * 3.0;         // detail kecil
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
    uniform vec3 rockColor;
    ${PainterlyShaderUtils.brushstrokeNoise}
    ${PainterlyShaderUtils.toonMix}

    void main() {
      float strokes = brushstrokes(vUv * 80.0, 0.35);
      float t = smoothstep(0.0, 35.0, vElevation) + strokes * 0.08;
      vec3 finalColor = toonMix(baseColor, peakColor, t * 1.5);

      // Batu di puncak bukit
      float rockMask = smoothstep(22.0, 35.0, vElevation);
      finalColor = mix(finalColor, rockColor, rockMask * 0.6);

      // Jalan di tengah (Z axis)
      float road = smoothstep(6.0, 3.0, abs(vUv.x - 0.5) * 150.0);
      finalColor = mix(finalColor, vec3(0.5, 0.45, 0.4), road * 0.4);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
  wireframe: false,
});

// ─────────────────────────────────────────────────────────────────────────────
// TERRAIN — visual mesh + StaticCollider pada geometry FLAT
// Perhatian: StaticCollider membaca buffer geometry yang flat (tanpa shader displacement)
// Ini berarti BVH build O(1) dan collision tetap solid pada permukaan datar
// ─────────────────────────────────────────────────────────────────────────────
const TERRAIN_SIZE = 2000;
const GROUND_Y     = -0.6;

// ─────────────────────────────────────────────────────────────────────────────
// JAWABAN: Kenapa GLSL tidak bisa collision?
// ─────────────────────────────────────────────────────────────────────────────
// GLSL vertex shader mengubah posisi vertex di GPU, tapi BufferGeometry.attributes.position
// (yang dibaca CPU dan StaticCollider) TIDAK berubah. BVH dibangun dari data CPU,
// bukan dari posisi GPU. Jadi collision selalu berdasarkan geometri ASLI (flat plane).
//
// Solusi BENAR: gunakan BoxGeometry yang sudah di-applyMatrix4()
// → posisi vertex di CPU sudah benar di world space
// → StaticCollider tidak perlu transform tambahan
// → BVH pasti valid
// ─────────────────────────────────────────────────────────────────────────────

// Buat ground geometry sekali saja di module level (bukan di dalam komponen)
// applyMatrix4 langsung mengubah vertex buffer → BVH membaca posisi yang benar
const groundCollisionGeo = (() => {
  const geo = new THREE.BoxGeometry(TERRAIN_SIZE, 1, TERRAIN_SIZE);
  // Geser agar permukaan atas box ada di y = GROUND_Y
  geo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, GROUND_Y - 0.5, 0));
  return geo;
})();

const Terrain = ({ baseDistance, potatoMode }: { baseDistance: number; potatoMode?: boolean }) => {
  const gameState = useStore(s => s.gameState);
  const isSetup   = gameState === "SETUP";

  useFrame(() => {
    TerrainMaterial.uniforms.baseDist.value = baseDistance;
  });

  const segs = potatoMode || isSetup ? 8 : 80;

  return (
    <>
      {/* COLLISION GROUND: BoxGeometry dengan vertex sudah di world space (baked via applyMatrix4) */}
      {/* Side=DoubleSide agar raycast dari atas dan bawah sama-sama terdeteksi */}
      <StaticCollider>
        <mesh>
          <primitive object={groundCollisionGeo} attach="geometry" />
          <meshBasicMaterial side={THREE.DoubleSide} colorWrite={false} />
        </mesh>
      </StaticCollider>

      {/* Visual terrain (terpisah dari collision) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} receiveShadow={!potatoMode && !isSetup}>
        <planeGeometry args={[TERRAIN_SIZE, TERRAIN_SIZE, segs, segs]} />
        <primitive object={TerrainMaterial} attach="material" />
      </mesh>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DISTANT MOUNTAINS — ring batu/bukit dekoratif di horizon (tanpa collider)
// Menggunakan InstancedMesh → satu draw call untuk semua gunung
// ─────────────────────────────────────────────────────────────────────────────
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
      const radius = 600 + Math.random() * 400;  // 600–1000 units dari center
      const scaleH = 40 + Math.random() * 80;    // tinggi bervariasi
      const scaleW = 30 + Math.random() * 50;

      dummy.position.set(
        Math.cos(angle) * radius,
        scaleH * 0.3 - 0.6,
        Math.sin(angle) * radius,
      );
      dummy.rotation.y = Math.random() * Math.PI;
      dummy.scale.set(scaleW, scaleH, scaleW);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [dummy]);

  return (
    // frustumCulled: true — three.js otomatis sembunyikan saat di luar kamera
    <instancedMesh ref={meshRef} args={[undefined, undefined, MOUNTAIN_COUNT]} frustumCulled>
      <coneGeometry args={[1, 1, 6]} />
      <primitive object={MountainMaterial} attach="material" />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HUTAN — 500 pohon instanced, satu draw call, tersebar di 300 unit radius
// ─────────────────────────────────────────────────────────────────────────────
const TREE_COUNT  = 500;
const TrunkMat = new THREE.MeshStandardMaterial({ color: "#4d2915", roughness: 0.9 });
const TopMat   = new THREE.MeshStandardMaterial({ color: "#1a3d1a", roughness: 0.8 });
TrunkMat.onBeforeCompile = applyPainterlyStyle as any;
TopMat.onBeforeCompile   = applyPainterlyStyle as any;

const Forest = ({ potatoMode }: { potatoMode?: boolean }) => {
  const trunkRef = useRef<THREE.InstancedMesh>(null!);
  const topRef   = useRef<THREE.InstancedMesh>(null!);
  const dummy    = useMemo(() => new THREE.Object3D(), []);
  const count    = potatoMode ? Math.floor(TREE_COUNT / 3) : TREE_COUNT;

  useEffect(() => {
    let placed = 0;
    const attempts = count * 4;

    for (let i = 0; i < attempts && placed < count; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const radius = 25 + Math.random() * 280;  // jangan tanam di arena tengah
      const x      = Math.cos(angle) * radius;
      const z      = Math.sin(angle) * radius;

      if (Math.abs(x) < 18) continue;  // biarkan jalan kosong

      const s = 0.8 + Math.random() * 2.5;

      dummy.position.set(x, 1 * s - 0.6, z);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      trunkRef.current.setMatrixAt(placed, dummy.matrix);

      dummy.position.set(x, (4 + s * 2) - 0.6, z);
      dummy.scale.set(s * 2, s * 2.5, s * 2);
      dummy.updateMatrix();
      topRef.current.setMatrixAt(placed, dummy.matrix);

      placed++;
    }

    trunkRef.current.count = placed;
    topRef.current.count   = placed;
    trunkRef.current.instanceMatrix.needsUpdate = true;
    topRef.current.instanceMatrix.needsUpdate   = true;
  }, [count, dummy]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, count]} castShadow frustumCulled>
        <cylinderGeometry args={[0.25, 0.45, 4, 5]} />
        <primitive object={TrunkMat} attach="material" />
      </instancedMesh>
      <instancedMesh ref={topRef} args={[undefined, undefined, count]} castShadow frustumCulled>
        <coneGeometry args={[1, 2.5, 6]} />
        <primitive object={TopMat} attach="material" />
      </instancedMesh>
    </group>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BATU — 300 batu instanced, radius 15–500
// ─────────────────────────────────────────────────────────────────────────────
const ROCK_COUNT = 300;
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

      if (Math.abs(x) < 14 && Math.abs(z) < 30) continue; // jaga jalan

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
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} castShadow receiveShadow frustumCulled>
      <dodecahedronGeometry args={[1, 0]} />
      <primitive object={RockMat} attach="material" />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STATIC GRASS — posisi tetap, tidak bergerak/teleportasi
// Ditempatkan sekali di startup dalam pola grid + jitter
// ─────────────────────────────────────────────────────────────────────────────
const GRASS_COUNT  = 4000;
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

    // Grid placement dengan jitter — stabil, tidak teleportasi
    const cols = Math.ceil(Math.sqrt(count));
    const spacing = GRASS_AREA / cols;
    const half = GRASS_AREA / 2;
    let idx = 0;

    for (let row = 0; row < cols && idx < count; row++) {
      for (let col = 0; col < cols && idx < count; col++) {
        // Posisi grid + sedikit jitter agar tidak terlihat kaku
        const x = -half + col * spacing + (Math.random() - 0.5) * spacing * 0.9;
        const z = -half + row * spacing + (Math.random() - 0.5) * spacing * 0.9;

        // Skip area jalan di tengah
        if (Math.abs(x) < 14 && Math.abs(z) < 60) continue;

        dummy.position.set(x, GROUND_Y, z);
        dummy.rotation.y = Math.random() * Math.PI;
        dummy.scale.set(
          0.8 + Math.random() * 0.6,
          0.35 + Math.random() * 0.85,
          0.8 + Math.random() * 0.6,
        );
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
    GrassMat.uniforms.windStrength.value = THREE.MathUtils.lerp(
      GrassMat.uniforms.windStrength.value,
      windTarget,
      0.03,
    );
  });

  return (
    // frustumCulled=true: instances di luar kamera otomatis dilewati GPU
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled>
      <planeGeometry args={[0.3, 1.0, 1, 4]} />
      <primitive object={GrassMat} attach="material" />
    </instancedMesh>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// RAIN (GPU-based, tidak ada perubahan)
// ─────────────────────────────────────────────────────────────────────────────
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

// Lightning
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

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const StormEnvironment = ({
  baseDistance = 24,
  potatoMode   = false,
}: {
  baseDistance?: number;
  potatoMode?: boolean;
}) => {
  const weather    = useStore(s => s.weather);
  const setWeather = useStore(s => s.setWeather);
  const gameState  = useStore(s => s.gameState);
  const isSetup    = gameState === "SETUP";
  const { spawnVFX } = useVFX();

  // Atmospheric particles
  useFrame(state => {
    if (isSetup || potatoMode) return;
    if (state.clock.elapsedTime % 0.25 < 0.025) {
      const px = characterStatus.position.x;
      const pz = characterStatus.position.z;
      if (weather === "CLEAR") {
        spawnVFX([px + (Math.random()-0.5)*60, 1+Math.random()*5, pz + (Math.random()-0.5)*60], "dust-mote", "#ffffff");
      } else if (weather === "THUNDER") {
        spawnVFX([px + (Math.random()-0.5)*80, 0.5, pz + (Math.random()-0.5)*80], "environment-mist", "#a855f7");
      }
    }
  });

  // Weather cycle
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
        sunPosition={weather === "CLEAR" ? [100, 80, 0] : [0, -10, 0]}
        turbidity={weather === "CLEAR" ? 2 : 12}
        rayleigh={weather === "CLEAR" ? 0.8 : 3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />
      <hemisphereLight intensity={weather === "CLEAR" ? 1.2 : 0.6} color={weather === "THUNDER" ? "#cfe2ff" : "#ffffff"} groundColor="#445544" />
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[100, 150, 80]}
        intensity={weather === "CLEAR" ? 4.0 : 1.2}
        castShadow={!isSetup}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />

      {/* Terrain (collision + visual) */}
      <Terrain baseDistance={baseDistance} />

      {/* Props — all instanced (GPU) */}
      <Forest potatoMode={potatoMode} />
      <Rocks  potatoMode={potatoMode} />
      <StaticGrass potatoMode={potatoMode} />

      {/* Distant horizon */}
      <DistantMountains />

      {/* Weather FX */}
      {(weather === "RAIN" || weather === "THUNDER") && <Rain />}
      {weather === "THUNDER" && <Lightning />}

      {/* Open world fog */}
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
    </group>
  );
};
