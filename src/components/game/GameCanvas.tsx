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
import { useStore } from "@/src/state/useStore";
import { OrbitalLightning3D } from "./vfx/OrbitalLightning3D";
import { MedicalSupply3D } from "./vfx/MedicalSupply3D";
import React, { useRef, useState } from "react";
import { TowerConfig, MapObstacle, UnitRuntimeData } from "@/src/core/domain/unit.types";
import * as YUKA from "yuka";
import * as THREE from 'three';
import { cinematicState } from "@/src/state/cinematicState";

// ---- Scratch vectors for CameraDirector (zero-alloc) ----
const _targetPos    = new THREE.Vector3();
const _focusPoint   = new THREE.Vector3();
const _camTarget    = new THREE.Vector3();
const _lookSmooth   = new THREE.Vector3();

// ---- Preallocated scratch buffers for frontline computation (zero-alloc per frame) ----

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

  // Track which side to start the intro with (alternates every game)
  const introStartSide = useRef(0); // 0 = Player first, 1 = Enemy first

  // Reset intro when cinematic is toggled on
  React.useEffect(() => {
    if (!isCinematic) {
      introPhase.current = 0;
      introTimer.current = 0;
      return;
    }
    // Alternate the starting side for the next intro
    introStartSide.current = (introStartSide.current + 1) % 2;
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
          angleIndex.current = (angleIndex.current + 1) % 6;
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
    if (introPhase.current < 2) {
      introTimer.current += dt;

      const reg2 = unitRegistry?.current;
      let hasActiveCombat = false;
      if (reg2) {
        let count = 0;
        const len = Math.min(reg2.length, 50); 
        for (let i = 0; i < len; i++) {
          if (reg2[i]?.isActive && reg2[i].hp > 0) { count++; if (count >= 4) { hasActiveCombat = true; break; } }
        }
      }

      // Logic: If introStartSide is 1, we swap the targets for Phase 0 and Phase 1
      const isSwapped = introStartSide.current === 1;
      
      if (introPhase.current === 0) {
        if (!isSwapped) {
          // Normal: Start at Player Base — Ultra Wide
          _targetPos.set(120, 70, baseDistance + 50);
          _focusPoint.set(0, 2, baseDistance * 0.8);
        } else {
          // Swapped: Start at Enemy Base — Ultra Wide
          _targetPos.set(-120, 70, -baseDistance - 50);
          _focusPoint.set(0, 2, -baseDistance * 0.8);
        }
        
        if (introTimer.current > 4.0 || hasActiveCombat) {
          introPhase.current = 1;
          introTimer.current = 0;
        }
      } else if (introPhase.current === 1) {
        if (!isSwapped) {
          // Normal: Move to Enemy Base — Ultra Wide
          _targetPos.set(-120, 70, -baseDistance - 50);
          _focusPoint.set(0, 2, -baseDistance * 0.8);
        } else {
          // Swapped: Move to Player Base — Ultra Wide
          _targetPos.set(120, 70, baseDistance + 50);
          _focusPoint.set(0, 2, baseDistance * 0.8);
        }

        if (introTimer.current > 4.0 || hasActiveCombat) {
          introPhase.current = 2;
          introTimer.current = 0;
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

    const angles = [
      { pos: [-42, 30, 42], name: 'Side Left' },
      { pos: [45, 32, -45], name: 'Diagonal Front' },
      { pos: [55, 45, 55], name: 'High Diagonal' }, // Cinematic but closer than 75
      { pos: [42, 30, 42], name: 'Side Right' },
      { pos: [0, 35, 55], name: 'Dolly Track' },
      { pos: [-45, 32, -45], name: 'Diagonal Back' },
    ];

    // ── True Frontline Meeting Point (throttled, zero-alloc) ─────────────────
    // Compute every 15 frames (4x a second at 60fps) to minimize CPU cost during high unit density
    _frontlineFrame++;
    if (_frontlineFrame % 15 === 0) {
      const reg = unitRegistry?.current;
      if (reg && reg.length > 0) {
        let pFrontZ = -Infinity, pFrontX = 0;
        let eFrontZ = Infinity, eFrontX = 0;
        let pCount = 0, eCount = 0;
        
        for (let i = 0; i < reg.length; i++) {
          const u = reg[i];
          if (!u || !u.isActive || u.hp <= 0) continue;
          
          if (u.type === 'player') {
            pCount++;
            if (u.position[2] < pFrontZ || pFrontZ === -Infinity) {
              pFrontZ = u.position[2];
              pFrontX = u.position[0];
            }
          } else {
            eCount++;
            if (u.position[2] > eFrontZ || eFrontZ === Infinity) {
              eFrontZ = u.position[2];
              eFrontX = u.position[0];
            }
          }
        }

        if (pCount > 0 && eCount > 0) {
          _cachedRawFX = (pFrontX + eFrontX) / 2;
          _cachedRawFZ = (pFrontZ + eFrontZ) / 2;
        } else if (pCount > 0) {
          _cachedRawFX = pFrontX; _cachedRawFZ = pFrontZ;
        } else if (eCount > 0) {
          _cachedRawFX = eFrontX; _cachedRawFZ = eFrontZ;
        }

        if (pCount > 0 || eCount > 0) {
          if (_cachedRawFZ > baseDistance - 6)  _cachedRawFZ = baseDistance - 2;
          else if (_cachedRawFZ < -baseDistance + 6) _cachedRawFZ = -baseDistance + 2;
        }
      }
    }

    // Smooth focus toward cached raw value — much slower for cinematic smoothness
    const FOCUS_DECAY = 0.5; 
    focusX.current = expDecay(focusX.current, _cachedRawFX, FOCUS_DECAY, dt);
    focusZ.current = expDecay(focusZ.current, _cachedRawFZ, FOCUS_DECAY, dt);

    const fx = focusX.current;
    const fz = focusZ.current;

    // ── Cinematic Angles ──
    const angleIdx = angleIndex.current % angles.length;
    const currentAngle = angles[angleIdx];
    
    // Check if we are in a "Siege" state (frontline is very close to either tower)
    const isSiege = Math.abs(fz) >= baseDistance - 15;
    const siegeSide = Math.sign(fz); // 1 = player tower side (z>0), -1 = enemy tower side (z<0)
    
    if (isSiege) {
      // --- TOWER CINEMATIC ANGLES ---
      const towerZ = siegeSide * baseDistance;
      const siegeAngle = angleIndex.current % 2;

      if (siegeAngle === 0) {
        // Angle 1: "Defender's View" 
        // Kamera diperjauh dan dinaikkan agar label terlihat jelas
        _targetPos.set(siegeSide * 35, 35, towerZ - siegeSide * 35);
        _focusPoint.set(fx, 2, fz); 
      } else {
        // Angle 2: "Frontal Siege" 
        _targetPos.set(-35, 30, fz - siegeSide * 40);
        _focusPoint.set(0, 6, towerZ); 
      }
    } else {
      // --- NORMAL BATTLE ANGLES --- 
      // Use the pre-defined cinematic angles array
      if (angleIdx === 4) { // Dolly Track (Follows the focus point)
        _targetPos.set(fx + currentAngle.pos[0], currentAngle.pos[1], fz + currentAngle.pos[2]);
      } else {
        // Fixed position angles
        _targetPos.set(currentAngle.pos[0], currentAngle.pos[1], currentAngle.pos[2]);
      }
      _focusPoint.set(fx, 1.5, fz);
    }
    
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
  useControls("Tactical Support", {
    triggerFever: {
      label: "🔥 Trigger Fever Time",
      value: false,
      onChange: (v) => { if(v) { useStore.getState().triggerFeverTime(); } }
    },
    triggerLightning: {
      label: "⚡ Trigger Orbital Strike",
      value: false,
      onChange: (v) => { if(v) { useStore.getState().triggerOrbitalLightning(); } }
    },
    triggerHeal: {
      label: "📦 Trigger Medical Supply",
      value: false,
      onChange: (v) => { if(v) { useStore.getState().triggerMedicalSupply(); } }
    }
  }, { collapsed: false });

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
        dpr={[1, 1.5]}    // OPTIMIZATION: Cap at 1.5x instead of 2-3x for mobile high-res stability
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

          <OrbitalLightning3D />
          <MedicalSupply3D />

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

        {/* Post Processing — DIMATIKAN SEMENTARA UNTUK FPS MAKSIMAL */}
        {gameState !== 'SETUP' && !settingsRef.current.potatoMode && (
          /*
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
          */
          null
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
