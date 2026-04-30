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
import { cinematicState } from "@/src/state/cinematicState";

// ---- Scratch vectors for CameraDirector (zero-alloc) ----
const _targetPos    = new THREE.Vector3();
const _focusPoint   = new THREE.Vector3();
const _camTarget    = new THREE.Vector3();
const _lookSmooth   = new THREE.Vector3();

// ---- Preallocated scratch buffers for frontline computation (zero-alloc per frame) ----
const _scratchPZ = new Float32Array(4096); // player Z positions
const _scratchPX = new Float32Array(4096); // player X positions
const _scratchEZ = new Float32Array(4096); // enemy Z positions
const _scratchEX = new Float32Array(4096); // enemy X positions
let   _frontlineFrame = 0;                 // throttle counter
let   _cachedRawFX = 0;                    // cached result between throttle frames
let   _cachedRawFZ = 0;

// Exponential decay smooth — frame-rate independent, zero jitter
function expDecay(a: number, b: number, decay: number, dt: number) {
  return b + (a - b) * Math.exp(-decay * dt);
}

const CameraDirector = ({
  isCinematic, baseDistance, unitRegistry
}: {
  isCinematic: boolean;
  baseDistance: number;
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
}) => {
  const { camera } = useThree();
  const { spawnVFX } = useVFX();
  const hasTriggeredRef = useRef(false);
  const angleIndex     = useRef(0);

  const _lastPHP = useRef(1000);
  const _lastEHP = useRef(1000);

  // Smoothed crowd focus point
  const focusX = useRef(0);
  const focusZ = useRef(0);

  // Intro sweep phase: 0 = player side, 1 = enemy side, 2 = battle tracking
  const introPhase = useRef(0);
  const introTimer = useRef(0);

  // Reset intro when cinematic is toggled on
  React.useEffect(() => {
    if (!isCinematic) {
      introPhase.current = 0;
      introTimer.current = 0;
      return;
    }
    // Reset intro sequence
    introPhase.current = 0;
    introTimer.current = 0;
  }, [isCinematic]);

  // Auto-switch battle angle every 8–18 seconds (only during battle phase)
  React.useEffect(() => {
    if (!isCinematic) return;
    let timer: NodeJS.Timeout;
    const scheduleNextSwitch = () => {
      timer = setTimeout(() => {
        if (introPhase.current >= 2) {
          angleIndex.current = (angleIndex.current + 1) % 7;
        }
        scheduleNextSwitch();
      }, 8000 + Math.random() * 10000);
    };
    scheduleNextSwitch();
    return () => clearTimeout(timer);
  }, [isCinematic]);

  useFrame((_, delta) => {
    const st = useStore.getState();
    const { gameState, playerBaseHp, enemyBaseHp } = st;
    const dt = Math.min(delta, 0.05);

    // Track HP changes for base hit detection (no shake — just tracking)
    if (playerBaseHp < _lastPHP.current || enemyBaseHp < _lastEHP.current) {
      _lastPHP.current = playerBaseHp;
      _lastEHP.current = enemyBaseHp;
    }

    // ── Cinematic Ending ──────────────────────────────────────────────────────
    if (gameState === 'WON' || gameState === 'LOST') {
      const tz = gameState === 'WON' ? -baseDistance : baseDistance;
      _targetPos.set(0, 7, tz + (gameState === 'WON' ? -12 : 12));
      camera.position.lerp(_targetPos, 0.05);
      camera.lookAt(0, 0, tz);
      if (!hasTriggeredRef.current) {
        spawnVFX([0, 0, tz], 'mega_explosion', gameState === 'WON' ? '#ef4444' : '#3b82f6');
        spawnVFX([0, 0, tz], 'shockwave', '#ffffff');
        hasTriggeredRef.current = true;
      }
      return;
    }
    hasTriggeredRef.current = false;

    if (!isCinematic) {
      _focusPoint.set(0, 0, 0);
      focusX.current = 0;
      focusZ.current = 0;
      introPhase.current = 0;
      introTimer.current = 0;
      cinematicState.isActive = false;
      return;
    }
    cinematicState.isActive = true;

    // ── Intro Sweep (before battle) ───────────────────────────────────────────
    // Phase 0: wide shot of player base (Z = +baseDistance)
    // Phase 1: sweep across to enemy base (Z = -baseDistance)
    // Phase 2: transition into battle tracking
    if (introPhase.current < 2) {
      introTimer.current += dt;

      // Check if units are actively fighting — accelerate to battle phase
      const reg = unitRegistry?.current;
      let hasActiveCombat = false;
      if (reg) {
        let count = 0;
        for (let i = 0; i < reg.length; i++) {
          if (reg[i]?.isActive && reg[i].hp > 0) { count++; if (count >= 4) { hasActiveCombat = true; break; } }
        }
      }

      if (introPhase.current === 0) {
        // Slow wide pan from player base side
        _targetPos.set(50, 22, baseDistance + 15);
        _focusPoint.set(0, 4, baseDistance);
        if (introTimer.current > 4.0 || hasActiveCombat) {
          introPhase.current = 1;
          introTimer.current = 0;
        }
      } else if (introPhase.current === 1) {
        // Sweep to enemy base
        _targetPos.set(-50, 22, -baseDistance - 15);
        _focusPoint.set(0, 4, -baseDistance);
        if (introTimer.current > 4.0 || hasActiveCombat) {
          introPhase.current = 2;
          introTimer.current = 0;
          // Seed focusX/Z near center for smooth transition into tracking
          focusX.current = 0;
          focusZ.current = 0;
        }
      }

      // Slow, sweeping camera movement for intro
      cinematicState.focusX = _focusPoint.x;
      cinematicState.focusY = _focusPoint.y;
      cinematicState.focusZ = _focusPoint.z;

      _camTarget.copy(camera.position);
      camera.position.x = expDecay(_camTarget.x, _targetPos.x, 1.2, dt);
      camera.position.y = expDecay(_camTarget.y, _targetPos.y, 1.2, dt);
      camera.position.z = expDecay(_camTarget.z, _targetPos.z, 1.2, dt);

      _lookSmooth.x = expDecay(_lookSmooth.x, _focusPoint.x, 2.0, dt);
      _lookSmooth.y = expDecay(_lookSmooth.y, _focusPoint.y, 2.0, dt);
      _lookSmooth.z = expDecay(_lookSmooth.z, _focusPoint.z, 2.0, dt);
      camera.lookAt(_lookSmooth);
      return;
    }

    // ── True Frontline Meeting Point (throttled, zero-alloc) ─────────────────
    // Compute every 4 frames to reduce CPU cost and smooth out rapid unit changes
    _frontlineFrame++;
    if (_frontlineFrame % 4 === 0) {
      const reg = unitRegistry?.current;
      if (reg && reg.length > 0) {
        let pCount = 0, eCount = 0;

        for (let i = 0; i < reg.length; i++) {
          const u = reg[i];
          if (!u || !u.isActive || u.hp <= 0) continue;
          if (u.type === 'player') {
            _scratchPZ[pCount] = u.position[2];
            _scratchPX[pCount] = u.position[0];
            pCount++;
          } else {
            _scratchEZ[eCount] = u.position[2];
            _scratchEX[eCount] = u.position[0];
            eCount++;
          }
        }

        if (pCount > 0 && eCount > 0) {
          // Sort in-place (typed array slice avoids heap alloc)
          const pZSlice = _scratchPZ.subarray(0, pCount);
          const eZSlice = _scratchEZ.subarray(0, eCount);
          pZSlice.sort(); // ascending — frontline is min Z for player
          eZSlice.sort(); // ascending — frontline is max Z (end) for enemy

          const frontN = Math.max(1, Math.floor(Math.min(pCount, eCount) * 0.25));

          let pFrontZ = 0, pFrontX = 0, eFrontZ = 0, eFrontX = 0;
          for (let i = 0; i < frontN; i++) {
            pFrontZ += pZSlice[i];              // lowest Z = most advanced player
            eFrontZ += eZSlice[eCount - 1 - i]; // highest Z = most advanced enemy
            pFrontX += _scratchPX[i];
            eFrontX += _scratchEX[eCount - 1 - i];
          }
          pFrontZ /= frontN; eFrontZ /= frontN;
          pFrontX /= frontN; eFrontX /= frontN;

          let rZ = (pFrontZ + eFrontZ) / 2;
          let rX = (pFrontX + eFrontX) / 2;

          if (rZ > baseDistance - 6)  rZ = baseDistance - 2;
          else if (rZ < -baseDistance + 6) rZ = -baseDistance + 2;

          _cachedRawFX = rX;
          _cachedRawFZ = rZ;
        }
      }
    }

    // Smooth focus toward cached raw value — very slow so camera never chases noise
    const FOCUS_DECAY = 0.9; // was 2.5 — slower = much smoother under high unit count
    const newFX = expDecay(focusX.current, _cachedRawFX, FOCUS_DECAY, dt);
    const newFZ = expDecay(focusZ.current, _cachedRawFZ, FOCUS_DECAY, dt);
    // Hard clamp: focus can never jump more than 0.25 units/frame (prevents jitter burst)
    const MAX_STEP = 0.25;
    focusX.current = Math.abs(newFX - focusX.current) > MAX_STEP
      ? focusX.current + Math.sign(newFX - focusX.current) * MAX_STEP
      : newFX;
    focusZ.current = Math.abs(newFZ - focusZ.current) > MAX_STEP
      ? focusZ.current + Math.sign(newFZ - focusZ.current) * MAX_STEP
      : newFZ;

    const fx = focusX.current;
    const fz = focusZ.current;

    // ── 7 Cinematic Angles — Medium distance for better action visibility ──
    const angle = angleIndex.current;
    if (angle === 0) {
      _targetPos.set(fx + 45, 22, fz);           // Side Right — balanced
    } else if (angle === 1) {
      _targetPos.set(fx + 35, 18, fz + 35);      // Hero Shot — balanced pull
    } else if (angle === 2) {
      _targetPos.set(fx + 45, 32, fz - 45);      // High Diagonal — balanced iso
    } else if (angle === 3) {
      _targetPos.set(fx - 45, 22, fz);           // Side Left Mirror — balanced
    } else if (angle === 4) {
      _targetPos.set(fx + 28, 18, fz + 45);      // Tracking Dolly — balanced behind
    } else {
      _targetPos.set(fx - 35, 18, fz - 35);      // Low Opposite Mirror — balanced
    }

    _focusPoint.set(fx, 1.5, fz);

    cinematicState.focusX = fx;
    cinematicState.focusY = 1.5;
    cinematicState.focusZ = fz;

    const CAM_DECAY = 1.5; // was 3.0 — camera glides, doesn't snap
    _camTarget.copy(camera.position);
    camera.position.x = expDecay(_camTarget.x, _targetPos.x, CAM_DECAY, dt);
    camera.position.y = expDecay(_camTarget.y, _targetPos.y, CAM_DECAY, dt);
    camera.position.z = expDecay(_camTarget.z, _targetPos.z, CAM_DECAY, dt);

    const LOOK_DECAY = 2.0; // was 4.0 — lookAt rotates gently
    _lookSmooth.x = expDecay(_lookSmooth.x, _focusPoint.x, LOOK_DECAY, dt);
    _lookSmooth.y = expDecay(_lookSmooth.y, _focusPoint.y, LOOK_DECAY, dt);
    _lookSmooth.z = expDecay(_lookSmooth.z, _focusPoint.z, LOOK_DECAY, dt);
    camera.lookAt(_lookSmooth);
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
          onDecline={() => setDpr(Math.max(dpr - 0.15, 0.4))}
          threshold={0.85}
          flipflops={3}
        />
        <AdaptiveEvents />
        <AdaptiveDpr pixelated={true} />

        <MapControls
          enabled={!_isCinematic}
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
            <WhimsicalDiorama baseDistance={towerConfig.baseDistance || 36} isCinematic={_isCinematic} />
          ) : (
            <StormEnvironment
              baseDistance={towerConfig.baseDistance || 36}
              potatoMode={settingsRef.current.potatoMode}
              isCinematic={_isCinematic}
            />
          )}

          <DiagnosticsBridge />
          <CameraDirector isCinematic={_isCinematic} baseDistance={towerConfig.baseDistance || 36} unitRegistry={unitRegistry} />
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
