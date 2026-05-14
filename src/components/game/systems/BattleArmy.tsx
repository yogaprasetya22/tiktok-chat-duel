'use client';

/**
 * BattleArmy v10 — ECS Unified Architecture
 *
 * This component unifies all class-specific rendering (Fighter, Tank, Mage, MM, Assassin)
 * into a single high-performance loop via ECSArmyRenderer.
 *
 * Optimization Strategy:
 * - Bucketizing: Units are split into class-specific buckets once per frame.
 * - ECS: Unit positions/rotations/animations are read directly from Bitecs-backed buffers.
 * - Single Draw Call HUD: Shadows, Health Bars, and Cooldowns use InstancedMesh.
 * - O(1) Visibility: Frustum culling and distance-based LOD are handled in the ECS loop.
 */

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';

import { UnitRuntimeData, TowerConfig, SimulationSettings } from '@/src/core/domain/unit.types';
import { ECSArmyRenderer } from './armies/ECSArmyRenderer';
import { InstancedImpostorRenderer } from './armies/InstancedImpostorRenderer';
import { MageSpellEffect } from './effects/MageSpellEffect';
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
  spellsRef: React.RefObject<any[]>;
  mmSpellsRef: React.RefObject<any[]>;
  fighterSpellsRef: React.RefObject<any[]>;
  tankSpellsRef: React.RefObject<any[]>;
  assassinSpellsRef: React.RefObject<any[]>;
  compBuffers?: any;
}

const MAX_UNITS = 300;
const NAME_POOL_SIZE = 120;

// ─── SHADERS ─────────────────────────────────────────────────────────────────

const MLHealthBarShader = {
  uniforms: { time: { value: 0 } },
  vertexShader: `
    attribute vec2 aHealthInfo; // x=hp, y=maxHp
    varying vec2 vUv;
    varying vec2 vHealth;
    void main() {
      vUv = uv;
      vHealth = aHealthInfo;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec2 vHealth;
    void main() {
      float pct = vHealth.x / vHealth.y;
      if (vUv.x > pct) discard;
      
      // Segment ticks every 1000 HP
      float segments = vHealth.y / 1000.0;
      float tick = mod(vUv.x * segments, 1.0);
      if (tick < 0.02 && vHealth.y > 500.0) gl_FragColor = vec4(0.0, 0.0, 0.0, 0.5);
      else gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0); // Tainted by instanceColor
    }
  `
};

const MLRadialCooldownShader = {
  uniforms: { time: { value: 0 } },
  vertexShader: `
    attribute float aProgress;
    varying vec2 vUv;
    varying float vProgress;
    void main() {
      vUv = uv;
      vProgress = aProgress;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vProgress;
    void main() {
      vec2 uv = vUv * 2.0 - 1.0;
      float angle = atan(uv.x, uv.y); // -PI to PI
      float normAngle = (angle + 3.14159) / 6.28318;
      
      float dist = length(uv);
      if (dist < 0.7 || dist > 1.0) discard;
      if (normAngle > vProgress) discard;
      
      gl_FragColor = vec4(1.0, 1.0, 1.0, 0.8); // Tainted by instanceColor
    }
  `
};

// ─── COMPONENT ───────────────────────────────────────────────────────────────

