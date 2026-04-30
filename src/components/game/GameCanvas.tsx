'use client';

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MapControls,
  PerformanceMonitor,
  AdaptiveEvents,
  AdaptiveDpr,
  Sphere,
} from "@react-three/drei";
import { useControls, Leva } from "leva";

import { Base, InstancedTowers } from "./environment/Base";
import { VFXProvider, useVFX } from "./systems/VFXManager";
import { BattleArmy } from "./systems/BattleArmy";
import { WhimsicalDiorama } from "./environment/WhimsicalDiorama";
import { StormEnvironment } from "./environment/StormEnvironment";
import { DamageHUDBatcher } from "./systems/DamageHUDBatcher";
import { Perf } from "r3f-perf";

import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";

import { TowerConfig, MapObstacle, UnitRuntimeData } from "@/src/core/domain/unit.types";
import * as YUKA from "yuka";
import { useStore } from "@/src/state/useStore";
import React, { useState, useRef } from "react";
import * as THREE from 'three';

// ---- Scratch vector for CameraDirector (zero-alloc) ----
const _targetPos = new THREE.Vector3();

const CameraDirector = () => {
  const { camera } = useThree();
  const { spawnVFX } = useVFX();
  const hasTriggeredRef = useRef(false);
  const lastBaseHp = useRef({ player: 1000, enemy: 1000 });
  const shakeIntensity = useRef(0);

  const _lastPHP = useRef(1000);
  const _lastEHP = useRef(1000);

  useFrame((_, delta) => {
    // Baca store SATU KALI per frame via getState() — hindari triple call
    const st = useStore.getState();
    const gameState = st.gameState;
    const playerBaseHp = st.playerBaseHp;
    const enemyBaseHp = st.enemyBaseHp;

    // Damage Shake
    if (playerBaseHp < _lastPHP.current || enemyBaseHp < _lastEHP.current) {
      shakeIntensity.current = 0.25;
      _lastPHP.current = playerBaseHp;
      _lastEHP.current = enemyBaseHp;
      lastBaseHp.current = { player: playerBaseHp, enemy: enemyBaseHp };
    }
    if (shakeIntensity.current > 0.01) {
      camera.position.x += (Math.random() - 0.5) * shakeIntensity.current;
      camera.position.y += (Math.random() - 0.5) * shakeIntensity.current;
      shakeIntensity.current -= delta * 2.2;
    } else {
      shakeIntensity.current = 0;
    }

    // Cinematic Ending
    if (gameState === 'WON' || gameState === 'LOST') {
      const targetZ = gameState === 'WON' ? -18 : 18;
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

// ---- Props ----
interface GameCanvasProps {
  towerConfig: TowerConfig;
  isCinematic: boolean;
  setMapObstacles: (obs: MapObstacle[]) => void;
  mapObstacles: MapObstacle[];
  debug: boolean;
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  updateSimulation: (delta: number) => void;
  damageQueue: React.RefObject<any[]>;
  settingsRef: React.RefObject<any>;
  simTimeRef: React.RefObject<number>;
  setTowerConfig?: (config: TowerConfig | ((prev: TowerConfig) => TowerConfig)) => void;
  vehicles: React.RefObject<YUKA.Vehicle[]>;
  unitIndex: React.RefObject<Map<string, any>>;
  spellsRef: React.RefObject<any[]>;
  mmSpellsRef: React.RefObject<any[]>;
  fighterSpellsRef: React.RefObject<any[]>;
  tankSpellsRef: React.RefObject<any[]>;
  assassinSpellsRef: React.RefObject<any[]>;
  compBuffers: any;
}

export const GameCanvas = React.memo(({
  towerConfig,
  isCinematic: _isCinematic,
  mapObstacles,
  debug,
  unitRegistry,
  updateSimulation,
  damageQueue,
  settingsRef,
  simTimeRef,
  setTowerConfig,
  vehicles,
  unitIndex,
  spellsRef,
  mmSpellsRef,
  fighterSpellsRef,
  tankSpellsRef,
  assassinSpellsRef,
  compBuffers,
}: GameCanvasProps) => {

  const [dpr, setDpr] = useState(1.0);
  const gameState = useStore(s => s.gameState);
  const isSettingsOpen = useStore(s => s.isSettingsOpen);
  const environment = useStore(s => s.environment);
  const setEnvironment = useStore(s => s.setEnvironment);

  // ---- Engine Tuning (Leva) ----
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
      value: towerConfig.maxUnits, min: 1, max: 300, step: 1, label: "Max Units",
      onChange: (v) => { if (setTowerConfig) setTowerConfig(prev => ({ ...prev, maxUnits: v })); }
    },
    baseHp: {
      value: towerConfig.baseHp, min: 500, max: 200000, step: 100, label: "Tower HP",
      onChange: (v) => { if (setTowerConfig) setTowerConfig(prev => ({ ...prev, baseHp: v })); }
    },
    baseDist: {
      value: towerConfig.baseDistance || 36, min: 10, max: 80, step: 2, label: "Jarak Base",
      onChange: (v) => { if (setTowerConfig) setTowerConfig(prev => ({ ...prev, baseDistance: v })); }
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
    },
    potato: {
      value: !!settingsRef.current.potatoMode, label: "Potato Mode (Extreme FPS)",
      onChange: (v) => { settingsRef.current.potatoMode = v; }
    },
    showPerf: { value: false, label: "Show Perf Monitor" },
    mapType: {
      value: environment,
      options: ["DIORAMA", "STORM"],
      label: "Map Environment",
      onChange: (v) => setEnvironment(v)
    }
  }, { collapsed: true });

  const { showPerf } = useControls("World Tuning", {
    showPerf: { value: false, label: "Show Perf Monitor" },
  });

  // ---- Diagnostics Bridge ----
  const DiagnosticsBridge = () => {
    const lastUpdate = useRef(0);
    useFrame((state) => {
      const now = state.clock.elapsedTime * 1000;
      if (now - lastUpdate.current > 1000) {
        lastUpdate.current = now;
      }
    });
    return null;
  };

  return (
    <>
      <Canvas
        camera={{
          position: [0, 0.5, 5],
          fov: 40,
          near: 0.1,
          far: 500  // Dikurangi: depth buffer lebih presisi, less overdraw
        }}
        shadows={false}  // DIMATIKAN: PCFShadowMap sangat mahal, tidak visible dari atas
        dpr={dpr}
        gl={{
          antialias: false,  // DIMATIKAN: 2x GPU cost. Bloom sudah memberi glow anti-alias visual
          powerPreference: "high-performance",
          logarithmicDepthBuffer: false,
          stencil: false,
          depth: true,
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        className="select-none touch-none"
      >
      <PerformanceMonitor
        onIncline={() => setDpr(Math.min(dpr + 0.1, 1.0))}
        onDecline={() => setDpr(Math.max(dpr - 0.1, 0.75))} // Jangan sampai terlalu ngeblur, min 0.75
        threshold={0.85}
        flipflops={3}
      />
      <AdaptiveEvents />
      <AdaptiveDpr pixelated={true} />

      <MapControls
        enableDamping={true}
        dampingFactor={0.05}
        screenSpacePanning={false}
        minDistance={10}
        maxDistance={350}
        maxPolarAngle={Math.PI / 2.5}
        minPolarAngle={0}
        makeDefault
      />

      {showPerf && <Perf position="bottom-left" />}

      <VFXProvider>
        {environment === 'DIORAMA' ? (
          <WhimsicalDiorama baseDistance={towerConfig.baseDistance || 36} />
        ) : (
          <StormEnvironment
            baseDistance={towerConfig.baseDistance || 36}
            potatoMode={settingsRef.current.potatoMode}
          />
        )}

        <DiagnosticsBridge />
        <CameraDirector />
        <DamageHUDBatcher damageQueue={damageQueue} />

        <BattleArmy
          unitRegistry={unitRegistry}
          towerConfig={towerConfig}
          updateSimulation={updateSimulation}
          settingsRef={settingsRef}
          simTimeRef={simTimeRef}
          vehicles={vehicles}
          unitIndex={unitIndex}
          spellsRef={spellsRef}
          mmSpellsRef={mmSpellsRef}
          fighterSpellsRef={fighterSpellsRef}
          tankSpellsRef={tankSpellsRef}
          assassinSpellsRef={assassinSpellsRef}
          compBuffers={compBuffers}
        />

        <InstancedTowers
          distance={towerConfig.baseDistance || 36}
          settingsRef={settingsRef}
        />

        <Base
          maxHp={towerConfig.baseHp}
          position={[0, 0, towerConfig.baseDistance || 36]}
          type="player"
          name={towerConfig.player.name}
          customColor={towerConfig.player.color}
          flagUrl={towerConfig.player.flagUrl}
        />
        <Base
          maxHp={towerConfig.baseHp}
          position={[0, 0, -(towerConfig.baseDistance || 36)]}
          type="enemy"
          name={towerConfig.enemy.name}
          customColor={towerConfig.enemy.color}
          flagUrl={towerConfig.enemy.flagUrl}
        />

        {/* Debug Obstacles */}
        {debug && mapObstacles.map((obs: MapObstacle, i: number) => (
          <Sphere key={`debug-obs-${i}`} args={[obs.r, 16, 16]} position={[obs.x, -0.4, obs.z]}>
            <meshBasicMaterial color="yellow" wireframe transparent opacity={0.3} />
          </Sphere>
        ))}
      </VFXProvider>

      {/* Post Processing — Ringan: threshold tinggi agar hanya efek bersinar yg kena bloom */}
      {gameState !== 'SETUP' && !settingsRef.current.potatoMode && (
        <EffectComposer enableNormalPass={false} multisampling={0}>
          <Bloom
            luminanceThreshold={1.2}
            mipmapBlur={false}
            intensity={0.3}
            radius={0.25}
            levels={3}
          />
          <ToneMapping adaptive={false} />
        </EffectComposer>
      )}
    </Canvas>

    {/* Leva Engine Console (Settings Panel, OUTSIDE canvas) */}
    {isSettingsOpen && (
      <Leva
        hidden={!isSettingsOpen}
        theme={{
          colors: {
            accent1: '#6366f1', accent2: '#4f46e5', accent3: '#4338ca',
            elevation1: '#09090bee', elevation2: '#18181bee', elevation3: '#27272aee'
          },
          radii: { xs: '8px', sm: '12px', lg: '20px' }
        }}
        fill flat
        titleBar={{ title: "Engine Tuning", drag: false }}
      />
    )}
    </>
  );
});
