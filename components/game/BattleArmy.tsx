'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useVFX } from './VFXManager';
import { ActiveUnit, TowerConfig, SimulationSettings } from '../../hooks/battle/types';
import { FighterArmy } from './armies/FighterArmy';
import { TankArmy } from './armies/TankArmy';
import { MageArmy } from './armies/MageArmy';
import { MarksmanArmy } from './armies/MarksmanArmy';
import { AssassinArmy } from './armies/AssassinArmy';
import { InstancedImpostorRenderer } from './armies/InstancedImpostorRenderer';
import { MageSpellEffect, SpellEntry } from './MageSpellEffect';

interface BattleArmyProps {
  unitRegistry: React.RefObject<Map<string, any>>;
  towerConfig: TowerConfig;
  updateSimulation: (delta: number) => void;
  settingsRef: React.RefObject<SimulationSettings>;
  simTimeRef: React.RefObject<number>;
  vehicles: React.RefObject<Map<string, any>>;
  unitIndex: React.RefObject<Map<string, any>>;
  spellsRef: React.RefObject<SpellEntry[]>;
  vfxRef?: React.RefObject<any>;
}



const MAX_UNITS = 350;
const NAME_POOL_SIZE = 120; // Increased for more visible players

const _healthColor = new THREE.Color();
const _c1 = new THREE.Color('#22c55e');
const _c2 = new THREE.Color('#facc15');
const _c3 = new THREE.Color('#ef4444');
const _whiteColor = new THREE.Color('#ffffff');
const _camDir = new THREE.Vector3();
const tempObject = new THREE.Object3D();

// Pre-computed hide matrix — avoids recomputing position+scale+updateMatrix per cleanup slot
const _hideObj = new THREE.Object3D();
_hideObj.position.set(0, -100, 0);
_hideObj.scale.set(0, 0, 0);
_hideObj.updateMatrix();
const _hideMatrix = _hideObj.matrix.clone();

// Cached per-frame camera state to avoid redundant property access  
let _cachedCamQuat = new THREE.Quaternion();
let _cachedCamRotY = 0;
let _cachedCosRotY = 1;
let _cachedSinRotY = 0;
let _cachedNow = 0;

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

// Optimization: Sub-component for individual name labels to avoid full list updates
const UnitNameLabel = React.memo(({ unit, isVisible, camera }: { unit: any, isVisible: boolean, camera: any }) => {
    const textRef = useRef<any>(null);
    useFrame(({ clock }) => {
        if (!textRef.current || !isVisible) return;
        const time = clock.elapsedTime;
        const hover = Math.sin(time * 3 + unit.id.length) * 0.1;
        textRef.current.position.set(unit.position[0], (unit.isBoss ? 7.2 : 3.4) + (unit.isBoss ? 1.8 : 0.7) + hover, unit.position[2]);
        textRef.current.quaternion.copy(camera.quaternion);
        
        if (unit.isBoss) {
            const pulse = 1.0 + Math.sin(time * 5) * 0.1;
            textRef.current.scale.set(pulse, pulse, 1);
        }
    });
    const col = useMemo(() => getLevelColor(unit.level || 1), [unit.level]);
    const label = useMemo(() => getLevelBadge(unit.level || 1) + (unit.userName || 'Pasukan'), [unit.level, unit.userName]);

    return (
        <Text
            ref={textRef}
            visible={isVisible}
            color={col}
            fontSize={unit.isBoss ? 0.95 : 0.45}
            font="/fonts/Inter-Bold.ttf"
            outlineWidth={0.07}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
            renderOrder={10}
            depthOffset={-2}
        >
            {label}
        </Text>
    );
});

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

