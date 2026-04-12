import { useStore } from '../../hooks/useStore';
import React, { useMemo } from 'react';
import { Billboard, Plane, Text, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from 'three-stdlib';
import * as THREE from 'three';
import { applyPainterlyStyle } from './effects/PainterlyMaterials';

interface BaseProps {
  maxHp: number;
  position: [number, number, number];
  type: "player" | "enemy";
  name: string;
  customColor: string;
}

export const Base = React.memo(({ maxHp, position, type, name, customColor }: BaseProps) => {
  const gameState = useStore(s => s.gameState);
  const hp = useStore(s => type === 'player' ? s.playerBaseHp : s.enemyBaseHp);

  const { scene } = useGLTF('/assets-model/tower_2.glb') as any;
  
  const clone = useMemo(() => {
    if (!scene) return null;
    const c = SkeletonUtils.clone(scene);
    
    // Apply painterly style and warm colors
    c.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        
        if (child.material) {
          child.material = child.material.clone();
          applyPainterlyStyle(child.material);
          
          // Inject warm toon glow
          if (child.material.onBeforeCompile) {
             const prev = child.material.onBeforeCompile;
             child.material.onBeforeCompile = (shader: any) => {
               prev(shader);
               shader.fragmentShader = shader.fragmentShader.replace(
                 '#include <color_fragment>',
                 `#include <color_fragment>
                  diffuseColor.rgb += vec3(0.15, 0.08, 0.0) * sin(vWorldPos.y * 2.0);`
               );
             };
          }
        }
      }
    });
    return c;
  }, [scene]);

  return (
    <group position={position}>
      {/* 3D Model Tower */}
      {clone && (
        <primitive 
          object={clone} 
          scale={[0.3, 0.3, 0.3]} 
          position={[0, -0.6, 0]}
          rotation={[0, type === 'player' ? Math.PI : 0, 0]} 
        />
      )}
      
      {/* Warm Glow at top of tower */}
      <pointLight position={[0, 4, 0]} intensity={1.5} color="#ffaa00" distance={25} />


      
      {/* HP BAR - Base Version (GPU Optimized) */}
      {gameState !== 'SETUP' && (
        <Billboard position={[0, 4.5, 0]}>
          <group>
            {/* Background */}
            <Plane args={[4.5, 0.4]}>
              <meshBasicMaterial color="#000000" transparent opacity={0.6} />
            </Plane>
            
            {/* Main HP Bar */}
            <mesh position-z={0.01} scale-x={hp/maxHp} position-x={2.25 * (hp/maxHp - 1)}>
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

useGLTF.preload('/assets-model/tower_2.glb');

