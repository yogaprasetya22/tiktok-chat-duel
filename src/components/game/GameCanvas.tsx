'use client';

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  MapControls,
  StatsGl,
  PerformanceMonitor,
  AdaptiveEvents,
  AdaptiveDpr,
  Sphere,
  KeyboardControls,
} from "@react-three/drei";
import { useControls, Leva, folder } from "leva";
import dynamic from 'next/dynamic';

const Perf = dynamic(() => import("r3f-perf").then((mod) => mod.Perf), { ssr: false });

import { VFXProvider, useVFX } from "./systems/VFXManager";
import { BattleArmy } from "./systems/BattleArmy";
import { WhimsicalDiorama } from "./environment/WhimsicalDiorama";
import { StormEnvironment } from "./environment/StormEnvironment";
import { DamageHUDBatcher } from "./systems/DamageHUDBatcher";

import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";

import { TowerConfig, MapObstacle, UnitRuntimeData } from "@/src/core/domain/unit.types";

import { useStore } from "@/src/state/useStore";
import React, { useState, useRef, useEffect } from "react";
import { Activity, RefreshCw } from "lucide-react";
import * as THREE from 'three';
import { PlayerController, keyboardMap } from "./PlayerController";


// Map removed as requested. Base ground provided by OrbitControls/Sky.

// --- Camera Director for Epic Endings & Shake ---
const _targetPos = new THREE.Vector3(); // Fix #4: zero-alloc, reused per frame

