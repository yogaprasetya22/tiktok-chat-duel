'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useVFX } from './VFXManager';
import { ActiveUnit, TowerConfig, SimulationSettings, UnitRuntimeData } from '@/src/core/domain/unit.types';
import * as YUKA from 'yuka';
import { FighterArmy } from './armies/FighterArmy';
import { TankArmy } from './armies/TankArmy';
import { MageArmy } from './armies/MageArmy';
import { MarksmanArmy } from './armies/MarksmanArmy';
import { AssassinArmy } from './armies/AssassinArmy';
import { InstancedImpostorRenderer } from './armies/InstancedImpostorRenderer';
import { MageSpellEffect, SpellEntry } from './effects/MageSpellEffect';
import { MMSpellEffect } from './effects/MMSpellEffect';
import { FighterSpellEffect } from './effects/FighterSpellEffect';
import { TankSpellEffect } from './effects/TankSpellEffect';
import { AssassinSpellEffect } from './effects/AssassinSpellEffect';

interface BattleArmyProps {
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  towerConfig: TowerConfig;
  updateSimulation: (delta: number) => void;
  settingsRef: React.RefObject<SimulationSettings>;
  simTimeRef: React.RefObject<number>;
  vehicles: React.RefObject<YUKA.Vehicle[]>;
  unitIndex: React.RefObject<Map<string, ActiveUnit>>;
  spellsRef: React.RefObject<SpellEntry[]>;
  mmSpellsRef: React.RefObject<SpellEntry[]>;
  fighterSpellsRef: React.RefObject<any[]>;
  tankSpellsRef: React.RefObject<any[]>;
  assassinSpellsRef: React.RefObject<any[]>;
  vfxRef?: React.RefObject<any>;
}



const MAX_UNITS = 300; // Matched with optimized simulation pool
const NAME_POOL_SIZE = 120; // Safe high-performance limit for standard battles


const tempObject = new THREE.Object3D();

// Pre-computed hide matrix — avoids recomputing position+scale+updateMatrix per cleanup slot
const _hideObj = new THREE.Object3D();
_hideObj.position.set(0, -100, 0);
_hideObj.scale.set(0, 0, 0);
_hideObj.updateMatrix();
const _hideMatrix = _hideObj.matrix.clone();



const LEVEL_COLORS: Record<number, string> = {
  1: '#FFFFFF', 2: '#4CAF50', 3: '#2196F3', 4: '#9c27b0', 5: '#facc15',
};
const getLevelColor = (level: number): string => LEVEL_COLORS[Math.min(level, 5)] ?? '#FFFFFF';
const getLevelBadge = (level: number): string => {
  if (level >= 5) return '[GODLY] ';
  if (level >= 4) return '[ELITE] ';
  if (level >= 3) return '[PRO] ';
  return '';
};



const MLHealthBarShader = {
  uniforms: { time: { value: 0 } },
  vertexShader: `
    attribute float aMaxHp;
    varying vec2 vUv;
    varying float vMaxHp;
    void main() {
      vUv = uv; vMaxHp = aMaxHp;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vMaxHp;
    void main() {
      float x = vUv.x;
      if (x < 0.01 || x > 0.99) discard;
      float totalSmallSegments = vMaxHp / 250.0;
      float smallNotchStep = 1.0 / totalSmallSegments;
      float smallNotch = mod(x, smallNotchStep);
      float thickNotchStep = 1.0 / (vMaxHp / 1000.0);
      float thickNotch = mod(x, thickNotchStep);
      if (thickNotch < 0.018 && vMaxHp > 1000.0) gl_FragColor = vec4(0.0, 0.0, 0.0, 0.9);
      else if (smallNotch < 0.01) gl_FragColor = vec4(0.0, 0.0, 0.0, 0.4);
      else discard;
    }
  `
};

