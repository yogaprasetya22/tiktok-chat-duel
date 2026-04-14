import { useStore } from "@/src/state/useStore";
import React, { useMemo, useRef, useEffect } from 'react';
import { Billboard, Plane, Text, useGLTF } from "@react-three/drei";
import { MeshoptDecoder } from 'meshoptimizer';
import * as THREE from 'three';
import { applyPainterlyStyle } from "../systems/effects/PainterlyMaterials";

// Reuse matrix math objects to avoid garbage collection
const _obj = new THREE.Object3D();

/**
 * ProceduralLowPolyTower
 * A very lightweight replacement for the high-poly GLB tower.
 * Uses only ~40 triangles total compared to 1.28 million.
 */
const ProceduralLowPolyTower = ({ distance }: { distance: number }) => {
  return (
    <group>
      {/* Player Tower Proxy */}
      <group position={[0, -0.4, distance]}>
        <mesh position={[0, 3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 2, 6, 8]} />
          <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 6.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 1, 2.5]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>

      {/* Enemy Tower Proxy */}
      <group position={[0, -0.4, -distance]}>
        <mesh position={[0, 3, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.5, 2, 6, 8]} />
          <meshStandardMaterial color="#222222" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, 6.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.5, 1, 2.5]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      </group>
    </group>
  );
};

/**
 * InstancedTowers
 * High-performance renderer that draws both Player and Enemy towers.
 * Automatically switches to Procedural mode to save 1.2M triangles if needed.
 */
export const InstancedTowers = React.memo(({ distance, settingsRef }: { distance: number; settingsRef?: any }) => {
  const gameState = useStore(s => s.gameState);
  const isPotato = settingsRef?.current?.potatoMode;
  
  // PERFORMANCE FIX: The GLB tower is 640k triangles. 
  // We use the procedural tower during SETUP or in Potato Mode to keep FPS at 60.
  const useFallback = isPotato || gameState === 'SETUP';

  const { scene } = useGLTF('/assets-model/tower.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }) as any;

  // Extract all meshes from the GLB and prepare shared optimized materials
  const meshes = useMemo(() => {
    if (!scene) return [];
    const list: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = [];
    scene.updateMatrixWorld(); // Ensure internal model transforms are computed
    scene.traverse((child: any) => {
      if (child.isMesh) {
        // Clone and bake the internal transform from the GLB into the geometry
        // so that the InstancedMesh respects the original model's orientation.
        const geom = child.geometry.clone();
        geom.applyMatrix4(child.matrixWorld);

        // Clone material only once for all instances
        const mat = child.material.clone();
        applyPainterlyStyle(mat);

        // Inject warm toon glow (centralized shader mod)
        if (mat.onBeforeCompile) {
          const prev = mat.onBeforeCompile;
          mat.onBeforeCompile = (shader: any) => {
            prev(shader);
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <color_fragment>',
              `#include <color_fragment>
               diffuseColor.rgb += vec3(0.15, 0.08, 0.0) * sin(vWorldPos.y * 2.0);`
            );
          };
        }
        list.push({ geometry: geom, material: mat });
      }
    });

    return list;
  }, [scene]);

  if (useFallback) return <ProceduralLowPolyTower distance={distance} />;
  if (meshes.length === 0) return null;

  return (
    <group>
      {meshes.map((m, i) => (
        <TowerPart key={i} geometry={m.geometry} material={m.material} distance={distance} />
      ))}
    </group>
  );
});

const TowerPart = ({ geometry, material, distance }: { geometry: THREE.BufferGeometry; material: THREE.Material; distance: number }) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useEffect(() => {
    if (!meshRef.current) return;

    // Instance 0: Player Base
    _obj.position.set(0, -0.4, distance);
    _obj.rotation.set(0, Math.PI, 0);
    _obj.scale.setScalar(0.5);
    _obj.updateMatrix();
    meshRef.current.setMatrixAt(0, _obj.matrix);

    // Instance 1: Enemy Base
    _obj.position.set(0, -0.4, -distance);
    _obj.rotation.set(0, 0, 0);
    _obj.scale.setScalar(0.5);
    _obj.updateMatrix();
    meshRef.current.setMatrixAt(1, _obj.matrix);

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [distance]);

  return <instancedMesh ref={meshRef} args={[geometry, material, 2]} castShadow receiveShadow />;
};

interface BaseProps {
  maxHp: number;
  position: [number, number, number];
  type: "player" | "enemy";
  name: string;
  customColor: string;
}

/**
 * Base
 * Now only renders the UI (HP Bar, Name) and Light.
 * The 3D model is handled by the InstancedTowers component for performance.
 */
export const Base = React.memo(({ maxHp, position, type, name, customColor }: BaseProps) => {
  const gameState = useStore(s => s.gameState);
  const hp = useStore(s => type === 'player' ? s.playerBaseHp : s.enemyBaseHp);

  return (
    <group position={position}>
      {/* Warm Glow at top of tower */}
      <pointLight position={[0, 2.5, 0]} intensity={1.5} color="#ffaa00" distance={25} />

      {/* HP BAR - Base Version (GPU Optimized) */}
      {gameState !== 'SETUP' && (
        <Billboard position={[0, 2.8, 0]}>
          <group>
            {/* Background */}
            <Plane args={[4.5, 0.4]}>
              <meshBasicMaterial color="#000000" transparent opacity={0.6} />
            </Plane>

            {/* Main HP Bar */}
            <mesh position-z={0.01} scale-x={hp / maxHp} position-x={2.25 * (hp / maxHp - 1)}>
              <planeGeometry args={[4.4, 0.3]} />
              <meshBasicMaterial color={customColor} />
            </mesh>

            {/* Title / Name */}
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

            {/* HP Numbers */}
            <Text
              fontSize={0.3}
              color="white"
              anchorY="top"
              position={[0, -0.25, 0]}
              fillOpacity={0.8}
            >
              {`${hp} / ${maxHp}`}
            </Text>
          </group>
        </Billboard>
      )}
    </group>
  );
});

useGLTF.preload('/assets-model/tower.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
