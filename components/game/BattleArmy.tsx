'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { Text } from '@react-three/drei';
import { useVFX } from './VFXManager';
import { ActiveUnit, TowerConfig, SimulationSettings } from '../../hooks/battle/types';

interface BattleArmyProps {
  unitRegistry: React.RefObject<Map<string, { hp: number; status: string; position: number[]; isBoss: boolean; maxHp?: number }>>;
  towerConfig: TowerConfig;
  updateSimulation: (delta: number) => void;
  settingsRef: React.RefObject<SimulationSettings>;
}

const tempObject = new THREE.Object3D();
const MAX_UNITS = 300;
// Pre-allocated reusable objects — zero GC per frame
const _healthColor = new THREE.Color();
const _c1 = new THREE.Color('#22c55e');
const _c2 = new THREE.Color('#facc15');
const _c3 = new THREE.Color('#ef4444');
const _whiteColor = new THREE.Color('#ffffff'); // Fix #2: avoid new Color per flash
const _camDir = new THREE.Vector3();            // Fix #1: avoid new Vector3 per unit
const _activeSet = new Set<string>();           // Fix #3: reused Set, cleared each frame

// Mobile Legends level color palette
const LEVEL_COLORS: Record<number, string> = {
  1: '#FFFFFF', // White — Common
  2: '#4CAF50', // Green — Uncommon
  3: '#2196F3', // Blue — Rare
  4: '#9c27b0', // Purple — Epic
  5: '#facc15', // Gold — Legendary
};

const getLevelColor = (level: number): string =>
  LEVEL_COLORS[Math.min(level, 5)] ?? '#FFFFFF';

// Mobile Legends style rank badges
const getLevelBadge = (level: number): string => {
  if (level >= 5) return '★★★ ';
  if (level >= 4) return '★★  ';
  if (level >= 3) return '★    ';
  return '';
};

// --- High-Performance ML-Style Shader for Segmented HP Bar ---
// Draws thin notches every 250 HP and thick notches every 1000 HP
const MLHealthBarShader = {
  uniforms: {
    time: { value: 0 },
  },
  vertexShader: `
    attribute float aMaxHp;
    varying vec2 vUv;
    varying float vMaxHp;
    void main() {
      vUv = uv;
      vMaxHp = aMaxHp;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vMaxHp;
    void main() {
      float x = vUv.x;
      if (x < 0.01 || x > 0.99) discard;

      // Logic: 1000 HP = 1 thick segment, 250 HP = 1 thin segment
      // x is UV.x [0..1]. 
      // Total HP units = vMaxHp / 250.0;
      float totalSmallSegments = vMaxHp / 250.0;
      float smallNotchStep = 1.0 / totalSmallSegments;
      
      // Calculate notches
      float smallNotch = mod(x, smallNotchStep);
      float thickNotchStep = 1.0 / (vMaxHp / 1000.0);
      float thickNotch = mod(x, thickNotchStep);

      float notchWidth = 0.012;
      
      if (thickNotch < 0.018 && vMaxHp > 1000.0) {
        // Thick notch (1000 HP)
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.9);
      } else if (smallNotch < 0.01) {
        // Small notch (250 HP)
        gl_FragColor = vec4(0.0, 0.0, 0.0, 0.4);
      } else {
        discard;
      }
    }
  `
};

const NAME_POOL_SIZE = 60; 