const BattleArmyComponent = ({
  unitRegistry, towerConfig, updateSimulation, settingsRef, simTimeRef,
  vehicles, unitIndex, spellsRef, mmSpellsRef, fighterSpellsRef,
  tankSpellsRef, assassinSpellsRef, vfxRef
}: BattleArmyProps) => {
  const shadowRef = useRef<THREE.InstancedMesh>(null!);
  const healthBgRef = useRef<THREE.InstancedMesh>(null!);
  const healthFillRef = useRef<THREE.InstancedMesh>(null!);
  const notchRef = useRef<THREE.InstancedMesh>(null!);

  const { spawnVFX } = useVFX();

  // Shared ref: each army class adds its rendered unit IDs here each frame.
  // The InstancedImpostorRenderer reads this to skip already-rendered units.
  const renderedIdsRef = useRef<Set<string>>(new Set());

  // --- VFX BRIDGE: Link the context to the ref ---
  useEffect(() => {
    if (vfxRef && !vfxRef.current) {
      vfxRef.current = { spawnVFX };
    }
  }, [spawnVFX, vfxRef]);



  useEffect(() => {
    if (notchRef.current) {
      const maxHpArray = new Float32Array(MAX_UNITS).fill(250);
      const attr = new THREE.InstancedBufferAttribute(maxHpArray, 1);
      notchRef.current.geometry.setAttribute('aMaxHp', attr);
    }

    tempObject.position.set(0, -1000, 0);
    tempObject.scale.set(0, 0, 0);
    tempObject.updateMatrix();
    if (shadowRef.current) {
      for (let i = 0; i < MAX_UNITS; i++) {
        shadowRef.current.setMatrixAt(i, tempObject.matrix);
        healthBgRef.current?.setMatrixAt(i, tempObject.matrix);
        healthFillRef.current?.setMatrixAt(i, tempObject.matrix);
        notchRef.current?.setMatrixAt(i, tempObject.matrix);
      }
      shadowRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  const healthGeo = useMemo(() => new THREE.PlaneGeometry(0.8, 0.12), []);
  const shadowGeo = useMemo(() => new THREE.CircleGeometry(0.6, 12), []);
  const healthBgMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.85, depthWrite: false }), []);
  const healthFillMat = useMemo(() => new THREE.MeshBasicMaterial({ vertexColors: false, depthWrite: false }), []);
  const notchMat = useMemo(() => new THREE.ShaderMaterial({ ...MLHealthBarShader, transparent: true, depthWrite: false }), []);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }), []);

  useEffect(() => { if (healthFillMat) healthFillMat.transparent = true; }, [healthFillMat]);

  const nameGroupRef = useRef<THREE.Group>(null!);
  const namePoolMap = useRef<Map<string, number>>(new Map());
  const nameAvailableSlots = useRef<number[]>(Array.from({ length: NAME_POOL_SIZE }, (_, i) => i));
  const nameTextRefs = useRef<(any | null)[]>(Array(NAME_POOL_SIZE).fill(null));
  const nameSlotContent = useRef<string[]>(Array(NAME_POOL_SIZE).fill(''));
  const nameSlotColor = useRef<string[]>(Array(NAME_POOL_SIZE).fill('#ffffff'));

  const lastNameCullTime = useRef(0);
  const cachedActiveUnits = useRef<any[]>([]);
  const frameCountRef = useRef(0);

  const simAccumulator = useRef(0);
  const SIM_STEP = 1 / 30; // 30Hz Logic
  useFrame((state, delta) => {
    // 1. HARD CLAMPING (ANTI-FAST-FORWARD & AUTO SLOW-MO)
    // Rule: If frame time > 100ms, we force the physics to process only 33ms or 66ms.
    // This makes the game run in "Bullet Time" (slow-motion) during lag spikes
    // instead of exploding with speed bursts once the lag ends.
    let simulationDelta = delta;
    if (delta > 0.1) simulationDelta = SIM_STEP; // Force Slow-Mo if lagging > 10fps

    const clampedDelta = Math.min(SIM_STEP * 2, simulationDelta);
    simAccumulator.current += clampedDelta;

    let steps = 0;
    while (simAccumulator.current >= SIM_STEP && steps < 2) {
      updateSimulation(SIM_STEP);
      simAccumulator.current -= SIM_STEP;
      steps++;
    }

    // Safety: discard any extra accumulated time to prevent "Future Catch-up"
    if (simAccumulator.current > SIM_STEP) simAccumulator.current = 0;

    // DIAGNOSTIC LOCK: Prove to user the clock is stable
    if (frameCountRef.current % 180 === 0) {
      console.log(`[Jam Internal] Locked: ${SIM_STEP.toFixed(4)}s | Buffer: ${simAccumulator.current.toFixed(4)}s`);
    }

    const rawMap = unitRegistry.current;
    if (!rawMap) return;

    const time = state.clock.elapsedTime;
    const camPos = state.camera.position;
    frameCountRef.current++;

    // PERFORMANCE: Throttle sorting and unit filtering to every 5 frames
    if (frameCountRef.current % 5 === 0 || cachedActiveUnits.current.length === 0) {
      const activeUnits: any[] = [];
      for (let i = 0; i < rawMap.length; i++) {
        const u = rawMap[i];
        if (!u.isActive || u.hp <= 0) continue;
        const dx = camPos.x - u.position[0];
        const dz = camPos.z - u.position[2];
        u.dSq = dx * dx + dz * dz;
        activeUnits.push(u);
      }

      activeUnits.sort((a, b) => {
        if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
        return a.dSq - b.dSq;
      });
      cachedActiveUnits.current = activeUnits;
    }

    const activeUnits = cachedActiveUnits.current;
    // Ultimate Visibility: Names stay visible even when zoomed out far (200m)
    const HUD_DETAIL_DIST_SQ = 200 * 200;
    const isPotato = !!settingsRef.current.potatoMode;
    if (isPotato) {
      if (frameCountRef.current % 15 === 0) {
        for (let i = 0; i < MAX_UNITS; i++) {
          shadowRef.current?.setMatrixAt(i, _hideMatrix);
          healthBgRef.current?.setMatrixAt(i, _hideMatrix);
          healthFillRef.current?.setMatrixAt(i, _hideMatrix);
          notchRef.current?.setMatrixAt(i, _hideMatrix);
        }
        shadowRef.current.instanceMatrix.needsUpdate = true;
        healthBgRef.current.instanceMatrix.needsUpdate = true;
        healthFillRef.current.instanceMatrix.needsUpdate = true;
        notchRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. Name Labels Lifecycle (Positioning is now delegated to Armies)
    if (time - lastNameCullTime.current > 0.1) {
      lastNameCullTime.current = time;

      // Cleanup names for units that are dead, too far, or if in potato mode
      for (const [uid, slot] of namePoolMap.current.entries()) {
        const uIdx = parseInt(uid.split('-')[1]);
        const u = rawMap[uIdx];
        // Release name slot if unit is dead, too far, or potato mode is on
        const gone = !u || !u.isActive || u.id !== uid || u.hp <= 0 || (u.dSq || 0) > HUD_DETAIL_DIST_SQ || isPotato;
        if (gone) {
          if (nameTextRefs.current[slot]) {
            nameTextRefs.current[slot].visible = false;
            nameTextRefs.current[slot].position.set(0, -100, 0); // extra hide
          }
          nameAvailableSlots.current.push(slot);
          namePoolMap.current.delete(uid);
        }
      }

      // Assign slots to new near units
      if (!isPotato) {
        for (let i = 0; i < activeUnits.length; i++) {
          const u = activeUnits[i];
          const id = u.id;
          if (namePoolMap.current.has(id) || namePoolMap.current.size >= NAME_POOL_SIZE || nameAvailableSlots.current.length === 0) continue;
          if (u.dSq > HUD_DETAIL_DIST_SQ) continue;

          const slot = nameAvailableSlots.current.shift()!;
          namePoolMap.current.set(id, slot);
          const mesh = nameTextRefs.current[slot];
          if (mesh) {
            const badge = getLevelBadge(u.level || 1);
            const label = badge + u.userName;
            if (nameSlotContent.current[slot] !== label) { mesh.text = label; nameSlotContent.current[slot] = label; }

            const col = getLevelColor(u.level || 1);
            if (nameSlotColor.current[slot] !== col) { mesh.color = col; nameSlotColor.current[slot] = col; }

            mesh.fontSize = u.isBoss ? 0.95 : 0.45;
            mesh.outlineWidth = 0.08;
            mesh.visible = true;
          }
        }
      }
    }

    // 3. Signal Updates for InstancedMeshes (Positions are updated by individual Armies)
    if (shadowRef.current) shadowRef.current.instanceMatrix.needsUpdate = true;
    if (healthBgRef.current) healthBgRef.current.instanceMatrix.needsUpdate = true;
    if (healthFillRef.current) {
      healthFillRef.current.instanceMatrix.needsUpdate = true;
      if (healthFillRef.current.instanceColor) healthFillRef.current.instanceColor.needsUpdate = true;
    }
    if (notchRef.current) {
      notchRef.current.instanceMatrix.needsUpdate = true;
      const maxHpAttr = notchRef.current.geometry.getAttribute('aMaxHp');
      if (maxHpAttr) maxHpAttr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Full-3D Animated Unit Rendering by Class — Each gets 120-200 slot offset in the HUD buffer */}
      <FighterArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} shadowRef={shadowRef} healthBgRef={healthBgRef} healthFillRef={healthFillRef} notchRef={notchRef} hudBaseIdx={0} namePoolMap={namePoolMap} nameTextRefs={nameTextRefs} fighterSpellsRef={fighterSpellsRef} />
      <TankArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} shadowRef={shadowRef} healthBgRef={healthBgRef} healthFillRef={healthFillRef} notchRef={notchRef} hudBaseIdx={60} namePoolMap={namePoolMap} nameTextRefs={nameTextRefs} tankSpellsRef={tankSpellsRef} />
      <MageArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} spellsRef={spellsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} shadowRef={shadowRef} healthBgRef={healthBgRef} healthFillRef={healthFillRef} notchRef={notchRef} hudBaseIdx={120} namePoolMap={namePoolMap} nameTextRefs={nameTextRefs} />
      <MarksmanArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} spellsRef={spellsRef} mmSpellsRef={mmSpellsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} shadowRef={shadowRef} healthBgRef={healthBgRef} healthFillRef={healthFillRef} notchRef={notchRef} hudBaseIdx={180} namePoolMap={namePoolMap} nameTextRefs={nameTextRefs} />
      <AssassinArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} shadowRef={shadowRef} healthBgRef={healthBgRef} healthFillRef={healthFillRef} notchRef={notchRef} hudBaseIdx={240} namePoolMap={namePoolMap} nameTextRefs={nameTextRefs} assassinSpellsRef={assassinSpellsRef} />


      {/* LOD Impostor Layer: far-away units rendered as InstancedMesh billboards (2 draw calls) */}
      <InstancedImpostorRenderer
        unitRegistry={unitRegistry}
        renderedIdsRef={renderedIdsRef}
        playerColor={towerConfig.player.color}
        enemyColor={towerConfig.enemy.color}
        settingsRef={settingsRef}
      />

      {/* Mage GLSL Spell Projectiles */}
      <MageSpellEffect spellsRef={spellsRef} unitRegistry={unitRegistry} simTimeRef={simTimeRef} />

      {/* Marksman GLSL Projectiles */}
      <MMSpellEffect spellsRef={mmSpellsRef} unitRegistry={unitRegistry} simTimeRef={simTimeRef} />

      {/* Melee Combat Effects */}
      <FighterSpellEffect fighterSpellsRef={fighterSpellsRef} simTimeRef={simTimeRef} />
      <TankSpellEffect tankSpellsRef={tankSpellsRef} simTimeRef={simTimeRef} />
      <AssassinSpellEffect assassinSpellsRef={assassinSpellsRef} simTimeRef={simTimeRef} />

      {/* Centralized HUD Layer */}
      <instancedMesh ref={shadowRef} args={[null as any, null as any, MAX_UNITS]} geometry={shadowGeo} material={shadowMat} />
      <instancedMesh ref={healthBgRef} args={[null as any, null as any, MAX_UNITS]} geometry={healthGeo} material={healthBgMat} renderOrder={4} />
      <instancedMesh ref={healthFillRef} args={[null as any, null as any, MAX_UNITS]} geometry={healthGeo} material={healthFillMat} renderOrder={5} />
      <instancedMesh ref={notchRef} args={[null as any, null as any, MAX_UNITS]} geometry={healthGeo} material={notchMat} renderOrder={6} />

      <group ref={nameGroupRef}>
        {Array.from({ length: NAME_POOL_SIZE }, (_, i) => (
          <Text
            key={"name-" + i}
            ref={(el) => { nameTextRefs.current[i] = el; }}
            visible={false}
            fontSize={0.45}
            color="#ffffff"
            outlineWidth={0.08}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
            renderOrder={10}
            depthOffset={-2}
          >
            {''}
          </Text>
        ))}
      </group>
    </group>
  );
};

export const BattleArmy = React.memo(BattleArmyComponent);
