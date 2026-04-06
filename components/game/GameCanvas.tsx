'use client';

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  Sky,
  Environment as DreiEnvironment,
  ContactShadows,
  Html,
  Stats,
  PerformanceMonitor,
  AdaptiveEvents,
  AdaptiveDpr,
  useGLTF,
  Sphere
} from "@react-three/drei";
import { Unit } from "./Unit";
import { Base } from "./Base";
import { Chessboard } from "./Chessboard";
import { VFXProvider, useVFX } from "./VFXManager";
import { ActiveUnit, TowerConfig, DamageText, MapObstacle } from "../../hooks/useBattleSystem";
import { useStore } from "../../hooks/useStore";
import React, { useState, useEffect, useRef } from "react";
import { Sword, Trophy, Zap, Skull, Maximize2 } from "lucide-react";
import * as THREE from 'three';

// Map removed as requested. Base ground provided by OrbitControls/Sky.

// --- Camera Director for Epic Endings & Shake ---
const CameraDirector = () => {
  const { camera } = useThree();
  const { spawnVFX } = useVFX();
  const hasTriggeredRef = useRef(false);
  const gameState = useStore(s => s.gameState);
  const playerBaseHp = useStore(s => s.playerBaseHp);
  const enemyBaseHp = useStore(s => s.enemyBaseHp);
  
  const lastBaseHp = useRef({ player: 1000, enemy: 1000 });
  const shakeIntensity = useRef(0);

  useFrame((state, delta) => {
    // 1. Damage Shake
    if (playerBaseHp < lastBaseHp.current.player || enemyBaseHp < lastBaseHp.current.enemy) {
      shakeIntensity.current = 0.35;
      lastBaseHp.current = { player: playerBaseHp, enemy: enemyBaseHp };
    }

    if (shakeIntensity.current > 0) {
      camera.position.x += (Math.random() - 0.5) * shakeIntensity.current;
      camera.position.y += (Math.random() - 0.5) * shakeIntensity.current;
      shakeIntensity.current -= delta * 1.8;
    }

    // 2. Cinematic Ending
    if (gameState === 'WON' || gameState === 'LOST') {
      const targetZ = gameState === 'WON' ? -18 : 18;
      const targetPos = new THREE.Vector3(0, 7, targetZ + (gameState === 'WON' ? -12 : 12));

      camera.position.lerp(targetPos, 0.05);
      camera.lookAt(0, 0, targetZ);

      if (!hasTriggeredRef.current) {
        spawnVFX([0, 0, targetZ], 'mega_explosion', gameState === 'WON' ? '#ef4444' : '#3b82f6');
        spawnVFX([0, 0, targetZ], 'shockwave', '#ffffff');
        hasTriggeredRef.current = true;
      }
    } else {
      hasTriggeredRef.current = false;
    }
  });

  return null;
};

// --- Performance Probe for Deep Diagnostics ---
const PerformanceProbe = ({ syncPerformance }: { syncPerformance: (data: any) => void }) => {
  const { gl } = useThree();
  const lastTime = useRef(performance.now());
  const frameCount = useRef(0);
  
  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 30 === 0) { // Update every 30 frames to save CPU
      const now = performance.now();
      syncPerformance({
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        drift: (now - lastTime.current) / 30
      });
      lastTime.current = now;
    }
  });
  return null;
};

interface GameCanvasProps {
  activeUnits: ActiveUnit[];
  towerConfig: TowerConfig;
  damageTexts: DamageText[];
  isCinematic: boolean;
  setMapObstacles: (obs: MapObstacle[]) => void;
  mapObstacles: MapObstacle[];
  debug: boolean;
  unitRegistry: React.RefObject<Map<string, { hp: number; status: string; position: number[] }>>;
  syncPerformance: (data: any) => void;
}

