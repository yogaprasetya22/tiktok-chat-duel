import { useStore } from "@/src/state/useStore";
import React, { useMemo, useRef, useEffect } from 'react';
import { Billboard, Plane, Text, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { applyPainterlyStyle } from "../systems/effects/PainterlyMaterials";
import { InstancedStaticCollider } from "bvhecctrl";

const _obj = new THREE.Object3D();
const _rot = new THREE.Euler();
const _q = new THREE.Quaternion();

// ─── Assets Configuration ──────────────────────────────────────────────────────
const ENV_ASSETS = {
  crate: '/assets-env/crate.glb',
  barrel: '/assets-env/barrel.glb',
  chest: '/assets-env/chest.glb',
  flag: '/assets-env/flag.glb',
  fence: '/assets-env/fence-straight.glb',
  fenceBroken: '/assets-env/fence-broken.glb',
  rock: '/assets-env/rocks.glb',
  tree: '/assets-env/tree-pine-small.glb',
  hedge: '/assets-env/hedge.glb',
};

// ─── Module-level cache ────────────────────────────────────────────────────────
// Geometry dan material hanya diproses SEKALI selama session, bukan per-render.
// Ini mencegah 640k-triangle clone + shader recompile yang jadi penyebab frame drop.
const geoCache = new Map<string, THREE.BufferGeometry>();
const matCache = new Map<string, THREE.Material>();
const modelPartsCache = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material }[]>();

