'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useVFX } from './VFXManager';
import { ActiveUnit, TowerConfig, SimulationSettings, UnitRuntimeData } from '@/src/core/domain/unit.types';
import * as YUKA from 'yuka';
import { FighterSpellEffect } from './effects/FighterSpellEffect';
import { TankSpellEffect } from './effects/TankSpellEffect';
import { AssassinSpellEffect } from './effects/AssassinSpellEffect';
import { ECSArmyRenderer } from './armies/ECSArmyRenderer';
import { InstancedImpostorRenderer } from './armies/InstancedImpostorRenderer';
import { MageSpellEffect, SpellEntry } from './effects/MageSpellEffect';
import { MMSpellEffect } from './effects/MMSpellEffect';
// 

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
  compBuffers: any;
}



import { WORLD_UNIT_POOL_SIZE as MAX_UNITS } from '@/src/core/domain/unit.types';
const NAME_POOL_SIZE = 60; // Further reduction to 60 for extreme performance

const tempObject = new THREE.Object3D();

// Pre-computed hide matrix — avoids recomputing position+scale+updateMatrix per cleanup slot
const _hideObj = new THREE.Object3D();
_hideObj.position.set(0, -100, 0);
_hideObj.scale.set(0, 0, 0);
_hideObj.updateMatrix();
const _hideMatrix = _hideObj.matrix.clone();
const _frustum = new THREE.Frustum();
const _projMatrix = new THREE.Matrix4();



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



const AuraShadowShader = {
  vertexShader: `
    #ifndef USE_INSTANCING_COLOR
      attribute vec3 instanceColor;
    #endif
    #ifndef USE_INSTANCING
      attribute mat4 instanceMatrix;
    #endif

    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      vUv = uv;
      vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      float d = length(vUv - 0.5) * 2.0;
      float alpha = smoothstep(1.0, 0.4, d) * 0.4;
      
      // Black core for the real shadow
      vec3 shadowCol = vec3(0.0);
      float shadowMask = smoothstep(0.7, 0.3, d);
      
      // Aura glow based on instanceColor
      vec3 auraCol = vColor;
      float auraAlpha = smoothstep(1.0, 0.6, d) * 1.5;
      
      vec3 finalCol = mix(auraCol, shadowCol, shadowMask);
      float finalAlpha = max(alpha, auraAlpha * length(vColor));
      
      gl_FragColor = vec4(finalCol, finalAlpha * 0.5);
    }
  `
};

const MLHealthBarShader = {
  vertexShader: `
    attribute vec2 aHealthInfo; // x = hp, y = maxHp
    varying vec2 vUv;
    varying vec2 vHealthInfo;
    #ifndef USE_INSTANCING_COLOR
        attribute vec3 instanceColor;
    #endif
    varying vec3 vColor;
    void main() {
      vUv = uv; 
      vHealthInfo = aHealthInfo;
      vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec2 vHealthInfo;
    varying vec3 vColor;
    void main() {
      float hp = vHealthInfo.x;
      float maxHp = vHealthInfo.y;
      float pct = maxHp > 0.0 ? clamp(hp / maxHp, 0.0, 1.0) : 0.0;
      
      // Calculate Border
      float borderWidth = 0.015;
      float borderHeight = 0.08;
      bool isBorder = vUv.x < borderWidth || vUv.x > 1.0 - borderWidth || vUv.y < borderHeight || vUv.y > 1.0 - borderHeight;
      if (isBorder) {
          gl_FragColor = vec4(0.05, 0.05, 0.05, 0.9); // Black border
          return;
      }
      
      // Calculate Notches (every 250 HP)
      float totalSmallSegments = maxHp / 250.0;
      float smallNotchStep = 1.0 / totalSmallSegments;
      float smallNotch = mod(vUv.x, smallNotchStep);
      
      // Thick notches every 1000 HP
      float thickNotchStep = 1.0 / (maxHp / 1000.0);
      float thickNotch = mod(vUv.x, thickNotchStep);
      
      bool isThickNotch = thickNotch < 0.015 && maxHp > 1001.0 && vUv.x > 0.02 && vUv.x < 0.98;
      bool isSmallNotch = smallNotch < 0.01 && vUv.x > 0.02 && vUv.x < 0.98;
      
      if (isThickNotch) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.95); // Black thick notch
          return;
      }
      if (isSmallNotch) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.6); // Semi-transparent small notch
          return;
      }
      
      // Draw Fill vs Background
      if (vUv.x <= pct) {
          gl_FragColor = vec4(vColor, 1.0); // Health fill area
      } else {
          gl_FragColor = vec4(0.1, 0.1, 0.1, 0.75); // Missing health background area
      }
    }
  `
};