export const GameCanvas = React.memo(({
  activeUnits,
  towerConfig,
  damageTexts,
  isCinematic,
  mapObstacles,
  debug,
  unitRegistry,
  syncPerformance,
}: GameCanvasProps) => {
  const [dpr, setDpr] = useState(1.0);
  const playerBaseHp = useStore(s => s.playerBaseHp);
  const enemyBaseHp = useStore(s => s.enemyBaseHp);
  const gameState = useStore(s => s.gameState);
  const killEvents = useStore(s => s.killEvents);
  const liveStats = useStore(s => s.liveStats);

  return (
    <div id="game-canvas-container" className="w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative bg-sky-300">
      <Stats className="!absolute !bottom-4 !right-4 !left-auto !top-auto opacity-50 grayscale" />
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 20, 30], fov: 40 }}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          alpha: false
        }}
      >
        <PerformanceProbe syncPerformance={syncPerformance} />
        <PerformanceMonitor onIncline={() => setDpr(1.2)} onDecline={() => setDpr(0.7)} />
        <AdaptiveEvents />
        <AdaptiveDpr pixelated={true} />

        <OrbitControls
          makeDefault
          enablePan={!isCinematic && gameState === 'PLAYING'}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 12}
          maxDistance={120}
          minDistance={10}
        />

        {/* Daytime / Sun Atmosphere (Siang) */}
        <Sky sunPosition={[100, 20, 100]} />
        <ambientLight intensity={1.2} />
        <directionalLight
          position={[10, 20, 10]}
          intensity={2.5}
          castShadow
          shadow-mapSize={[512, 512]} // Optimized for RAM
        />

        {/* Basic Ground for Battle Simulator */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.51, 0]} receiveShadow>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.8} />
        </mesh>
        <DreiEnvironment preset="city" />

        <VFXProvider>
          <CameraDirector />
          
          {/* Bridge removed. Units now battle throughout the natural forest clearing. */}

          <Base
            hp={playerBaseHp}
            maxHp={towerConfig.baseHp}
            position={[0, 0, 24]}
            type="player"
            name={towerConfig.player.name}
            customColor={towerConfig.player.color}
          />
          <Base
            hp={enemyBaseHp}
            maxHp={towerConfig.baseHp}
            position={[0, 0, -24]}
            type="enemy"
            name={towerConfig.enemy.name}
            customColor={towerConfig.enemy.color}
          />

          {activeUnits.map((u) => (
            <Unit
              key={u.id}
              id={u.id}
              userName={u.userName}
              type={u.type}
              level={u.level}
              hp={u.hp}
              maxHp={u.maxHp}
              status={u.status}
              teamColor={u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color}
              isDying={u.isDying}
              isBoss={u.isBoss}
              debug={debug}
              unitRegistry={unitRegistry}
            />
          ))}

          {/* DEBUG OBSTACLES */}
          {debug && mapObstacles.map((obs: MapObstacle, i: number) => (
            <Sphere key={`debug-obs-${i}`} args={[obs.r, 16, 16]} position={[obs.x, -0.4, obs.z]}>
              <meshBasicMaterial color="yellow" wireframe transparent opacity={0.3} />
            </Sphere>
          ))}
        </VFXProvider>

        {/* Only show the most recent 12 damage texts to prevent DOM layout thrashing */}
        {damageTexts.slice(-12).map((text) => {
          const scale = Math.min(1.2 + text.value / 400, 3.5);
          const isBig = text.value > 100;
          return (
            <Html key={text.id} position={text.position} center distanceFactor={12}>
              <div 
                className={`pointer-events-none select-none animate-in fade-out slide-out-to-top-48 duration-700 fill-mode-forwards`}
                style={{ 
                  transform: `scale(${scale})`,
                  filter: isBig ? 'drop-shadow(0 0 8px rgba(255,215,0,0.8))' : 'none'
                }}
              >
                <div
                  className={`font-black italic drop-shadow-[0_4px_6px_rgba(0,0,0,0.8)] whitespace-nowrap ${isBig ? 'text-6xl text-yellow-400 underline decoration-yellow-600' : 'text-4xl'}`}
                  style={{ color: isBig ? '#FFD700' : text.color }}
                >
                  {isBig ? '🔥' : ''}{text.value}
                </div>
              </div>
            </Html>
          );
        })}

        {/* Removed ContactShadows for massive performance boost on low-end hardware */}
      </Canvas>
    </div>
  );
});