function getOrBuildMeshData(
  scene: THREE.Object3D,
  fileName: string
): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  const cached = modelPartsCache.get(fileName);
  if (cached) return cached;

  const list: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  scene.updateMatrixWorld();
  let idx = 0;

  scene.traverse((child: any) => {
    if (!child.isMesh) return;
    const key = `${fileName}_${idx++}`;

    let geom = geoCache.get(key);
    if (!geom) {
      geom = child.geometry.clone();
      if (geom) {
        geom.applyMatrix4(child.matrixWorld);
        geom.computeBoundingBox();
        geom.computeBoundingSphere();
        geoCache.set(key, geom);
      }
    }

    let mat = matCache.get(key);
    if (!mat) {
      mat = child.material.clone() as THREE.MeshStandardMaterial;
      applyPainterlyStyle(mat);

      const prevCompile = mat.onBeforeCompile?.bind(mat);
      mat.onBeforeCompile = (shader: any, renderer: any) => {
        prevCompile?.(shader, renderer);
        if (!shader.fragmentShader.includes('toonGlow')) {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
             // toonGlow
             diffuseColor.rgb += vec3(0.18, 0.12, 0.02) * (1.0 + sin(vWorldPos.y * 3.0 + 1.5)) * 0.5;`
          );
        }
      };
      mat.needsUpdate = true;
      matCache.set(key, mat);
    }

    if (geom && mat) {
      list.push({ geometry: geom, material: mat });
    }
  });

  modelPartsCache.set(fileName, list);
  return list;
}

// ─── Prosedural fallback (tetap ringan) ────────────────────────────────────────
const ProceduralLowPolyTower = React.memo(({ distance }: { distance: number }) => (
  <group>
    <group position={[0, -0.4, distance]}>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[1.5, 2, 6, 8]} />
        <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 6.5, 0]} castShadow>
        <boxGeometry args={[2.5, 1, 2.5]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
    </group>
    <group position={[0, -0.4, -distance]}>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[1.5, 2, 6, 8]} />
        <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, 6.5, 0]} castShadow>
        <boxGeometry args={[2.5, 1, 2.5]} />
        <meshStandardMaterial color="#111111" />
      </mesh>
    </group>
  </group>
));

// ─── GLB renderer (dipisah agar hooks selalu dipanggil) ────────────────────────
// ─── Majestic Kingdom Tower Configuration ─────────────────────────────────────
const TOWER_LAYOUT = [
  { file: '/kingdom/tower-square-arch.glb', y: 0.0, s: 3.2, rot: 0 },
  { file: '/kingdom/tower-hexagon-mid.glb', y: 3.2, s: 3.2, rot: Math.PI / 6 },
  { file: '/kingdom/tower-hexagon-top-wood.glb', y: 4.6, s: 3.2, rot: 0 },
  { file: '/kingdom/tower-hexagon-top.glb', y: 6.1, s: 3.2, rot: 0 },
  { file: '/kingdom/tower-hexagon-roof.glb', y: 6.6, s: 3.2, rot: 0 },
];

const PLAYER_PROPS = [
  { file: ENV_ASSETS.fence, p: [-4, 0, -2], r: [0, Math.PI/2, 0], s: 1.5 },
  { file: ENV_ASSETS.fence, p: [4, 0, -2], r: [0, -Math.PI/2, 0], s: 1.5 },
  { file: ENV_ASSETS.fence, p: [-4, 0, 2], r: [0, Math.PI/2, 0], s: 1.5 },
  { file: ENV_ASSETS.fence, p: [4, 0, 2], r: [0, -Math.PI/2, 0], s: 1.5 },
  { file: ENV_ASSETS.flag, p: [-3, 0, 4], r: [0, 0, 0], s: 2 },
  { file: ENV_ASSETS.flag, p: [3, 0, 4], r: [0, 0, 0], s: 2 },
  { file: ENV_ASSETS.crate, p: [-3.5, 0, 0], r: [0, 0.4, 0], s: 1.2 },
  { file: ENV_ASSETS.crate, p: [-3.5, 1, 0], r: [0, -0.2, 0], s: 1.2 },
  { file: ENV_ASSETS.chest, p: [3.5, 0, 0], r: [0, -0.5, 0], s: 1.5 },
  { file: ENV_ASSETS.hedge, p: [0, 0, 5], r: [0, 0, 0], s: 1.5 },
];

const ENEMY_PROPS = [
  { file: ENV_ASSETS.fenceBroken, p: [-4, 0, -1], r: [0, 1.2, 0.2], s: 1.5 },
  { file: ENV_ASSETS.fenceBroken, p: [3.5, 0, 2], r: [0, -0.8, -0.1], s: 1.5 },
  { file: ENV_ASSETS.barrel, p: [-3, 0, 3], r: [0, 0, 0], s: 1.2 },
  { file: ENV_ASSETS.barrel, p: [-2.2, 0, 3.5], r: [Math.PI/2, 0, 0.5], s: 1.2 },
  { file: ENV_ASSETS.rock, p: [4, 0, -3], r: [0, 2.1, 0], s: 2.5 },
  { file: ENV_ASSETS.rock, p: [-5, 0, -4], r: [0, 0.5, 0], s: 3 },
  { file: ENV_ASSETS.tree, p: [5, 0, 5], r: [0, 0, 0], s: 2 },
  { file: ENV_ASSETS.tree, p: [-6, 0, 6], r: [0, 1.1, 0], s: 1.8 },
  { file: ENV_ASSETS.barrel, p: [3, 0, -1], r: [0, 0, 0], s: 1.2 },
];

const GLBTowers = React.memo(({ distance }: { distance: number }) => {
  // Load ALL models in parallel
  const g1 = useGLTF(TOWER_LAYOUT[0].file, true, true, (l) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const g2 = useGLTF(TOWER_LAYOUT[1].file, true, true, (l) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const g3 = useGLTF(TOWER_LAYOUT[2].file, true, true, (l) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const g4 = useGLTF(TOWER_LAYOUT[3].file, true, true, (l) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const g5 = useGLTF(TOWER_LAYOUT[4].file, true, true, (l) => l.setMeshoptDecoder(MeshoptDecoder)) as any;

  const scenes = [g1, g2, g3, g4, g5];

  const fullMeshData = useMemo(() => {
    return TOWER_LAYOUT.map((config, i) => {
      const scene = scenes[i]?.scene;
      if (!scene) return [];
      return getOrBuildMeshData(scene, config.file).map(m => ({
        ...m,
        yOffset: config.y,
        scale: config.s,
        rotation: config.rot
      }));
    }).flat();
  }, [g1, g2, g3, g4, g5]);

  if (fullMeshData.length === 0) return null;

  return (
    <group>
      {fullMeshData.map((m, i) => (
        <TowerPart
          key={i}
          geometry={m.geometry}
          material={m.material}
          distance={distance}
          yOffset={m.yOffset}
          scale={m.scale}
          rotation={m.rotation}
        />
      ))}
    </group>
  );
});

// ─── InstancedTowers: router utama ─────────────────────────────────────────────
export const InstancedTowers = React.memo(({
  distance,
  settingsRef,
}: {
  distance: number;
  settingsRef?: React.RefObject<{ potatoMode?: boolean }>;
}) => {
  const gameState = useStore(s => s.gameState);
  const isPotato = settingsRef?.current?.potatoMode ?? false;
  const useFallback = isPotato || gameState === 'SETUP';

  // Selalu render komponen yang sama agar hooks tidak berpindah
  if (useFallback) return <ProceduralLowPolyTower distance={distance} />;
  return <GLBTowers distance={distance} />;
});

const TowerPart = React.memo(({
  geometry,
  material,
  distance,
  yOffset,
  scale,
  rotation,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  distance: number;
  yOffset: number;
  scale: number;
  rotation: number;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useEffect(() => {
    if (!meshRef.current) return;

    // Instance 0: Player tower
    _obj.position.set(0, -0.4 + yOffset, distance);
    _obj.rotation.set(0, Math.PI + rotation, 0);
    _obj.scale.setScalar(scale);
    _obj.updateMatrix();
    meshRef.current.setMatrixAt(0, _obj.matrix);

    // Instance 1: Enemy tower
    _obj.position.set(0, -0.4 + yOffset, -distance);
    _obj.rotation.set(0, rotation, 0);
    _obj.scale.setScalar(scale);
    _obj.updateMatrix();
    meshRef.current.setMatrixAt(1, _obj.matrix);

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [distance, yOffset, scale, rotation]);

  return (
    <InstancedStaticCollider>
      <instancedMesh ref={meshRef} args={[geometry, material, 2]} receiveShadow frustumCulled={false} />
    </InstancedStaticCollider>
  );
});

// ─── Environment Props Renderer ──────────────────────────────────────────────
const BaseEnvironment = React.memo(({ type, distance }: { type: 'player' | 'enemy'; distance: number }) => {
  const props = type === 'player' ? PLAYER_PROPS : ENEMY_PROPS;
  
  // Collect all unique files
  const uniqueFiles = Array.from(new Set(props.map(p => p.file)));
  
  // We need to call useGLTF for each unique file to ensure they are loaded
  // This is a bit tricky with hooks, but since the list is static, it's safe.
  const gltfs = uniqueFiles.map(file => useGLTF(file, true, true, (l) => l.setMeshoptDecoder(MeshoptDecoder)) as any);

  const fullMeshData = useMemo(() => {
    return uniqueFiles.map((file, idx) => {
      const scene = gltfs[idx]?.scene;
      if (!scene) return [];
      
      const meshData = getOrBuildMeshData(scene, file);
      
      // Find all instances of this file in the props layout
      const instances = props.filter(p => p.file === file);
      
      return meshData.map(m => ({
        ...m,
        file,
        instances: instances.map(inst => ({
          pos: inst.p,
          rot: inst.r,
          scale: inst.s
        }))
      }));
    }).flat();
  }, [gltfs]);

  if (fullMeshData.length === 0) return null;

  return (
    <group position={[0, -0.4, type === 'player' ? distance : -distance]} rotation={[0, type === 'player' ? 0 : Math.PI, 0]}>
      {fullMeshData.map((m, i) => (
        <EnvPart
          key={`${type}-${i}`}
          geometry={m.geometry}
          material={m.material}
          instances={m.instances}
        />
      ))}
    </group>
  );
});

const EnvPart = React.memo(({
  geometry,
  material,
  instances,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  instances: { pos: number[]; rot: number[]; scale: number }[];
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useEffect(() => {
    if (!meshRef.current) return;

    instances.forEach((inst, i) => {
      _obj.position.set(inst.pos[0], inst.pos[1], inst.pos[2]);
      _rot.set(inst.rot[0], inst.rot[1], inst.rot[2]);
      _q.setFromEuler(_rot);
      _obj.quaternion.copy(_q);
      _obj.scale.setScalar(inst.scale);
      _obj.updateMatrix();
      meshRef.current.setMatrixAt(i, _obj.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.count = instances.length;
  }, [instances]);

  return (
    <InstancedStaticCollider>
      <instancedMesh ref={meshRef} args={[geometry, material, instances.length]} receiveShadow frustumCulled={false} />
    </InstancedStaticCollider>
  );
});

// ─── Tower Flag with Waving Shader ───────────────────────────────────────────
const TowerFlag = React.memo(({ url, color, rotation = 0, invert = false }: { url?: string; color: string; rotation?: number; invert?: boolean }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uTexture: { value: null as THREE.Texture | null },
    uColor: { value: new THREE.Color(color) },
    uInvert: { value: invert ? 1 : 0 },
  }), [color, invert]);

  // Load texture if URL exists
  useEffect(() => {
    if (url) {
      const loader = new THREE.TextureLoader();
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        uniforms.uTexture.value = tex;
      });
    }
  }, [url, uniforms]);

  useFrame((state) => {
    if (meshRef.current) {
      uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group position={[6.1, 0, 0]} rotation={[0, rotation, 0]}>
      {/* Flag Pole - Standing from ground (y=0) up to the sky */}
      <mesh position={[invert ? 2.1 : -2.1, 2.2, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.18, 17, 12]} />
        <meshStandardMaterial color="#222" metalness={0.9} roughness={0.1} />
      </mesh>
      
      {/* Waving Flag - Positioned near the top of the pole */}
      <mesh ref={meshRef} position={[0, 8.8, 0]}>
        <planeGeometry args={[4, 2.5, 32, 32]} />
        <shaderMaterial
          transparent
          side={THREE.DoubleSide}
          uniforms={uniforms}
          vertexShader={`
            varying vec2 vUv;
            uniform float uTime;
            uniform float uInvert;
            void main() {
              vUv = uv;
              vec3 pos = position;
              
              // If inverted, use (1.0 - uv.x) for anchoring and wave math
              float xPos = (uInvert > 0.5) ? (1.0 - uv.x) : uv.x;
              float anchor = pow(xPos, 1.5); 
              
              // Primary wave (Horizontal)
              float wave = sin(xPos * 6.0 - uTime * 5.0) * 0.45 * anchor;
              // Secondary wave (Vertical noise)
              wave += cos(uv.y * 3.0 + uTime * 3.0) * 0.15 * anchor;
              
              pos.z += wave;
              pos.y += sin(xPos * 2.0 + uTime * 2.0) * 0.2 * anchor;
              
              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            varying vec2 vUv;
            uniform sampler2D uTexture;
            uniform vec3 uColor;
            uniform float uTime;
            uniform float uInvert;
            
            void main() {
              vec4 tex = texture2D(uTexture, vUv);
              
              vec3 base = uColor;
              vec3 finalCol = (tex.a > 0.1) ? tex.rgb : base;
              
              float xPos = (uInvert > 0.5) ? (1.0 - vUv.x) : vUv.x;
              float folds = sin(xPos * 12.0 - uTime * 5.0) * 0.25;
              float verticalFolds = cos(vUv.y * 5.0 + uTime * 2.0) * 0.1;
              
              finalCol *= (0.8 + folds + verticalFolds);
              
              float b = 0.02;
              if (vUv.x < b || vUv.x > 1.0-b || vUv.y < b || vUv.y > 1.0-b) {
                finalCol = mix(finalCol, vec3(1.0), 0.3);
              }
              
              gl_FragColor = vec4(finalCol, 1.0);
            }
          `}
        />
      </mesh>
    </group>
  );
});

const WinStars = React.memo(({ count, color }: { count: number; color: string }) => {
  const stars = useMemo(() => Array.from({ length: count }), [count]);
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.2;
    groupRef.current.rotation.y = state.clock.elapsedTime * 0.5;
  });

  if (count <= 0) return null;

  return (
    <group ref={groupRef} position={[0, 11.8, 0]}>
      {stars.map((_, i) => {
        const angle = (i / count) * Math.PI * 2;
        const radius = 1.2 + (count * 0.1);
        return (
          <mesh key={i} position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}>
            <octahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial 
              color={color} 
              emissive={color} 
              emissiveIntensity={2} 
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>
        );
      })}
    </group>
  );
});

// ─── Base: HP bar + light ──────────────────────────────────────────────────────
interface BaseProps {
  maxHp: number;
  position: [number, number, number];
  type: "player" | "enemy";
  name: string;
  customColor: string;
  flagUrl?: string;
}

export const Base = React.memo(({ maxHp, position, type, name, customColor, flagUrl }: BaseProps) => {
  const hpBarRef = useRef<THREE.Mesh>(null!);
  const textRef = useRef<any>(null!);
  const gameState = useStore(s => s.gameState);
  const hpRef = useRef(maxHp);

  useEffect(() => {
    // Direct subscription to avoid React re-renders when HP changes
    const unsub = useStore.subscribe((state: any) => {
      hpRef.current = type === 'player' ? state.playerBaseHp : state.enemyBaseHp;
    });
    return unsub;
  }, [type]);

  useFrame(() => {
    if (useStore.getState().gameState === 'SETUP') return;

    const hp = hpRef.current;
    const ratio = Math.min(1, Math.max(0, hp / maxHp));

    if (hpBarRef.current) {
      hpBarRef.current.scale.x = ratio;
      hpBarRef.current.position.x = 2.25 * (ratio - 1);
    }

    if (textRef.current) {
      const nextText = `${Math.ceil(hp)} / ${maxHp}`;
      if (textRef.current.text !== nextText) {
        textRef.current.text = nextText;
      }
    }
  });

  const wins = useStore(s => type === 'player' ? s.playerWins : s.enemyWins);

  return (
    <group position={position}>
      <pointLight position={[0, 4.5, 0]} intensity={2.5} color="#ffaa00" distance={30} />
      
      {/* Environment Props */}
      {gameState !== 'SETUP' && <BaseEnvironment type={type} distance={0} />}

      {/* Large Waving Flag */}
      {gameState !== 'SETUP' && (
        <TowerFlag 
          url={flagUrl || useStore.getState().liveStats.profileImages[name]} 
          color={customColor} 
          rotation={type === 'player' ? Math.PI : 0}
          invert={type === 'player'}
        />
      )}

      {/* Win Indicators (Stars) */}
      <WinStars count={wins} color={customColor} />

      {gameState !== 'SETUP' && (
        <Billboard position={[0, 10.5, 0]}>
          <group>
            <Plane args={[4.5, 0.4]}>
              <meshBasicMaterial color="#000000" transparent opacity={0.6} />
            </Plane>

            <mesh ref={hpBarRef} position-z={0.01}>
              <planeGeometry args={[4.4, 0.3]} />
              <meshBasicMaterial color={customColor} />
            </mesh>

            <Text
              fontSize={0.6}
              color="white"
              anchorY="bottom"
              position={[0, 0.4, 0]}
              outlineWidth={0.05}
              outlineColor="#000000"
            >
              {name.toUpperCase()}
            </Text>

            <Text
              ref={textRef}
              fontSize={0.3}
              color="white"
              anchorY="top"
              position={[0, -0.25, 0]}
              fillOpacity={0.8}
            >
              {`${maxHp} / ${maxHp}`}
            </Text>
          </group>
        </Billboard>
      )}
    </group>
  );
});

// Preload all parts
TOWER_LAYOUT.forEach(config => {
  useGLTF.preload(config.file, true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
});
Object.values(ENV_ASSETS).forEach(file => {
  useGLTF.preload(file, true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
});