export function BattleArmy({ unitRegistry, towerConfig, updateSimulation, settingsRef, simTimeRef, vehicles, unitIndex, spellsRef, vfxRef }: BattleArmyProps) {

  const shadowRef = useRef<THREE.InstancedMesh>(null!);
  const healthBgRef = useRef<THREE.InstancedMesh>(null!);
  const healthFillRef = useRef<THREE.InstancedMesh>(null!);
  const notchRef = useRef<THREE.InstancedMesh>(null!);

  const { spawnVFX } = useVFX();
  const lastSpawnedRef = useRef<Map<string, number>>(new Map());

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
        for(let i=0; i<MAX_UNITS; i++) {
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
  const lastHudIdxRef = useRef(0);
  const cachedActiveUnits = useRef<any[]>([]);
  const frameCountRef = useRef(0);

  const simAccumulator = useRef(0);
  const SIM_STEP = 1/30; // 30Hz physics is stable and saves 50% CPU over 60Hz

  // The master ECS physics and HUD logic tick.
  useFrame((state, delta) => {
    // 1. FIXED STEP SIMULATION (SAVES CPU/HEAT)
    simAccumulator.current += Math.min(0.1, delta); // Cap delta to prevent "jumps" after alt-tab
    while (simAccumulator.current >= SIM_STEP) {
        updateSimulation(SIM_STEP); // Run simulation at fixed 30fps
        simAccumulator.current -= SIM_STEP;
    }

    // Armies will populate this in their useFrame, then ImpostorRenderer consumes and clears it
    

    const rawMap = unitRegistry.current;
    if (!rawMap) return;

    const time = state.clock.elapsedTime;
    const camPos = state.camera.position;
    frameCountRef.current++;



    // PERFORMANCE: Throttle sorting and unit filtering to every 5 frames

    if (frameCountRef.current % 5 === 0 || cachedActiveUnits.current.length === 0) {
        const activeUnits: any[] = [];
        rawMap.forEach((u: any, id: string) => {
            if (!u || u.hp <= 0) return;
            const dx = camPos.x - u.position[0];
            const dz = camPos.z - u.position[2];
            u.id = id;
            u.dSq = dx*dx + dz*dz;
            activeUnits.push(u);
        });
        
        activeUnits.sort((a, b) => {
            if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
            return a.dSq - b.dSq;
        });
        cachedActiveUnits.current = activeUnits;
    }

    const activeUnits = cachedActiveUnits.current;
    let hudIdx = 0;
    const FRUSTUM_CULL_DIST_SQ = 250 * 250; 
    const HUD_DETAIL_DIST_SQ = 180 * 180; 
    const maxHpAttr = notchRef.current?.geometry.getAttribute('aMaxHp');

    // PERF: Cache camera state ONCE per frame — avoids per-unit property access
    _cachedCamQuat.copy(state.camera.quaternion);
    _cachedCamRotY = state.camera.rotation.y;
    _cachedCosRotY = Math.cos(_cachedCamRotY);
    _cachedSinRotY = Math.sin(_cachedCamRotY);
    _cachedNow = Date.now();
    // Pre-compute camera world direction once for health bar z-offset
    state.camera.getWorldDirection(_camDir);

    activeUnits.forEach((u: any) => {
      // Setup master HUD limit
      if (hudIdx >= MAX_UNITS || !u || u.hp <= 0) return;
      if (u.dSq > FRUSTUM_CULL_DIST_SQ) return;

      // 1. Shadows
      tempObject.position.set(u.position[0], -0.45, u.position[2]);
      tempObject.rotation.set(-Math.PI/2, 0, 0);
      const ss = u.isBoss ? 4.5 : 1.6;
      tempObject.scale.set(ss, ss, 1);
      tempObject.updateMatrix();
      shadowRef.current.setMatrixAt(hudIdx, tempObject.matrix);

      // Only show detailed health bar if close enough
      const showDetail = u.isBoss || u.dSq < HUD_DETAIL_DIST_SQ;

      if (showDetail) {
        // 2. Health Bar Background — use cached quaternion instead of per-unit copy
        const pct = Math.max(0, u.hp / (u.maxHp || 100));
        const by = u.isBoss ? 7.0 : 3.2;
        const bs = u.isBoss ? 2.5 : 1.0;

        tempObject.position.set(u.position[0], by, u.position[2]);
        tempObject.quaternion.copy(_cachedCamQuat); // Cached once per frame
        tempObject.scale.set(bs, bs, 1);
        tempObject.updateMatrix();
        healthBgRef.current.setMatrixAt(hudIdx, tempObject.matrix);

        // 3. Health Bar Fill — use pre-computed cos/sin instead of per-unit Math.cos/sin
        const fx = pct * bs;
        tempObject.scale.set(fx, bs, 1);
        const ox = (bs - fx) * 0.4;
        tempObject.position.x -= _cachedCosRotY * ox; // Cached cos
        tempObject.position.z += _cachedSinRotY * ox; // Cached sin
        tempObject.updateMatrix();
        healthFillRef.current.setMatrixAt(hudIdx, tempObject.matrix);

        // Z-offset using pre-computed cam direction
        tempObject.position.addScaledVector(_camDir, -0.02);
        tempObject.updateMatrix();
        healthFillRef.current.setMatrixAt(hudIdx, tempObject.matrix);

        // 4. Hit Flashes & Team Color — use cached Date.now()
        const teamC = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
        _healthColor.set(teamC);
        
        const flashAge = _cachedNow - (u.lastDamageTime || 0);
        if (flashAge < 100) {
            _healthColor.lerpColors(_healthColor, _whiteColor, 1.0 - (flashAge / 100));
            const lastSpawn = lastSpawnedRef.current.get(u.id) || 0;
            if (_cachedNow - lastSpawn > 50) {
                spawnVFX(u.position, 'blood', '#bb0000');
                lastSpawnedRef.current.set(u.id, _cachedNow);
            }
        }
        healthFillRef.current.setColorAt(hudIdx, _healthColor);

        // 5. Notches
        tempObject.scale.set(bs, bs, 1);
        tempObject.position.set(u.position[0], by, u.position[2]);
        tempObject.updateMatrix();
        notchRef.current.setMatrixAt(hudIdx, tempObject.matrix);
        
        if (maxHpAttr) (maxHpAttr as THREE.InstancedBufferAttribute).setX(hudIdx, u.maxHp || 100);
      } else {
        // Hide detailed HUD if too far — use pre-computed hide matrix
        healthBgRef.current.setMatrixAt(hudIdx, _hideMatrix);
        healthFillRef.current.setMatrixAt(hudIdx, _hideMatrix);
        notchRef.current.setMatrixAt(hudIdx, _hideMatrix);
      }

      hudIdx++;
    });

    if (maxHpAttr) maxHpAttr.needsUpdate = true;

    // 6. Name Labels Logic
    const isPotato = !!settingsRef.current.potatoMode;

    namePoolMap.current.forEach((slot, unitId) => {
      const mesh = nameTextRefs.current[slot];
      if (!mesh) return;
      const unit = rawMap.get(unitId);
      if (unit && unit.hp > 0 && unit.dSq < HUD_DETAIL_DIST_SQ && !isPotato) {
        const hover = Math.sin(time * 3 + unitId.length) * 0.1;
        mesh.position.set(unit.position![0], (unit.isBoss ? 7.2 : 3.4) + (unit.isBoss ? 1.8 : 0.7) + hover, unit.position![2]);
        mesh.quaternion.copy(_cachedCamQuat);
        
        if (unit.isBoss) {
            const pulse = 1.1 + Math.sin(time * 6) * 0.1;
            mesh.scale.set(pulse, pulse, 1);
        } else {
            mesh.scale.set(1, 1, 1);
        }
        mesh.visible = true;
      } else { mesh.visible = false; }
    });

    if (time - lastNameCullTime.current > 0.1) { 
      lastNameCullTime.current = time;
      namePoolMap.current.forEach((slot, uid) => {
        const u = rawMap.get(uid);
        const gone = !u || u.hp <=0 || u.dSq > HUD_DETAIL_DIST_SQ || isPotato;
        if (gone) {
          if (nameTextRefs.current[slot]) nameTextRefs.current[slot].visible = false;
          nameAvailableSlots.current.push(slot);
          namePoolMap.current.delete(uid);
        }
      });
      if (!isPotato) {
        activeUnits.forEach((u: any) => {
          const id = u.id;
          if (!u || u.hp <= 0 || namePoolMap.current.has(id) || namePoolMap.current.size >= NAME_POOL_SIZE || nameAvailableSlots.current.length === 0) return;
          if (u.dSq > HUD_DETAIL_DIST_SQ) return;
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
        });
      }
    }

    // 7. Cleanup Unused HUD Slots — use pre-computed hide matrix (no position/scale/updateMatrix per slot)
    const prevMax = lastHudIdxRef.current;
    if (settingsRef.current.potatoMode) {
        for (let i = 0; i < MAX_UNITS; i++) {
            healthBgRef.current.setMatrixAt(i, _hideMatrix);
            healthFillRef.current.setMatrixAt(i, _hideMatrix);
            shadowRef.current.setMatrixAt(i, _hideMatrix);
        }
        lastHudIdxRef.current = 0;
    } else {
        const clearTo = Math.max(hudIdx, prevMax);
        lastHudIdxRef.current = hudIdx;
        
        for (let i = hudIdx; i < clearTo; i++) {
            shadowRef.current.setMatrixAt(i, _hideMatrix);
            healthBgRef.current.setMatrixAt(i, _hideMatrix);
            healthFillRef.current.setMatrixAt(i, _hideMatrix);
            notchRef.current.setMatrixAt(i, _hideMatrix);
        }
    }

    healthBgRef.current.instanceMatrix.needsUpdate = true;
    healthFillRef.current.instanceMatrix.needsUpdate = true;
    notchRef.current.instanceMatrix.needsUpdate = true;
    shadowRef.current.instanceMatrix.needsUpdate = true;
    if (healthFillRef.current.instanceColor) healthFillRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {/* Full-3D Animated Unit Rendering by Class */}
      <FighterArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} />
      <TankArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} />
      <MageArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} spellsRef={spellsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} />
      <MarksmanArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} />
      <AssassinArmy unitsMap={unitRegistry} towerConfig={towerConfig} settingsRef={settingsRef} simTimeRef={simTimeRef} vehicles={vehicles} unitIndex={unitIndex} renderedIdsRef={renderedIdsRef} />

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
}
