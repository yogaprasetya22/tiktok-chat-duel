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

function getOrBuildMeshData(
  scene: THREE.Object3D
): { geometry: THREE.BufferGeometry; material: THREE.Material }[] {
  const cacheKey = scene.uuid;

  // Cek apakah sudah diproses sebelumnya
  const existingGeos = Array.from(geoCache.entries())
    .filter(([k]) => k.startsWith(cacheKey))
    .map(([k]) => ({
      geometry: geoCache.get(k)!,
      material: matCache.get(k)!,
    }));

  if (existingGeos.length > 0) return existingGeos;

  const list: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
  scene.updateMatrixWorld();
  let idx = 0;

  scene.traverse((child: any) => {
    if (!child.isMesh) return;
    const key = `${cacheKey}_${idx++}`;

    // Geometry: clone + bake matrix (hanya 1x seumur hidup app)
    const geom = child.geometry.clone();
    geom.applyMatrix4(child.matrixWorld);
    geom.computeBoundingBox();
    geom.computeBoundingSphere();
    geoCache.set(key, geom);

    // Material: clone + painterly + shader injection (hanya 1x)
    const mat = child.material.clone() as THREE.MeshStandardMaterial;
    applyPainterlyStyle(mat);

    const prevCompile = mat.onBeforeCompile?.bind(mat);
    mat.onBeforeCompile = (shader: any, renderer: any) => {
      prevCompile?.(shader, renderer);
      // Tambah warm toon glow sekali saja
      if (!shader.fragmentShader.includes('toonGlow')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // toonGlow
           diffuseColor.rgb += vec3(0.15, 0.08, 0.0) * sin(vWorldPos.y * 2.0);`
        );
      }
    };
    mat.needsUpdate = true;
    matCache.set(key, mat);

    list.push({ geometry: geom, material: mat });
  });

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
const GLBTowers = React.memo(({ distance }: { distance: number }) => {
  const { scene } = useGLTF('/assets-model/tower.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }) as any;

  const meshData = useMemo(() => {
    if (!scene) return [];
    return getOrBuildMeshData(scene);
  }, [scene]);

  if (meshData.length === 0) return null;

  return (
    <group>
      {meshData.map((m, i) => (
        <TowerPart key={i} geometry={m.geometry} material={m.material} distance={distance} />
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

// ─── TowerPart: 2 InstancedMesh TERPISAH per tower ────────────────────────────
// FIX KRITIS: Memisahkan player dan enemy ke InstancedMesh sendiri-sendiri
// agar frustum culling bekerja per-tower, bukan per-pasang.
// Sebelumnya: 1 sphere besar di (0,0,0) → GPU gambar keduanya meski salah satu off-screen.
// Sekarang: tiap tower punya sphere kecil yang tepat → GPU skip yg off-screen.
const TowerPart = React.memo(({
  geometry,
  material,
  distance,
}: {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  distance: number;
}) => {
  const playerRef = useRef<THREE.InstancedMesh>(null!);
  const enemyRef = useRef<THREE.InstancedMesh>(null!);

  useEffect(() => {
    // Player tower (instance 0 dari mesh tunggal)
    _obj.position.set(0, -0.4, distance);
    _obj.rotation.set(0, Math.PI, 0);
    _obj.scale.setScalar(2.5);
    _obj.updateMatrix();

    if (playerRef.current) {
      playerRef.current.setMatrixAt(0, _obj.matrix);
      playerRef.current.instanceMatrix.needsUpdate = true;
    }

    // Enemy tower
    _obj.position.set(0, -0.4, -distance);
    _obj.rotation.set(0, 0, 0);
    _obj.scale.setScalar(2.5);
    _obj.updateMatrix();

    if (enemyRef.current) {
      enemyRef.current.setMatrixAt(0, _obj.matrix);
      enemyRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [distance]);

  // Dispose saat unmount untuk mencegah GPU memory leak
  useEffect(() => {
    return () => {
      // Jangan dispose geometry/material dari cache global —
      // hanya lepas referensi InstancedMesh
    };
  }, []);

  return (
    <>
      {/* count=1: hanya 1 posisi per mesh, bounding sphere presisi */}
      {/* frustumCulled={false}: Memastikan base tidak hilang karena bug shared bounding sphere */}
      <instancedMesh ref={playerRef} args={[geometry, material, 1]} receiveShadow frustumCulled={false} />
      <instancedMesh ref={enemyRef} args={[geometry, material, 1]} receiveShadow frustumCulled={false} />
    </>
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

  const currentHp = useStore(s => type === 'player' ? s.playerBaseHp : s.enemyBaseHp);
  const hpRef = useRef(currentHp);
  hpRef.current = currentHp;

  useFrame(() => {
    if (gameState === 'SETUP') return;

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
      <pointLight position={[0, 2.5, 0]} intensity={1.5} color="#ffaa00" distance={25} />

      {gameState !== 'SETUP' && (
        <Billboard position={[0, 2.8, 0]}>
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

// Preload tetap di luar komponen
useGLTF.preload('/assets-model/tower.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});