const BattleArmyComponent = ({
  unitRegistry, towerConfig, updateSimulation, settingsRef, simTimeRef,
  spellsRef, mmSpellsRef, fighterSpellsRef,
  tankSpellsRef, assassinSpellsRef, compBuffers
}: BattleArmyProps) => {
  const { camera } = useThree();

  // ── HUD Refs ──
  const shadowRef     = useRef<THREE.InstancedMesh>(null!);
  const healthBarRef  = useRef<THREE.InstancedMesh>(null!);
  const cooldownRef   = useRef<THREE.InstancedMesh>(null!);
  const renderedIdsRef = useRef<Set<number>>(new Set());

  // ── Name Pool ──
  const namePoolMap      = useRef<Map<string, number>>(new Map());
  const nameAvailable    = useRef<number[]>(Array.from({ length: NAME_POOL_SIZE }, (_, i) => i));
  const nameGroupRefs    = useRef<(THREE.Group | null)[]>([]);

  // ── Geometry/Materials ──
  const healthGeo   = useMemo(() => new THREE.PlaneGeometry(0.8, 0.12), []);
  const shadowGeo   = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2); // Flat on ground
    return geo;
  }, []);
  const cooldownGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    return geo;
  }, []);

  const healthMat   = useMemo(() => new THREE.ShaderMaterial({ ...MLHealthBarShader, transparent: true, depthWrite: false }), []);
  const shadowMat   = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.4, depthWrite: false }), []);
  const cooldownMat = useMemo(() => new THREE.ShaderMaterial({ ...MLRadialCooldownShader, transparent: true, depthWrite: false }), []);

  // ── Initialization ──
  useEffect(() => {
    if (healthBarRef.current) {
      const hAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_UNITS * 2), 2);
      healthBarRef.current.geometry.setAttribute('aHealthInfo', hAttr);
    }
    if (cooldownRef.current) {
      const cAttr = new THREE.InstancedBufferAttribute(new Float32Array(MAX_UNITS), 1);
      cooldownRef.current.geometry.setAttribute('aProgress', cAttr);
    }

    // Hide everything initially
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < MAX_UNITS; i++) {
      shadowRef.current?.setMatrixAt(i, hide);
      healthBarRef.current?.setMatrixAt(i, hide);
      cooldownRef.current?.setMatrixAt(i, hide);
    }
  }, []);

  // ── Simulation and Bucketizing ──
  const simAccumulator = useRef(0);
  const SIM_STEP = 1 / 30;
  const frameCount = useRef(0);

  const frustum = useMemo(() => new THREE.Frustum(), []);
  const projScreenMatrix = useMemo(() => new THREE.Matrix4(), []);

  useFrame((state, delta) => {
    // 1. Physics Sync
    let sDelta = Math.min(0.1, delta);
    simAccumulator.current += sDelta;
    while (simAccumulator.current >= SIM_STEP) {
      updateSimulation(SIM_STEP);
      simAccumulator.current -= SIM_STEP;
    }

    // 2. Frustum Setup
    projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreenMatrix);
    (state as any).battleFrustum = frustum;

    // 3. Bucketizing (O(N) traverse of registry)
    const rawMap = unitRegistry.current;
    if (!rawMap) return;

    const buckets: Record<string, any[]> = { fighter: [], tank: [], mage: [], marksman: [], assassin: [] };
    const camPos = camera.position;

    for (let i = 0; i < rawMap.length; i++) {
      const u = rawMap[i];
      if (!u.isActive || u.hp <= 0) continue;

      const dx = camPos.x - u.position[0];
      const dz = camPos.z - u.position[2];
      u.dSq = dx * dx + dz * dz;
      const classKey = ((u as any).classKey || 'fighter') as string;
      if (buckets[classKey]) buckets[classKey].push(u);
    }

    // Sort buckets by distance (Painter's algorithm fallback for transparency)
    Object.keys(buckets).forEach(k => {
      buckets[k].sort((a, b) => a.dSq - b.dSq);
    });
    (state as any).unitBuckets = buckets;

    // 4. Name Lifecycle
    if (frameCount.current % 10 === 0) {
      const HUD_DIST_SQ = 150 * 150;
      // Cleanup
      for (const [uid, slot] of namePoolMap.current.entries()) {
        const uIdx = parseInt(uid.split('-')[1]);
        const u = rawMap[uIdx];
        const gone = !u || !u.isActive || u.hp <= 0 || (u.dSq || 0) > HUD_DIST_SQ;
        if (gone) {
          const group = nameGroupRefs.current[slot];
          if (group) {
            group.visible = false;
            group.position.set(0, -100, 0);
          }
          nameAvailable.current.push(slot);
          namePoolMap.current.delete(uid);
        }
      }
      // Assign
      for (let i = 0; i < rawMap.length; i++) {
        const u = rawMap[i];
        if (!u.isActive || u.hp <= 0 || (u.dSq || 0) > HUD_DIST_SQ) continue;
        if (namePoolMap.current.has(u.id)) continue;
        if (nameAvailable.current.length === 0) break;

        const slot = nameAvailable.current.shift()!;
        namePoolMap.current.set(u.id, slot);
        const group = nameGroupRefs.current[slot];
        if (group) {
          const textMesh = group.children[0] as any;
          if (textMesh) {
            textMesh.text = u.userName;
            textMesh.color = u.type === 'player' ? '#ffffff' : '#ff4444';
          }
          group.visible = true;
        }
      }
    }

    // 5. Update HUD Attributes
    if (shadowRef.current) shadowRef.current.instanceMatrix.needsUpdate = true;
    if (healthBarRef.current) {
      healthBarRef.current.instanceMatrix.needsUpdate = true;
      if (healthBarRef.current.instanceColor) healthBarRef.current.instanceColor.needsUpdate = true;
      const hAttr = healthBarRef.current.geometry.getAttribute('aHealthInfo');
      if (hAttr) hAttr.needsUpdate = true;
    }
    if (cooldownRef.current) {
      cooldownRef.current.instanceMatrix.needsUpdate = true;
      if (cooldownRef.current.instanceColor) cooldownRef.current.instanceColor.needsUpdate = true;
      const pAttr = cooldownRef.current.geometry.getAttribute('aProgress');
      if (pAttr) pAttr.needsUpdate = true;
    }

    frameCount.current++;
  });

  if (!compBuffers) return null;
  
  return (
    <group>
      <ECSArmyRenderer
        unitRegistry={unitRegistry}
        activeIndicesRef={compBuffers?.activeIndices}
        towerConfig={towerConfig}
        settingsRef={settingsRef}
        simTimeRef={simTimeRef}
        renderedIdsRef={renderedIdsRef}
        shadowRef={shadowRef}
        healthBarRef={healthBarRef}
        cooldownRef={cooldownRef}
        namePoolMap={namePoolMap}
        nameGroupRefs={nameGroupRefs}
      />

      <InstancedImpostorRenderer
        unitRegistry={unitRegistry}
        renderedIdsRef={renderedIdsRef as any}
        playerColor={towerConfig.player.color}
        enemyColor={towerConfig.enemy.color}
        settingsRef={settingsRef}
      />

      {/* Spell Layers */}
      <MageSpellEffect spellsRef={spellsRef} unitRegistry={unitRegistry} simTimeRef={simTimeRef} />
      <MMSpellEffect spellsRef={mmSpellsRef} unitRegistry={unitRegistry} simTimeRef={simTimeRef} />
      <FighterSpellEffect fighterSpellsRef={fighterSpellsRef} simTimeRef={simTimeRef} />
      <TankSpellEffect tankSpellsRef={tankSpellsRef} simTimeRef={simTimeRef} />
      <AssassinSpellEffect assassinSpellsRef={assassinSpellsRef} simTimeRef={simTimeRef} />

      {/* HUD Instanced Layers */}
      <instancedMesh ref={shadowRef} args={[shadowGeo, shadowMat, MAX_UNITS]} frustumCulled={false} />
      <instancedMesh ref={healthBarRef} args={[healthGeo, healthMat, MAX_UNITS]} frustumCulled={false} renderOrder={100} />
      <instancedMesh ref={cooldownRef} args={[cooldownGeo, cooldownMat, MAX_UNITS]} frustumCulled={false} renderOrder={99} />

      {/* Name Label Pool */}
      {Array.from({ length: NAME_POOL_SIZE }).map((_, i) => (
        <group key={i} ref={(el) => { nameGroupRefs.current[i] = el; }} visible={false}>
          <Text
            fontSize={0.4}
            anchorX="center"
            anchorY="bottom"
            outlineWidth={0.05}
            outlineColor="#000000"
            renderOrder={110}
            depthOffset={-5}
          >
            {''}
          </Text>
        </group>
      ))}
    </group>
  );
};

export const BattleArmy = React.memo(BattleArmyComponent);
