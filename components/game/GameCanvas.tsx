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
  Sphere,
  Billboard,
  Text,
} from "@react-three/drei";
import { useControls, Leva } from "leva";

import { Base } from "./Base";
import { Chessboard } from "./Chessboard";
import { VFXProvider, useVFX } from "./VFXManager";
import { BattleArmy } from "./BattleArmy";
import { StormEnvironment } from "./StormEnvironment";
import { ActiveUnit, TowerConfig, DamageText, MapObstacle } from "../../hooks/useBattleSystem";
import { useStore } from "../../hooks/useStore";
import React, { useState, useEffect, useRef } from "react";
import { Sword, Trophy, Zap, Skull, Maximize2 } from "lucide-react";
import * as THREE from 'three';

// Map removed as requested. Base ground provided by OrbitControls/Sky.

// --- Camera Director for Epic Endings & Shake ---
const _targetPos = new THREE.Vector3(); // Fix #4: zero-alloc, reused per frame

const CameraDirector = () => {
  const { camera } = useThree();
  const { spawnVFX } = useVFX();
  const hasTriggeredRef = useRef(false);

  const lastBaseHp = useRef({ player: 1000, enemy: 1000 });
  const shakeIntensity = useRef(0);

  useFrame((state, delta) => {
    const gameState = useStore.getState().gameState;
    const playerBaseHp = useStore.getState().playerBaseHp;
    const enemyBaseHp = useStore.getState().enemyBaseHp;

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
      // Fix #4: reuse _targetPos instead of new THREE.Vector3() each frame
      _targetPos.set(0, 7, targetZ + (gameState === 'WON' ? -12 : 12));

      camera.position.lerp(_targetPos, 0.05);
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


interface GameCanvasProps {
  towerConfig: TowerConfig;
  damageTexts: DamageText[];
  isCinematic: boolean;
  setMapObstacles: (obs: MapObstacle[]) => void;
  mapObstacles: MapObstacle[];
  debug: boolean;
  unitRegistry: React.RefObject<Map<string, { hp: number; status: string; position: number[]; isBoss: boolean; maxHp?: number }>>;
  syncPerformance: (data: any) => void;
  isFullscreen?: boolean;
  updateSimulation: (delta: number) => void;
  damageQueue: React.RefObject<any[]>;
  settingsRef: React.RefObject<any>;
  simTimeRef: React.RefObject<number>;
  setTowerConfig?: (config: TowerConfig | ((prev: TowerConfig) => TowerConfig)) => void;
  vehicles: React.RefObject<Map<string, any>>;
  unitIndex: React.RefObject<Map<string, any>>;
  spellsRef: React.RefObject<any[]>;
}


export const GameCanvas = React.memo(({
  towerConfig,
  damageTexts,
  isCinematic,
  mapObstacles,
  debug,
  unitRegistry,
  syncPerformance,
  isFullscreen,
  updateSimulation,
  damageQueue,
  settingsRef,
  simTimeRef,
  setTowerConfig,
  vehicles,
  unitIndex,
  spellsRef,
}: GameCanvasProps) => {

  const [dpr, setDpr] = useState(1.0);
  const gameState = useStore(s => s.gameState);
  const isSettingsOpen = useStore(s => s.isSettingsOpen);

  // --- High-Performance Simulation Controls (Leva) ---
  useControls("Military Tuning", {
    hpMult: { 
      value: settingsRef.current.globalHpMultiplier, min: 0.1, max: 5, step: 0.1, label: "HP Multiplier",
      onChange: (v) => { settingsRef.current.globalHpMultiplier = v; }
    },
    dmgMult: { 
      value: settingsRef.current.globalDamageMultiplier, min: 0.1, max: 5, step: 0.1, label: "DMG Multiplier",
      onChange: (v) => { settingsRef.current.globalDamageMultiplier = v; }
    },
    speedMult: { 
      value: settingsRef.current.globalSpeedMultiplier, min: 0.1, max: 3, step: 0.1, label: "Speed Multiplier",
      onChange: (v) => { settingsRef.current.globalSpeedMultiplier = v; }
    },
    cooldown: { 
      value: settingsRef.current.globalAttackCooldown, min: 100, max: 2000, step: 50, label: "Atk Cooldown (ms)",
      onChange: (v) => { settingsRef.current.globalAttackCooldown = v; }
    },
    crit: { 
      value: settingsRef.current.critChance, min: 0, max: 1, step: 0.05, label: "Crit Chance",
      onChange: (v) => { settingsRef.current.critChance = v; }
    },
    maxCap: {
      value: towerConfig.maxUnits, min: 10, max: 300, step: 5, label: "Max Units",
      onChange: (v) => { if (setTowerConfig) setTowerConfig(prev => ({...prev, maxUnits: v})); }
    },
    baseHp: {
      value: towerConfig.baseHp, min: 500, max: 20000, step: 100, label: "Tower HP",
      onChange: (v) => { if (setTowerConfig) setTowerConfig(prev => ({...prev, baseHp: v})); }
    },
    baseDist: {
      value: towerConfig.baseDistance || 24, min: 10, max: 80, step: 2, label: "Jarak Base",
      onChange: (v) => { if (setTowerConfig) setTowerConfig(prev => ({...prev, baseDistance: v})); }
    }
  }, { collapsed: false });

  useControls("World Tuning", {
    timeScale: { 
      value: settingsRef.current.timeScale, min: 0.1, max: 3.0, step: 0.1, label: "Time Scale",
      onChange: (v) => { settingsRef.current.timeScale = v; }
    },
    unitScale: { 
      value: settingsRef.current.unitScale, min: 0.2, max: 2.0, step: 0.1, label: "Unit Visual Scale",
      onChange: (v) => { settingsRef.current.unitScale = v; }
    }
  }, { collapsed: true });

  return (
    <div className={`w-full h-full overflow-hidden relative bg-black select-none touch-none ${isFullscreen ? '' : 'rounded-2xl border border-white/10 shadow-2xl'}`}>
      
      {/* Engine Bridge: Leva Console (Bottom Left) */}
      <div className={`absolute bottom-6 left-6 z-[1200] w-80 transition-all duration-300 shadow-2xl ${
        !isSettingsOpen ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 pointer-events-auto translate-y-0'
      }`}>
        <Leva 
          hidden={!isSettingsOpen} 
          theme={{
            colors: { accent1: '#6366f1', accent2: '#4f46e5', accent3: '#4338ca', elevation1: '#09090bee', elevation2: '#18181bee', elevation3: '#27272aee' },
            radii: { xs: '8px', sm: '12px', lg: '20px' }
          }}
          fill
          flat
          titleBar={{ title: "Supreme Engine Tuning", drag: false }}
        />
      </div>

      <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-[10px] text-white backdrop-blur-md border border-white/10 pointer-events-none">
        DPR: {dpr.toFixed(2)}
      </div>
      <Stats className="!absolute !bottom-4 !right-4 !left-auto !top-auto opacity-50 grayscale" />
      <Canvas
        dpr={dpr}
        camera={{ position: [0, 20, 60], fov: 40, far: 500 }}
        gl={{
          antialias: false,
          powerPreference: "high-performance",
          alpha: false
        }}
        className="select-none touch-none "
      >
        <PerformanceMonitor onIncline={() => setDpr(Math.min(dpr + 0.1, 1.0))} onDecline={() => setDpr(Math.max(dpr - 0.1, 0.7))} />
        <AdaptiveEvents />
        <AdaptiveDpr pixelated={true} />

        <OrbitControls
          makeDefault
          enablePan={!isCinematic && gameState === 'PLAYING'}
          maxPolarAngle={Math.PI / 2.1}
          minPolarAngle={Math.PI / 12}
          maxDistance={220}
          minDistance={10}
        />



        <StormEnvironment baseDistance={towerConfig.baseDistance || 24} />

        <VFXProvider>
          <CameraDirector />

          <BattleArmy
            unitRegistry={unitRegistry}
            towerConfig={towerConfig}
            updateSimulation={updateSimulation}
            settingsRef={settingsRef}
            simTimeRef={simTimeRef}
            vehicles={vehicles}
            unitIndex={unitIndex}
            spellsRef={spellsRef}
          />



          <Base
            maxHp={towerConfig.baseHp}
            position={[0, 0, towerConfig.baseDistance || 24]}
            type="player"
            name={towerConfig.player.name}
            customColor={towerConfig.player.color}
          />
          <Base
            maxHp={towerConfig.baseHp}
            position={[0, 0, -(towerConfig.baseDistance || 24)]}
            type="enemy"
            name={towerConfig.enemy.name}
            customColor={towerConfig.enemy.color}
          />

          {/* DEBUG OBSTACLES */}
          {debug && mapObstacles.map((obs: MapObstacle, i: number) => (
            <Sphere key={`debug-obs-${i}`} args={[obs.r, 16, 16]} position={[obs.x, -0.4, obs.z]}>
              <meshBasicMaterial color="yellow" wireframe transparent opacity={0.3} />
            </Sphere>
          ))}
        </VFXProvider>

        {/* Damage text removed for maximum performance and clarity as requested */}


        {/* Removed ContactShadows for massive performance boost on low-end hardware */}
      </Canvas>
    </div>
  );
});
