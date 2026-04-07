import { useStore } from '../../hooks/useStore';
import React from 'react';
import { Billboard, Plane, Text } from "@react-three/drei";

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

  return (
    <group position={position}>
      {/* 3D Base Mesh */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4, 2, 2]} />
        <meshStandardMaterial color={customColor} roughness={0.4} metalness={0.6} />
      </mesh>
      
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