export const BattleArmy = ({ 
  unitRegistry, 
  towerConfig, 
  updateSimulation,
  settingsRef 
}: BattleArmyProps) => {
  const healthBgRef = useRef<THREE.InstancedMesh>(null!);
  const healthFillRef = useRef<THREE.InstancedMesh>(null!);
  const shadowRef = useRef<THREE.InstancedMesh>(null!);
  const notchRef = useRef<THREE.InstancedMesh>(null!);
  const { spawnVFX } = useVFX();
  const lastSpawnedRef = useRef<Map<string, number>>(new Map());

  const poolMapRef = useRef<Map<string, number>>(new Map());
  const availableIndicesRef = useRef<number[]>([]);
  const POOL_SIZE = 80; 

  useEffect(() => {
    availableIndicesRef.current = Array.from({ length: POOL_SIZE }, (_, i) => i);
    
    // Initialize custom attribute for maxHp segments
    if (notchRef.current) {
        const maxHpArray = new Float32Array(MAX_UNITS).fill(250);
        const attr = new THREE.InstancedBufferAttribute(maxHpArray, 1);
        notchRef.current.geometry.setAttribute('aMaxHp', attr);
    }
  }, []);

  const { scene, animations } = useGLTF('/Floating Character.glb') as any;

  const playerMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: towerConfig.player.color,
    roughness: 0.7,
    metalness: 0.2,
  }), [towerConfig.player.color]);

  const enemyMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: towerConfig.enemy.color,
    roughness: 0.7,
    metalness: 0.2,
  }), [towerConfig.enemy.color]);

  const bossMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#facc15',
    roughness: 0.4,
    metalness: 0.6,
  }), []);

  const characterPool = useMemo(() => {
    const items = [];
    if (!scene) return [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const clone = SkeletonUtils.clone(scene);
      const mixer = new THREE.AnimationMixer(clone);
      const actions: Record<string, THREE.AnimationAction> = {};
      animations.forEach((clip: THREE.AnimationClip) => {
        actions[clip.name] = mixer.clipAction(clip);
      });
      const meshes: THREE.Mesh[] = [];
      clone.traverse((child: any) => {
        if (child.isMesh) {
          child.material = playerMaterial;
          child.castShadow = false;
          child.receiveShadow = false;
          child.frustumCulled = true;
          meshes.push(child);
        }
      });
      items.push({
        group: clone,
        meshes,
        mixer,
        actions,
        currentAnim: '',
        currentMat: playerMaterial,
        lastUpdate: 0,
        rotation: 0,
        initialized: false,
      });
    }
    return items;
  }, [scene, animations, playerMaterial]);

  const healthGeo = useMemo(() => new THREE.PlaneGeometry(0.8, 0.12), []);
  const shadowGeo = useMemo(() => new THREE.CircleGeometry(0.6, 12), []);
  const healthBgMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#000000', transparent: true, opacity: 0.85, depthWrite: false,
  }), []);
  const healthFillMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: false, depthWrite: false,
  }), []);
  
  const notchMat = useMemo(() => new THREE.ShaderMaterial({
    ...MLHealthBarShader, transparent: true, depthWrite: false,
  }), []);
  
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#000000', transparent: true, opacity: 0.3, depthWrite: false,
  }), []);

  // Ensure materials are ready for instanced coloring
  useEffect(() => {
    if (healthFillMat) {
        healthFillMat.transparent = true;
    }
  }, [healthFillMat]);

  const nameGroupRef = useRef<THREE.Group>(null!);
  const namePoolMap = useRef<Map<string, number>>(new Map());
  const nameAvailableSlots = useRef<number[]>(
    Array.from({ length: NAME_POOL_SIZE }, (_, i) => i)
  );
  const nameTextRefs = useRef<(any | null)[]>(Array(NAME_POOL_SIZE).fill(null));
  const nameSlotContent = useRef<string[]>(Array(NAME_POOL_SIZE).fill(''));
  const nameSlotColor = useRef<string[]>(Array(NAME_POOL_SIZE).fill('#ffffff'));

  const lastNameCullTime = useRef(0);
  const lastHudIdxRef = useRef(0);
  const sortedUnitsRef = useRef<any[]>([]);

  useFrame((state, delta) => {
    updateSimulation(delta);

    const unitsMap = unitRegistry.current;
    if (!unitsMap) return;

    const time = state.clock.elapsedTime;
    const camPos = state.camera.position;
    _activeSet.clear(); 

    // 1. PRIORITY CALCULATIONS & SORTING
    // We only show characters for the 80 closest units to save massive resources
    const allActiveUnits: any[] = [];
    unitsMap.forEach((u: any, id: string) => {
        if (!u || u.hp <= 0) return;
        u.dSq = (camPos.x - u.position[0])**2 + (camPos.z - u.position[2])**2;
        u.id = id;
        allActiveUnits.push(u);
    });
    
    // Sort by distance (Bosses always prioritized)
    allActiveUnits.sort((a, b) => {
        if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
        return a.dSq - b.dSq;
    });

    const visibleUnits = allActiveUnits.slice(0, POOL_SIZE);
    visibleUnits.forEach(u => _activeSet.add(u.id));

    // 2. CHARACTER SYNC
    visibleUnits.forEach((u: any) => {
      const id = u.id;
      if (!poolMapRef.current.has(id) && availableIndicesRef.current.length > 0) {
        const index = availableIndicesRef.current.shift()!;
        poolMapRef.current.set(id, index);
      }

      const poolIdx = poolMapRef.current.get(id);
      if (poolIdx === undefined) return;

      const pItem = characterPool[poolIdx];
      pItem.group.visible = true;

      const targetMat = u.isBoss ? bossMaterial : (u.type === 'player' ? playerMaterial : enemyMaterial);
      if (pItem.currentMat !== targetMat) {
        for (let i = 0; i < pItem.meshes.length; i++) { pItem.meshes[i].material = targetMat; }
        pItem.currentMat = targetMat;
      }

      // Dynamic Scaling: Influenced by level, isBoss, and GLOBAL unitScale setting
      const globalUnitScale = settingsRef.current.unitScale;
      const baseScale = u.isBoss ? 4.5 : (1.5 + (u.level || 1) * 0.1);
      pItem.group.scale.setScalar(baseScale * globalUnitScale);

      let targetAnim = 'Idle';
      if (u.isDying) targetAnim = 'Defeat';
      else if (u.status === 'marching') targetAnim = 'Run';
      else if (u.status === 'attacking') targetAnim = 'Attack(1h)';

      if (pItem.currentAnim !== targetAnim) {
        const prev = pItem.actions[pItem.currentAnim];
        const next = pItem.actions[targetAnim];
        if (next) {
          if (prev) prev.fadeOut(0.2);
          next.setLoop(targetAnim === 'Defeat' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
          if (targetAnim === 'Defeat') next.clampWhenFinished = true;
          next.reset().fadeIn(0.2).play();
          pItem.currentAnim = targetAnim;
        }
      }

      const tp = u.position;
      const cp = pItem.group.position;
      const ds = (tp[0]-cp.x)**2 + (tp[1]-cp.y)**2 + (tp[2]-cp.z)**2;

      if (ds > 100 || !pItem.initialized) {
        cp.set(tp[0], tp[1], tp[2]);
        pItem.rotation = u.rotation[1];
        pItem.group.rotation.y = pItem.rotation;
        pItem.initialized = true;
      } else {
        cp.x += (tp[0]-cp.x)*0.25; cp.y += (tp[1]-cp.y)*0.25; cp.z += (tp[2]-cp.z)*0.25;
        if (u.hp > 0 && !u.isDying) {
          const tr = u.rotation[1];
          let diff = tr - pItem.rotation;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          pItem.rotation += diff * 0.15;
          pItem.group.rotation.y = pItem.rotation;
        }
      }

      // Proximity-based Animation frequency
      const sf = u.dSq > 3600 ? 5 : u.dSq > 400 ? 2 : 1;
      if (time - pItem.lastUpdate >= 0.016 * sf) {
        pItem.mixer.update(delta * sf);
        pItem.lastUpdate = time;
      }
    });

    // 3. CLEANUP POOL
    poolMapRef.current.forEach((poolIdx, unitId) => {
      if (!_activeSet.has(unitId)) {
        characterPool[poolIdx].group.visible = false;
        availableIndicesRef.current.push(poolIdx);
        poolMapRef.current.delete(unitId);
      }
    });

    // 4. HUD (HP Bars & Notches)
    let hudIdx = 0;
    const FRUSTUM_CULL_DIST_SQ = 120 * 120;
    
    // Access and update maxHp segments attribute
    const maxHpAttr = notchRef.current?.geometry.getAttribute('aMaxHp');

    unitsMap.forEach((u: any) => {
      if (hudIdx >= MAX_UNITS || !u || u.hp <= 0) return;

      const distSq = (camPos.x - u.position[0])**2 + (camPos.z - u.position[2])**2;
      if (distSq > FRUSTUM_CULL_DIST_SQ) return;

      // Shadow
      tempObject.position.set(u.position[0], -0.45, u.position[2]);
      tempObject.rotation.set(-Math.PI/2, 0, 0);
      const ss = u.isBoss ? 4.5 : 1.6;
      tempObject.scale.set(ss, ss, 1);
      tempObject.updateMatrix();
      shadowRef.current.setMatrixAt(hudIdx, tempObject.matrix);

      // HP Bar
      const pct = Math.max(0, u.hp / (u.maxHp || 100));
      const by = u.isBoss ? 7.0 : 3.2;
      const bs = u.isBoss ? 2.5 : 1.0;

      // BG
      tempObject.position.set(u.position[0], by, u.position[2]);
      tempObject.quaternion.copy(state.camera.quaternion);
      tempObject.scale.set(bs, bs, 1);
      tempObject.updateMatrix();
      healthBgRef.current.setMatrixAt(hudIdx, tempObject.matrix);

      // Fill
      const fx = pct * bs;
      tempObject.scale.set(fx, bs, 1);
      const ox = (bs - fx) * 0.4;
      tempObject.position.x -= Math.cos(state.camera.rotation.y)*ox;
      tempObject.position.z += Math.sin(state.camera.rotation.y)*ox;
      tempObject.updateMatrix();
      healthFillRef.current.setMatrixAt(hudIdx, tempObject.matrix);

      // Give Fill a tiny depth offset towards camera to prevent Z-fighting
      // Fix #1: reuse _camDir instead of allocating new THREE.Vector3() per unit
      state.camera.getWorldDirection(_camDir);
      tempObject.position.addScaledVector(_camDir, -0.02);
      tempObject.updateMatrix();
      healthFillRef.current.setMatrixAt(hudIdx, tempObject.matrix);

      if (pct > 0.5) _healthColor.lerpColors(_c2, _c1, (pct - 0.5) * 2);
      else _healthColor.lerpColors(_c3, _c2, pct * 2);
      
      // HP Bar Flash Logic
      const now = Date.now();
      const flashAge = now - (u.lastDamageTime || 0);
      if (flashAge < 100) {
        // Fix #2: reuse _whiteColor instead of new THREE.Color('#ffffff') per flash per frame
        _healthColor.lerpColors(_healthColor, _whiteColor, 1.0 - (flashAge / 100));
        
        // Spawn hit particle (throttled per unit)
        const lastSpawn = lastSpawnedRef.current.get(u.id) || 0;
        if (now - lastSpawn > 50) {
           spawnVFX(u.position, 'hit', u.type === 'player' ? towerConfig.enemy.color : towerConfig.player.color);
           lastSpawnedRef.current.set(u.id, now);
        }
      }

      healthFillRef.current.setColorAt(hudIdx, _healthColor);

      // Notches (Pass MaxHP for segmented bars)
      tempObject.scale.set(bs, bs, 1);
      tempObject.position.set(u.position[0], by, u.position[2]);
      tempObject.updateMatrix();
      notchRef.current.setMatrixAt(hudIdx, tempObject.matrix);
      
      // SET MAX HP SEGMENTS attribute
      if (maxHpAttr) (maxHpAttr as THREE.InstancedBufferAttribute).setX(hudIdx, u.maxHp || 100);

      hudIdx++;
    });

    if (maxHpAttr) maxHpAttr.needsUpdate = true;

    // 4. NAME SYNC
    namePoolMap.current.forEach((slot, unitId) => {
      const mesh = nameTextRefs.current[slot];
      if (!mesh) return;
      const unit = unitsMap.get(unitId);
      if (unit && unit.hp > 0) {
        mesh.position.set(unit.position[0], (unit.isBoss ? 7.0 : 3.2) + (unit.isBoss ? 1.6 : 0.65), unit.position[2]);
        mesh.quaternion.copy(state.camera.quaternion);
        mesh.visible = true;
      } else { mesh.visible = false; }
    });

    if (time - lastNameCullTime.current > 0.25) {
      lastNameCullTime.current = time;
      namePoolMap.current.forEach((slot, uid) => {
        const u = unitsMap.get(uid);
        const gone = !u || u.hp <=0 || (camPos.x-u.position[0])**2+(camPos.z-u.position[2])**2 > FRUSTUM_CULL_DIST_SQ;
        if (gone) {
          if (nameTextRefs.current[slot]) nameTextRefs.current[slot].visible = false;
          nameAvailableSlots.current.push(slot);
          namePoolMap.current.delete(uid);
        }
      });
      unitsMap.forEach((u: any, id: string) => {
        if (!u || u.hp <= 0 || namePoolMap.current.has(id) || namePoolMap.current.size >= NAME_POOL_SIZE || nameAvailableSlots.current.length === 0) return;
        if ((camPos.x-u.position[0])**2+(camPos.z-u.position[2])**2 > FRUSTUM_CULL_DIST_SQ) return;
        const slot = nameAvailableSlots.current.shift()!;
        namePoolMap.current.set(id, slot);
        const mesh = nameTextRefs.current[slot];
        if (mesh) {
          const badge = getLevelBadge(u.level || 1);
          const label = `${badge}${u.userName}`;
          if (nameSlotContent.current[slot] !== label) { mesh.text = label; nameSlotContent.current[slot] = label; }
          const col = getLevelColor(u.level || 1);
          if (nameSlotColor.current[slot] !== col) { mesh.color = col; nameSlotColor.current[slot] = col; }
          mesh.fontSize = u.isBoss ? 0.85 : 0.38;
          mesh.visible = true;
        }
      });
    }

    const prevMax = lastHudIdxRef.current;
    const clearTo = Math.max(hudIdx, prevMax);
    lastHudIdxRef.current = hudIdx;
    tempObject.position.set(0, -1000, 0); tempObject.scale.set(0, 0, 0); tempObject.updateMatrix();
    for (let i = hudIdx; i < clearTo; i++) {
      shadowRef.current.setMatrixAt(i, tempObject.matrix);
      healthBgRef.current.setMatrixAt(i, tempObject.matrix);
      healthFillRef.current.setMatrixAt(i, tempObject.matrix);
      notchRef.current.setMatrixAt(i, tempObject.matrix);
    }

    healthBgRef.current.instanceMatrix.needsUpdate = true;
    healthFillRef.current.instanceMatrix.needsUpdate = true;
    notchRef.current.instanceMatrix.needsUpdate = true;
    shadowRef.current.instanceMatrix.needsUpdate = true;
    if (healthFillRef.current.instanceColor) healthFillRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group>
      {characterPool.map((item, idx) => ( <primitive key={`pool-${idx}`} object={item.group} /> ))}
      <instancedMesh ref={shadowRef} args={[null as any, null as any, MAX_UNITS]} geometry={shadowGeo} material={shadowMat} />
      <instancedMesh ref={healthBgRef} args={[null as any, null as any, MAX_UNITS]} geometry={healthGeo} material={healthBgMat} renderOrder={4} />
      <instancedMesh ref={healthFillRef} args={[null as any, null as any, MAX_UNITS]} geometry={healthGeo} material={healthFillMat} renderOrder={5} />
      <instancedMesh ref={notchRef} args={[null as any, null as any, MAX_UNITS]} geometry={healthGeo} material={notchMat} renderOrder={6} />
      <group ref={nameGroupRef}>
        {Array.from({ length: NAME_POOL_SIZE }, (_, i) => (
          <Text key={`name-${i}`} ref={(el) => { nameTextRefs.current[i] = el; }} visible={false} fontSize={0.38} color="#ffffff" outlineWidth={0.05} outlineColor="#000000" anchorX="center" anchorY="middle" renderOrder={10} depthOffset={-2}>{''}</Text>
        ))}
      </group>
    </group>
  );
}

useGLTF.preload('/Floating Character.glb');