const BattleArmyComponent = ({
  unitRegistry, towerConfig, updateSimulation, settingsRef, simTimeRef,
  spellsRef, mmSpellsRef, fighterSpellsRef,
  tankSpellsRef, assassinSpellsRef, vfxRef, compBuffers
}: BattleArmyProps) => {
  const shadowRef = useRef<THREE.InstancedMesh>(null!);
  const healthBarRef = useRef<THREE.InstancedMesh>(null!);

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
    tempObject.position.set(0, -1000, 0);
    tempObject.scale.set(0.001, 0.001, 0.001); 
    tempObject.updateMatrix();
    if (shadowRef.current) {
      for (let i = 0; i < 1500; i++) {
        shadowRef.current.setMatrixAt(i, tempObject.matrix);
        healthBarRef.current?.setMatrixAt(i, tempObject.matrix);
      }
      shadowRef.current.instanceMatrix.needsUpdate = true;
      if (healthBarRef.current) healthBarRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  const healthGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1.2, 0.18);
    const healthInfoArray = new Float32Array(MAX_UNITS * 2);
    for(let i=0; i<MAX_UNITS; i++) {
        healthInfoArray[i*2] = 250;
        healthInfoArray[i*2+1] = 250;
    }
    const attr = new THREE.InstancedBufferAttribute(healthInfoArray, 2);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aHealthInfo', attr);
    return geo;
  }, []);
  const shadowGeo = useMemo(() => new THREE.CircleGeometry(0.6, 12), []);
  const shadowMat = useMemo(() => new THREE.ShaderMaterial({
      ...AuraShadowShader,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
  }), []);
  const healthBarMat = useMemo(() => new THREE.ShaderMaterial({ 
      ...MLHealthBarShader, 
      transparent: true, 
      depthWrite: false,
      vertexColors: true,
      defines: { USE_INSTANCING: '', USE_INSTANCING_COLOR: '' }
  }), []);

  const nameGroupRef = useRef<THREE.Group>(null!);
  const namePoolMap = useRef<Map<string, number>>(new Map());
  const nameAvailableSlots = useRef<number[]>(Array.from({ length: NAME_POOL_SIZE }, (_, i) => i));
  const nameTextRefs = useRef<(any | null)[]>(Array(NAME_POOL_SIZE).fill(null));
  const nameSlotContent = useRef<string[]>(Array(NAME_POOL_SIZE).fill(''));
  const nameSlotColor = useRef<string[]>(Array(NAME_POOL_SIZE).fill('#ffffff'));

  const lastNameCullTime = useRef(0);
  const cachedActiveUnits = useRef<any[]>([]);
  const frameCountRef = useRef(0);
  useFrame((state, delta) => {
    // 0. Update Frustum for class animators
    _projMatrix.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projMatrix);
    (state as any).battleFrustum = _frustum;

    // Optimized Simulation Step: Pass raw delta to system which handles sub-stepping internally
    updateSimulation(delta);

    const rawMap = unitRegistry.current;
    if (!rawMap) return;

    // battleGrid is already updated by useBattleSystem simulation loop. 
    // Removing duplicate call here to save CPU cycles.

    const time = state.clock.elapsedTime;
    const camPos = state.camera.position;
    frameCountRef.current++;

    // PERFORMANCE: Throttle sorting and unit filtering to every 5 frames
    if (frameCountRef.current % 5 === 0 || cachedActiveUnits.current.length === 0) {
      const activeUnits: any[] = [];
      const buckets: Record<string, UnitRuntimeData[]> = { fighter: [], tank: [], mage: [], marksman: [], assassin: [] };
      
      const indices = compBuffers?.activeIndices || [];
      for (let k = 0; k < indices.length; k++) {
        const i = indices[k];
        const u = rawMap[i];
        if (!u || !u.isActive || u.hp <= 0) continue;
        const dx = camPos.x - u.position[0];
        const dz = camPos.z - u.position[2];
        u.dSq = dx * dx + dz * dz;
        activeUnits.push(u);
        if (buckets[u.unitClass]) buckets[u.unitClass].push(u);
      }

      activeUnits.sort((a, b) => {
        if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
        return a.dSq - b.dSq;
      });
      
      // Sort each bucket by distance too, so the armies don't have to
      for (const key in buckets) {
        buckets[key].sort((a, b) => (a.dSq || 0) - (b.dSq || 0));
      }

      cachedActiveUnits.current = activeUnits;
      (state as any).unitBuckets = buckets; // Pass to children via state to avoid prop drilling if possible, or just props
    }

    const activeUnits = cachedActiveUnits.current;
    // Ultimate Visibility: Names stay visible even when zoomed out moderately (45m)
    const HUD_DETAIL_DIST_SQ = 45 * 45; 
    const isPotato = !!settingsRef.current.potatoMode;
    if (isPotato) {
      if (frameCountRef.current % 15 === 0) {
        for (let i = 0; i < 1500; i++) {
          shadowRef.current?.setMatrixAt(i, _hideMatrix);
          healthBarRef.current?.setMatrixAt(i, _hideMatrix);
        }
        shadowRef.current.instanceMatrix.needsUpdate = true;
        if (healthBarRef.current) healthBarRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // 2. Name Labels Lifecycle (Positioning is now delegated to Armies)
      // Throttled: 15fps for name lifecycle
      if (frameCountRef.current % 4 === 0) {
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

            // LARGER NAMES for maximum visibility
            mesh.fontSize = u.isBoss ? 1.4 : 0.75; 
            mesh.outlineWidth = 0.12;
            mesh.outlineColor = "#000000";
            mesh.visible = true;
          }
        }
      }
    }

    // 3. Signal Updates for InstancedMeshes (Positions are updated by individual Armies)
    if (shadowRef.current) shadowRef.current.instanceMatrix.needsUpdate = true;
    if (healthBarRef.current) {
      healthBarRef.current.instanceMatrix.needsUpdate = true;
      if (healthBarRef.current.instanceColor) healthBarRef.current.instanceColor.needsUpdate = true;
      const attr = healthBarRef.current.geometry.getAttribute('aHealthInfo');
      if (attr) attr.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* ECSArmyRenderer: Unified renderer replacing FighterArmy/TankArmy/MageArmy/MarksmanArmy/AssassinArmy
          - LAZY POOL: 0 models at startup, clone only when units actually spawn → no idle FPS drop
          - SINGLE useFrame: one loop for all 5 classes reading from ECS TypedArrays
          - Pure data-driven: no OOP, no class instances */}
      <ECSArmyRenderer
        unitRegistry={unitRegistry}
        activeIndicesRef={compBuffers?.activeIndices}
        towerConfig={towerConfig}
        settingsRef={settingsRef}
        simTimeRef={simTimeRef}
        renderedIdsRef={renderedIdsRef}
        shadowRef={shadowRef}
        healthBarRef={healthBarRef}
        namePoolMap={namePoolMap}
        nameTextRefs={nameTextRefs}
      />

      {/* LOD Impostor Layer: far-away units rendered as InstancedMesh billboards (2 draw calls) */}
      <InstancedImpostorRenderer
        unitRegistry={unitRegistry}
        renderedIdsRef={renderedIdsRef}
        playerColor={towerConfig.player.color}
        enemyColor={towerConfig.enemy.color}
        settingsRef={settingsRef}
        activeIndices={compBuffers?.activeIndices}
      />

      {/* Mage GLSL Spell Projectiles */}
      <MageSpellEffect spellsRef={spellsRef} unitRegistry={unitRegistry} simTimeRef={simTimeRef} />

      {/* Marksman GLSL Projectiles */}
      <MMSpellEffect spellsRef={mmSpellsRef} unitRegistry={unitRegistry} simTimeRef={simTimeRef} />

      {/* Melee Combat Effects */}
      <FighterSpellEffect fighterSpellsRef={fighterSpellsRef} simTimeRef={simTimeRef} />
      <TankSpellEffect tankSpellsRef={tankSpellsRef} simTimeRef={simTimeRef} />
      <AssassinSpellEffect assassinSpellsRef={assassinSpellsRef} simTimeRef={simTimeRef} />

      {/* Centralized HUD Layer (Extended pool to support class offsets) */}
      <instancedMesh ref={shadowRef} args={[null as any, null as any, 1500]} geometry={shadowGeo} material={shadowMat} frustumCulled={false} />
      <instancedMesh ref={healthBarRef} args={[null as any, null as any, 1500]} geometry={healthGeo} material={healthBarMat} renderOrder={7} frustumCulled={false} />

      <group ref={nameGroupRef}>
        {useMemo(() => Array.from({ length: NAME_POOL_SIZE }, (_, i) => (
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
        )), [])}
      </group>
    </group>
  );
};

export const BattleArmy = React.memo(BattleArmyComponent);