const CameraDirector = () => {
  const { camera } = useThree();
  const { spawnVFX } = useVFX();
  const hasTriggeredRef = useRef(false);

  const lastBaseHp = useRef({ player: 1000, enemy: 1000 });
  const shakeIntensity = useRef(0);

  useFrame((_, delta) => {
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


/**
 * SceneAnalyzer - Diagnostic Tool
 * Scans the scene and logs heavy-hitting meshes and texture counts.
 */
const SceneAnalyzer = () => {
  const { scene, gl } = useThree();
  const lastLog = useRef(0);

  useFrame((state) => {
    const now = state.clock.elapsedTime;
    if (now - lastLog.current < 5) return; // Run every 5 seconds
    lastLog.current = now;

    let totalTriangles = 0;
    const meshes: any[] = [];
    const textures = new Set();

    scene.traverse((node: any) => {
      if (node.isMesh || node.isInstancedMesh) {
        const geometry = node.geometry;
        if (geometry) {
          const count = geometry.index ? geometry.index.count : geometry.attributes.position.count;
          const triangles = (count / 3) * (node.isInstancedMesh ? node.count : 1);
          totalTriangles += triangles;
          meshes.push({
            name: node.name || node.type,
            triangles: Math.round(triangles),
            isInstanced: !!node.isInstancedMesh
          });
        }

        const scanMaterial = (mat: any) => {
          if (!mat) return;
          if (Array.isArray(mat)) {
            mat.forEach(scanMaterial);
            return;
          }
          Object.values(mat).forEach(val => {
            if (val && (val as any).isTexture) textures.add((val as any).uuid);
          });
        };
        scanMaterial(node.material);
      }
    });

    meshes.sort((a, b) => b.triangles - a.triangles);

    console.log("%c--- 3D SCENE HEAVY HITTER REPORT ---", "color: #ff00ff; font-weight: bold; font-size: 14px;");
    console.log(`Total Triangles: ~${(totalTriangles / 1000000).toFixed(2)}M`);
    console.log(`Unique Textures: ${textures.size}`);
    console.log("Top 10 Heavy Meshes:", meshes.slice(0, 10));
    console.log(`GPU Memory: ~${(gl.info.memory.geometries + gl.info.memory.textures)} objects in GPU`);
    console.log("--------------------------------------");
  });

  return null;
};


interface GameCanvasProps {
  towerConfig: TowerConfig;
  isCinematic: boolean;
  setMapObstacles: (obs: MapObstacle[]) => void;
  mapObstacles: MapObstacle[];
  debug: boolean;
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  isFullscreen?: boolean;
  updateSimulation: (delta: number) => void;
  damageQueue: React.RefObject<any[]>;
  settingsRef: React.RefObject<any>;
  simTimeRef: React.RefObject<number>;
  setTowerConfig?: (config: TowerConfig | ((prev: TowerConfig) => TowerConfig)) => void;
  spellsRef: React.RefObject<any[]>;
  mmSpellsRef: React.RefObject<any[]>;
  fighterSpellsRef: React.RefObject<any[]>;
  tankSpellsRef: React.RefObject<any[]>;
  assassinSpellsRef: React.RefObject<any[]>;
  downloadPerfLogs?: () => void;
  clearVFXCache?: () => void;
  compBuffers?: any;
  spawnUnit?: (level?: number, userName?: string, type?: "player" | "enemy", isBoss?: boolean, forcedClass?: any, profileImage?: string, forcedRarity?: any, customPos?: [number, number, number]) => void;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean) => void;
}


export const GameCanvas = React.memo(({
  towerConfig,
  isCinematic: _isCinematic,
  mapObstacles,
  debug,
  unitRegistry,
  isFullscreen,
  updateSimulation,
  damageQueue,
  spawnUnit,
  settingsRef,
  simTimeRef,
  setTowerConfig,
  spellsRef,
  mmSpellsRef,
  fighterSpellsRef,
  tankSpellsRef,
  assassinSpellsRef,
  downloadPerfLogs,
  clearVFXCache,
  compBuffers,
  dealPlayerDamage,
}: GameCanvasProps) => {

  const [dpr, setDpr] = useState(1.0);
  const [envReady, setEnvReady] = useState(false); // Terrain BVH readiness gate
  const gameState = useStore(s => s.gameState);
  const isSettingsOpen = useStore(s => s.isSettingsOpen);
  const environment = useStore(s => s.environment);
  const setEnvironment = useStore(s => s.setEnvironment);

  // Reset env gate whenever environment type changes so character re-waits for new BVH
  useEffect(() => {
    setEnvReady(false);
  }, [environment]);


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
      value: towerConfig.maxUnits, min: 1, max: 300, step: 1, label: "Max Units",
      onChange: (v) => { if (setTowerConfig) setTowerConfig(prev => ({ ...prev, maxUnits: v })); }
    },
    baseHp: {
      value: towerConfig.baseHp, min: 500, max: 200000, step: 100, label: "Tower HP",
      onChange: (v) => { if (setTowerConfig) setTowerConfig(prev => ({ ...prev, baseHp: v })); }
    },
    baseDist: {
      value: towerConfig.baseDistance || 24, min: 10, max: 80, step: 2, label: "Jarak Base",
      onChange: (v) => { if (setTowerConfig) setTowerConfig(prev => ({ ...prev, baseDistance: v })); }
    }
  }, { collapsed: false });

  const { fov, fogDensity, exposure } = useControls("World Tuning", {
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
    mapType: {
      value: environment,
      options: ["DIORAMA", "STORM"],
      label: "Map Environment",
      onChange: (v) => setEnvironment(v)
    },
    fov: { value: 50, min: 30, max: 90, step: 1, label: "Field of View (FOV)" },
    fogDensity: { value: 0.002, min: 0, max: 0.05, step: 0.0001, label: "Fog Density" },
    fogNear: { value: 60, min: 10, max: 300, step: 5, label: "Fog Near" },
    fogFar: { value: 450, min: 100, max: 1000, step: 10, label: "Fog Far" },
    exposure: { value: 2.0, min: 0.1, max: 4.0, step: 0.1, label: "Sky Exposure" },


    sensitivity: { 
      value: settingsRef.current.mouseSensitivity || 0.002, min: 0.0005, max: 0.01, step: 0.0001, label: "Mouse Sensitivity",
      onChange: (v) => { settingsRef.current.mouseSensitivity = v; }
    },
    vfxQuality: {
      value: settingsRef.current.vfxQuality || 'HIGH', options: ['LOW', 'MEDIUM', 'HIGH'], label: 'VFX Quality',
      onChange: (v) => { settingsRef.current.vfxQuality = v; }
    }

  }, { collapsed: true }) as any;

  useEffect(() => {
    if (envReady && spawnUnit) {
      // Spawn enemies at different points (Scattered across the map)
      spawnUnit(10, "Guest", "enemy", false, "tank", undefined, undefined, [15, -0.4, -20]);
      spawnUnit(10, "Guest", "enemy", false, "fighter", undefined, undefined, [0, -0.4, -35]);
      spawnUnit(10, "Guest", "enemy", false, "mage", undefined, undefined, [-15, -0.4, -20]);
      spawnUnit(10, "Guest", "enemy", false, "marksman", undefined, undefined, [25, -0.4, -10]);
      spawnUnit(10, "Guest", "enemy", false, "assassin", undefined, undefined, [-25, -0.4, -10]);
    }
  }, [envReady, spawnUnit]);



  const [{ perfPosition, minimal, deepAnalyze, showPerf }, setDiag] = useControls("Diagnostics", () => ({
    engineTime: { value: 0, label: "Engine Tick (ms)", editable: false },
    units: { value: 0, label: "Active Units", editable: false },
    vfx: { value: 0, label: "Active Particles", editable: false },
    triangles: { value: 0, label: "Estimated Triangles", editable: false },
    suspect: { value: "OPTIMAL", label: "Lag Suspect", editable: false },
    "Performance Tool": folder({
      showPerf: { value: false, label: "Show R3F-Perf" },
      perfPosition: {
        value: "top-right",
        options: ["top-right", "top-left", "bottom-right", "bottom-left"],
        label: "Monitor Position"
      },
      minimal: { value: false, label: "Minimal Stats" },
      deepAnalyze: { value: false, label: "Deep Memory Profile" }
    })
  }), { collapsed: true });

  // Fix: Move useFrame inside a child component that sits inside <Canvas>
  const DiagnosticsBridge = () => {
    const lastUpdate = useRef(0);
    useFrame((state) => {
      const now = state.clock.elapsedTime * 1000;
      if (now - lastUpdate.current > 1000) {
        lastUpdate.current = now;
        if (settingsRef.current.telemetry) {
          const { engineMs, unitCount, vfxCount, bottleneck } = settingsRef.current.telemetry;
          setDiag({ engineTime: engineMs, units: unitCount, vfx: vfxCount, suspect: bottleneck });
        }
      }
    });
    return null;
  };

  const VisualTuningBridge = ({ fov, fogDensity, exposure }: { fov: number, fogDensity: number, exposure: number }) => {
    const { camera, scene, gl } = useThree();

    useEffect(() => {
      if (camera && (camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
        (camera as THREE.PerspectiveCamera).fov = (fov as number);
        (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
      }
    }, [camera, fov]);

    useEffect(() => {
      if (scene.fog) {
        (scene.fog as any).density = fogDensity;
      }
    }, [scene, fogDensity]);

    useEffect(() => {
      gl.toneMappingExposure = exposure;
    }, [gl, exposure]);

    return null;
  };

  return (
    <div className={`w-full h-full overflow-hidden relative bg-black select-none touch-none ${isFullscreen ? '' : 'rounded-2xl border border-white/10 shadow-2xl'}`}>

      {/* Engine Bridge: Leva Console (Bottom Left) */}
      <div className={`absolute bottom-6 left-6 z-[1200] w-80 transition-all duration-300 shadow-2xl ${!isSettingsOpen ? 'opacity-0 pointer-events-none translate-y-4' : 'opacity-100 pointer-events-auto translate-y-0'
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

        {/* Performance Downloader */}
        <button
          onClick={downloadPerfLogs}
          title="Download Performance Analysis Report"
          className="mt-4 w-full py-3 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-2xl flex items-center justify-center gap-3 text-indigo-400 hover:text-indigo-300 transition-all group"
        >
          <Activity className="w-4 h-4 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Download Performance Report</span>
        </button>

        <button
          onClick={clearVFXCache}
          className="mt-2 w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded-2xl flex items-center justify-center gap-3 text-rose-400 hover:text-rose-300 transition-all group"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          <span className="text-[10px] font-black uppercase tracking-widest">Clear VFX Cache</span>
        </button>
      </div>

      <div className="absolute top-4 left-4 z-10 bg-black/50 p-2 rounded text-[10px] text-white backdrop-blur-md border border-white/10 pointer-events-none">
        DPR: {dpr.toFixed(2)}
      </div>
      <KeyboardControls map={keyboardMap}>
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        dpr={dpr}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          logarithmicDepthBuffer: false,
          stencil: false,
          depth: true,
          alpha: false,
          failIfMajorPerformanceCaveat: false,
          precision: "mediump",
        }}

        className="select-none touch-none "
      >
        <SceneAnalyzer />
        <StatsGl className="!absolute !top-24 !left-2 !right-auto !bottom-auto !z-[2000]" />
        <PerformanceMonitor onIncline={() => setDpr(Math.min(dpr + 0.05, 0.9))} onDecline={() => setDpr(Math.max(dpr - 0.05, 0.6))} />

        <AdaptiveEvents />
        <AdaptiveDpr pixelated={true} />

        {showPerf && (
          <Perf
            position={perfPosition}
            minimal={minimal}
            showGraph={!minimal}
            deepAnalyze={deepAnalyze}
            className="z-[2000]"
          />
        )}

        {!isFullscreen && !envReady && (
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
        )}



          {environment === 'DIORAMA' ? (
            <WhimsicalDiorama
              baseDistance={towerConfig.baseDistance || 24}
              settingsRef={settingsRef}
              debug={debug}
              onReady={() => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => setEnvReady(true));
                });
              }}
            />
          ) : (
            <StormEnvironment
              baseDistance={towerConfig.baseDistance || 24}
              potatoMode={settingsRef.current.potatoMode}
              debug={debug}
              onReady={() => {
                // Extra rAF buffer: ensures StaticCollider has fully
                // registered the BVH before un-pausing the character
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => setEnvReady(true));
                });
              }}
            />
          )}


          <DiagnosticsBridge />
          <VisualTuningBridge fov={fov} fogDensity={fogDensity} exposure={exposure} />

          <VFXProvider>
            <CameraDirector />
            <DamageHUDBatcher damageQueue={damageQueue} />

            <BattleArmy
              unitRegistry={unitRegistry}
              towerConfig={towerConfig}
              updateSimulation={updateSimulation}
              settingsRef={settingsRef}
              simTimeRef={simTimeRef}
              spellsRef={spellsRef}
              mmSpellsRef={mmSpellsRef}
              fighterSpellsRef={fighterSpellsRef}
              tankSpellsRef={tankSpellsRef}
              assassinSpellsRef={assassinSpellsRef}
              compBuffers={compBuffers}
            />



            {/* BASE AND TOWERS HIDDEN — enemies now target player character */}

            <PlayerController
              damageQueue={damageQueue}
              settingsRef={settingsRef}
              paused={!envReady}
              unitRegistry={unitRegistry}
              dealPlayerDamage={dealPlayerDamage}
            />
            


            {/* DEBUG OBSTACLES */}
            {debug && mapObstacles.map((obs: MapObstacle, i: number) => (
              <Sphere key={`debug-obs-${i}`} args={[obs.r, 16, 16]} position={[obs.x, -0.4, obs.z]}>
                <meshBasicMaterial color="yellow" wireframe transparent opacity={0.3} />
              </Sphere>
            ))}
          </VFXProvider>

        {/* Damage text removed for maximum performance and clarity as requested */}


        {/* Post Processing: Disabled during SETUP for CPU/GPU savings */}
        {gameState !== 'SETUP' && !settingsRef.current.potatoMode && (
          <EffectComposer enableNormalPass={false} multisampling={0}>
            <Bloom
              luminanceThreshold={1.0}
              mipmapBlur
              intensity={0.5}
              radius={0.4}
            />
            <ToneMapping adaptive={false} />
          </EffectComposer>
        )}
      </Canvas>
      </KeyboardControls>
    </div>
  );
});
