import { useStore } from '../../hooks/useStore';
import React from 'react';
import { Html } from "@react-three/drei";

interface BaseProps {
  hp: number;
  maxHp: number;
  position: [number, number, number];
  type: "player" | "enemy";
  name: string;
  customColor: string;
}

export const Base = React.memo(({ hp, maxHp, position, type, name, customColor }: BaseProps) => {
  const gameState = useStore(s => s.gameState);
  return (
    <group position={position}>
      {/* 3D Base Mesh */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[4, 2, 2]} />
        <meshStandardMaterial color={customColor} roughness={0.4} metalness={0.6} />
      </mesh>
      
      {/* HP BAR - Base Version (Mobile Legends Style) */}
      {gameState !== 'SETUP' && (
        <Html position={[0, 2.8, 0]} center pointerEvents="none" zIndexRange={[5, 0]}>
          <div className="relative w-40 h-3 bg-black/80 rounded-sm border-[1.5px] border-black overflow-hidden shadow-2xl">
            {/* Ghost Bar */}
            <div 
              className="absolute inset-0 bg-white/40 transition-all duration-1000 ease-out z-0"
              style={{ width: `${(hp / maxHp) * 100}%` }}
            />
            
            {/* Main HP Bar with CSS Segments */}
            <div 
              className="absolute inset-0 h-full transition-all duration-300 ease-out z-10"
              style={{ 
                width: `${(hp / maxHp) * 100}%`, 
                backgroundColor: customColor,
                backgroundImage: `
                  linear-gradient(to bottom, rgba(255,255,255,0.3), transparent),
                  repeating-linear-gradient(to right, transparent, transparent 9.5%, rgba(0,0,0,0.5) 9.5%, rgba(0,0,0,0.5) 10.5%)
                `
              }}
            />
          </div>
        </Html>
      )}

      {/* Label - Fortress Style */}
      {gameState !== 'SETUP' && (
        <Html position={[0, -1.8, 0]} center pointerEvents="none" zIndexRange={[5, 0]}>
          <div className="flex flex-col items-center">
            <div className="text-[12px] font-black uppercase tracking-[0.2em] text-white whitespace-nowrap px-4 py-1.5 bg-zinc-900/90 rounded-sm border-x-4 border-white/20 shadow-xl drop-shadow-md">
              {name}
            </div>
            <div className="mt-1 text-[9px] font-bold text-white/60 tabular-nums">
              {hp} / {maxHp}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
});
