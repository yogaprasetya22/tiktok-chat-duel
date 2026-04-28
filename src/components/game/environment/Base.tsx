import { useStore } from "@/src/state/useStore";
import React, { useMemo, useRef, useEffect } from 'react';
import { Billboard, Plane, Text, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { applyPainterlyStyle } from "../systems/effects/PainterlyMaterials";

const _obj = new THREE.Object3D();

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
    <instancedMesh ref={meshRef} args={[geometry, material, 2]} receiveShadow frustumCulled={false} />
  );
});

// ─── Base: HP bar + light ──────────────────────────────────────────────────────
interface BaseProps {
  maxHp: number;
  position: [number, number, number];
  type: "player" | "enemy";
  name: string;
  customColor: string;
}

export const Base = React.memo(({ maxHp, position, type, name, customColor }: BaseProps) => {
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

  return (
    <group position={position}>
      <pointLight position={[0, 4.5, 0]} intensity={2.5} color="#ffaa00" distance={30} />

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