'use client';

/**
 * ECSArmyRenderer — Unified Army Renderer (ECS Architecture)
 *
 * Replaces: FighterArmy, TankArmy, MageArmy, MarksmanArmy, AssassinArmy
 *
 * Key differences from OOP approach:
 * - LAZY POOL: Models are cloned only when a unit actually spawns (not at mount).
 *   This means 0 SkinnedMesh objects at startup → eliminates idle FPS drop.
 * - SINGLE useFrame: One loop reads from ECS data arrays for all 5 classes.
 * - NO OOP: No class-based pooling. All logic operates on flat arrays.
 * - ECS DATA: Reads position/rotation directly from unitDataPool (backed by Bitecs arrays).
 */

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MeshoptDecoder } from 'meshoptimizer';
import { SkeletonUtils } from 'three-stdlib';
import { UnitRuntimeData, TowerConfig, SimulationSettings, WORLD_UNIT_POOL_SIZE } from '@/src/core/domain/unit.types';
import { ARMY_POOL_SIZE, ANIM_CULL_DIST_SQ, CLASS_CONFIG } from '@/src/core/logic/combat/constants';
import { applyPainterlyStyle } from '../effects/PainterlyMaterials';

// ─── Types ──────────────────────────────────────────────────────────────────

interface PoolItem {
  group: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  actions: Record<string, THREE.AnimationAction>;
  colorable: THREE.Mesh[];
  currentAnim: string;
  lastUpdate: number;
  rotation: number;
  initialized: boolean;
  attackAnim: string;
  runAnim: string;
  deathAnim: string;
  walkAnim: string;
}

interface ClassPool {
  items: PoolItem[];
  available: number[];
  assigned: Map<string, number>;   // unitId → pool slot index
  activeSet: Set<string>;
}

type ClassKey = 'fighter' | 'tank' | 'mage' | 'marksman' | 'assassin';

interface ECSArmyRendererProps {
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  activeIndicesRef: React.RefObject<number[]>;
  towerConfig: TowerConfig;
  settingsRef: React.RefObject<SimulationSettings>;
  simTimeRef: React.RefObject<number>;
  renderedIdsRef: React.RefObject<Set<number>>;
  shadowRef: React.RefObject<THREE.InstancedMesh>;
  healthBarRef: React.RefObject<THREE.InstancedMesh>;
  cooldownRef: React.RefObject<THREE.InstancedMesh>;
  namePoolMap: React.MutableRefObject<Map<string, number>>;
  nameGroupRefs: React.RefObject<(THREE.Group | null)[]>;
}

// ─── Per-class config (static) ───────────────────────────────────────────────

const CLASS_COLORABLE_KW: Record<ClassKey, string[]> = {
  fighter: ['cape', 'cloth', 'trim', 'helmet', 'shoulder', 'robe', 'cloak', 'primary', 'team'],
  tank: ['cloth', 'plume', 'trim', 'shield_pattern', 'helmet', 'robe', 'cloak', 'cape', 'primary', 'team'],
  mage: ['cloth', 'trim', 'jewel', 'robe', 'cloak', 'cape', 'scarf', 'primary', 'team'],
  marksman: ['cloth', 'pattern', 'trim', 'ribbon', 'quiver', 'robe', 'cloak', 'cape', 'primary', 'team'],
  assassin: ['cloth', 'mask', 'hood', 'wrap', 'ribbon', 'robe', 'cloak', 'cape', 'primary', 'team'],
};



function resolveAttackAnim(classKey: ClassKey, actions: Record<string, THREE.AnimationAction>): string {
  const keys = Object.keys(actions);
  switch (classKey) {
    case 'fighter':
      return actions['SwordSlash'] ? 'SwordSlash' : (actions['Attack'] ? 'Attack' : 'Idle');
    case 'tank': {
      const f = keys.find(n => n === 'ShieldBash' || n === 'Attack' || n.includes('Attack') || n.includes('Slash') || n.includes('Bash'));
      return f || 'Idle';
    }
    case 'mage': {
      const f = keys.find(n => { const l = n.toLowerCase(); return l.includes('spell') || l.includes('cast') || l.includes('attack') || l.includes('shoot'); });
      return f || 'Idle';
    }
    case 'marksman':
      return actions['Punch'] ? 'Punch' : (actions['Shoot'] ? 'Shoot' : (actions['Attack'] ? 'Attack' : 'Idle'));
    case 'assassin': {
      const f = keys.find(n => n === 'Attack' || n.includes('Attack') || n.includes('Slash') || n.includes('Stab') || n.includes('Strike'));
      return f || 'Idle';
    }
    default: return 'Idle';
  }
}

function resolveRunAnim(actions: Record<string, THREE.AnimationAction>): string {
  const keys = Object.keys(actions);
  return keys.find(n => n === 'Run' || n.toLowerCase() === 'run') || 'Idle';
}

function resolveWalkAnim(actions: Record<string, THREE.AnimationAction>): string {
  const keys = Object.keys(actions);
  return keys.find(n => n === 'Walk' || n.toLowerCase().includes('walk')) || resolveRunAnim(actions);
}

function resolveDeathAnim(actions: Record<string, THREE.AnimationAction>): string {
  const keys = Object.keys(actions);
  return keys.find(n => n === 'Death' || n.toLowerCase().includes('death')) || 'Idle';
}

function getBaseScale(classKey: ClassKey, level: number, isBoss: boolean): number {
  if (isBoss) {
    return classKey === 'tank' ? 5.0 : (classKey === 'fighter' ? 4.5 : 4.0);
  }
  return classKey === 'tank' ? (1.9 + level * 0.12) : (1.4 + level * 0.1);
}

// ─── Scratch objects (zero-alloc) ────────────────────────────────────────────
const _hudTemp = new THREE.Object3D();
const _healthColor = new THREE.Color();
const _whiteColor = new THREE.Color('#ffffff');
const _frustumSphere = new THREE.Sphere(new THREE.Vector3(), 5);
let _ecsFrame = 0; // module-level frame counter for throttling


// ─── Main Component ──────────────────────────────────────────────────────────

// ─── Shared Material Cache (Numeric Key) ──────────────────────────────────
const _materialCache = new Map<number, THREE.MeshStandardMaterial>();

const getCachedMaterial = (
  classKey: ClassKey,
  rarity: string,
  team: 'player' | 'enemy',
  towerConfig: TowerConfig,
  assets: any[]
): THREE.MeshStandardMaterial => {
  const teamIdx = team === 'player' ? 0 : 1;
  const teamColor = teamIdx === 0 ? towerConfig.player.color : towerConfig.enemy.color;

  const rarityIdx = rarity === 'common' ? 0 : (rarity === 'elite' ? 1 : (rarity === 'epic' ? 2 : 3));
  const classIdx = classKey === 'fighter' ? 0 : (classKey === 'tank' ? 1 : (classKey === 'mage' ? 2 : (classKey === 'marksman' ? 3 : 4)));

  // BITMASK KEY: [Class: 4 bits][Rarity: 2 bits][Team: 1 bit]
  const key = (classIdx << 3) | (rarityIdx << 1) | teamIdx;

  if (_materialCache.has(key)) return _materialCache.get(key)!;

  const sourceMesh = assets[0].scene.getObjectByProperty('isMesh', true) as THREE.Mesh;
  const mat = (sourceMesh.material as THREE.MeshStandardMaterial).clone();

  applyPainterlyStyle(mat);
  mat.color.set(teamColor);
  mat.roughness = 1.0; 
  mat.metalness = 0.0; 

  const rarityColors: Record<string, string> = {
    common: '#333333', elite: '#2244ff', epic: '#aa22ff', legendary: '#ffaa00'
  };
  mat.emissive.set(rarityColors[rarity] || '#333333');
  mat.emissiveIntensity = rarity === 'legendary' ? 2.0 : (rarity === 'common' ? 0.3 : 1.5);

  _materialCache.set(key, mat);
  return mat;
};

// ─── Main Component ──────────────────────────────────────────────────────────

const ECSArmyRendererInner = ({
  unitRegistry, activeIndicesRef, towerConfig, settingsRef, simTimeRef,
  renderedIdsRef, shadowRef, healthBarRef, cooldownRef,
  namePoolMap, nameGroupRefs,
}: ECSArmyRendererProps) => {

  // ── Load all GLTF assets (preload happens at bottom of file) ──
  const f1 = useGLTF('/assets-model/Knight_Golden_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const f2 = useGLTF('/assets-model/Knight_Golden_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const f3 = useGLTF('/assets-model/Knight_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const t1 = useGLTF('/assets-model/Viking_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const t2 = useGLTF('/assets-model/Viking_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const g1 = useGLTF('/assets-model/Witch.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const g2 = useGLTF('/assets-model/Wizard.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const m1 = useGLTF('/assets-model/Cowboy_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const n1 = useGLTF('/assets-model/Ninja_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const n2 = useGLTF('/assets-model/Ninja_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;

  // Monsters for enemies
  const gob1 = useGLTF('/assets-model/Goblin_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const gob2 = useGLTF('/assets-model/Goblin_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const zom1 = useGLTF('/assets-model/Zombie_Male.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const zom2 = useGLTF('/assets-model/Zombie_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;

  // Map classKey → array of GLTF assets to pick from randomly
  const gltfByPool = useMemo<Record<string, any[]>>(() => ({
    fighter_player: [f1, f2, f3],
    fighter_enemy: [gob1, gob2],
    tank_player: [t1, t2],
    tank_enemy: [zom1, zom2],
    mage: [g1, g2],
    marksman: [m1],
    assassin: [n1, n2],
  }), [f1, f2, f3, gob1, gob2, t1, t2, zom1, zom2, g1, g2, m1, n1, n2]);

  // Scene group — all lazy-cloned models are added imperatively here
  const groupRef = useRef<THREE.Group>(null!);

  // ── Lazy Pools (one per class-team variant) ──
  const pools = useRef<Record<string, ClassPool>>({
    fighter_player: { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    fighter_enemy: { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    tank_player: { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    tank_enemy: { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    mage: { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    marksman: { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    assassin: { items: [], available: [], assigned: new Map(), activeSet: new Set() },
  });

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      const allPools = pools.current;
      (Object.keys(allPools)).forEach(key => {
        allPools[key].items.forEach(item => {
          item.group.traverse((child: any) => {
            if (child.isMesh) {
              child.geometry?.dispose();
              if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
              else child.material?.dispose();
            }
          });
        });
      });
      // FIX: Clear shared material cache to free GPU memory on unmount
      for (const [_, mat] of _materialCache) {
        mat.dispose();
      }
      _materialCache.clear();
    };
  }, []);

  // ── Lazily create a new pool item for classKey ──
  const createPoolItem = (poolKey: string): number | null => {
    const pool = pools.current[poolKey];
    if (pool.items.length >= ARMY_POOL_SIZE) return null;

    const assets = gltfByPool[poolKey];
    if (!assets || assets.some(a => !a.scene)) return null;

    const classKey = (poolKey.includes('_') ? poolKey.split('_')[0] : poolKey) as ClassKey;

    const selected = assets[Math.floor(Math.random() * assets.length)];
    const clone = SkeletonUtils.clone(selected.scene);
    clone.matrixAutoUpdate = false; // MAJOR PERFORMANCE GAIN: Disable auto-traversal
    const mixer = new THREE.AnimationMixer(clone);
    const actions: Record<string, THREE.AnimationAction> = {};
    if (selected.animations) {
      selected.animations.forEach((clip: THREE.AnimationClip) => { actions[clip.name] = mixer.clipAction(clip); });
    }

    const colorKws = CLASS_COLORABLE_KW[classKey];
    const colorable: THREE.Mesh[] = [];
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        child.frustumCulled = true;
        const nm = child.name.toLowerCase();
        if (colorKws.some(kw => nm.includes(kw))) {
          colorable.push(child);
        }
      }
    });

    clone.position.set(0, -100, 0);
    clone.visible = false;
    groupRef.current?.add(clone); // Add to scene imperatively

    const item: PoolItem = {
      group: clone, mixer, actions, colorable,
      currentAnim: '', lastUpdate: 0, rotation: 0, initialized: false,
      attackAnim: resolveAttackAnim(classKey, actions),
      runAnim: resolveRunAnim(actions),
      deathAnim: resolveDeathAnim(actions),
      walkAnim: resolveWalkAnim(actions),
    };

    item.group.userData.onHit = () => {
      const uid = item.group.userData.unitId;
      if (!uid || !unitRegistry.current) return;
      
      for (let i = 0; i < unitRegistry.current.length; i++) {
        const u = unitRegistry.current[i];
        if (u && u.isActive && u.id === uid) {
          u.isAggroed = true;
          break;
        }
      }
    };

    pool.items.push(item);
    return pool.items.length - 1;
  };

  // ── HUD helper: hide a slot's HUD ──
  const hideHUD = (hIdx: number, uid?: string) => {
    _hudTemp.position.set(0, -100, 0);
    _hudTemp.updateMatrix();
    shadowRef.current?.setMatrixAt(hIdx, _hudTemp.matrix);
    healthBarRef.current?.setMatrixAt(hIdx, _hudTemp.matrix);
    cooldownRef.current?.setMatrixAt(hIdx, _hudTemp.matrix);

    if (uid && namePoolMap.current.has(uid)) {
      const slot = namePoolMap.current.get(uid)!;
      const group = nameGroupRefs.current[slot];
      if (group) {
        group.position.set(0, -200, 0);
        group.visible = false;
      }
    }
  };

  // ── Main render loop ──────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const rawMap = unitRegistry.current;
    if (!rawMap) return;

    if (!activeIndicesRef) return;
    if (renderedIdsRef.current) renderedIdsRef.current.clear();

    const indices = activeIndicesRef.current;
    if (!indices) return;

    const time = state.clock.elapsedTime;
    const camQ = state.camera.quaternion;
    if (!settingsRef) return;
    const settings = settingsRef.current;
    if (!settings) return;
    const frustum = (state as any).battleFrustum;

    _ecsFrame++;
    const isPotato = settings.potatoMode;

    // Clear all active sets for ALL dynamic pools
    const p = pools.current;
    Object.keys(p).forEach(key => {
      p[key].activeSet.clear();
    });

    if (isPotato) {
      Object.keys(p).forEach(poolKey => {
        const pool = p[poolKey];
        pool.assigned.forEach((slotIdx, _uid2) => {
          const item = pool.items[slotIdx];
          if (item) item.group.visible = false;
          pool.available.push(slotIdx);
        });
        pool.assigned.clear();
      });
      // Hide all HUD
      for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
        hideHUD(i);
      }
      return;
    }

    const healthAttr = healthBarRef.current?.geometry.getAttribute('aHealthInfo') as THREE.InstancedBufferAttribute | undefined;
    const cooldownAttr = cooldownRef.current?.geometry.getAttribute('aProgress') as THREE.InstancedBufferAttribute | undefined;
    const lerpFactor = 1.0 - Math.exp(-45 * delta);
    const rotLerpFactor = 1.0 - Math.exp(-15 * delta);

    // ── Process all active units directly from the registry ──
    for (let k = 0; k < indices.length; k++) {
      const idx = indices[k];
      const uData = rawMap[idx];
      if (!uData || !uData.isActive || uData.position[1] < -10) continue;

      const classKey = uData.unitClass as ClassKey;
      const team = uData.type as 'player' | 'enemy';
      const poolKey = (classKey === 'fighter' || classKey === 'tank') 
          ? `${classKey}_${team}` 
          : classKey;
      
      const pool = p[poolKey];
      if (!pool) continue;

      const id = uData.id;
      
      pool.activeSet.add(id);

      let slotIdx: number | undefined = pool.assigned.get(id);
      if (slotIdx === undefined) {
        let newSlot: number | null = null;
        if (pool.available.length > 0) {
          newSlot = pool.available.pop()!;
        } else {
          newSlot = createPoolItem(poolKey);
        }
        
        if (newSlot === null) continue;
        slotIdx = newSlot;
        pool.assigned.set(id, slotIdx);
        
        const item = pool.items[slotIdx];
        item.group.visible = true;
        item.group.position.set(uData.position[0], uData.position[1], uData.position[2]);
        item.group.rotation.y = uData.rotation?.[1] || 0;
        item.initialized = false;
        item.group.userData.unitId = id;
      }

      if (renderedIdsRef.current) renderedIdsRef.current.add(uData.poolIdx);

      const item = pool.items[slotIdx];
      if (!item) continue;

      const baseScale = getBaseScale(classKey, uData.level || 1, uData.isBoss);
      const rarity = uData.rarity || 'common';
      const rScale = uData.isBoss ? 1.0 : (rarity === 'legendary' ? 1.4 : (rarity === 'epic' ? 1.3 : (rarity === 'elite' ? 1.15 : 1.0)));

      const baseDist = towerConfig.baseDistance || 40;
      const targetTowerZ = team === 'player' ? -baseDist : baseDist;
      const distToTower = Math.abs(uData.position[2] - targetTowerZ);
      const proximityScale = distToTower < 5 ? 1.35 : 1.0;

      const idNum = uData.poolIdx;
      const hVar = 1.0 + ((idNum % 7) - 3) * 0.015; 
      item.group.scale.set(
        baseScale * settings.unitScale * rScale * proximityScale,
        baseScale * settings.unitScale * rScale * hVar * proximityScale,
        baseScale * settings.unitScale * rScale * proximityScale
      );

      const sharedMat = getCachedMaterial(classKey, rarity, team, towerConfig, gltfByPool[poolKey]);
      for (let m = 0; m < item.colorable.length; m++) {
        if (item.colorable[m].material !== sharedMat) {
          item.colorable[m].material = sharedMat;
        }
      }

      let targetAnim = 'Idle';
      if (uData.isDying) {
        targetAnim = item.deathAnim;
      } else if (uData.status === 'marching' || uData.status === 'chasing') {
        targetAnim = item.runAnim;
      } else if (uData.status === 'idling') {
        targetAnim = item.walkAnim;
      } else if (uData.status === 'attacking') {
        const timeSinceAtk = (simTimeRef.current || 0) - (uData.lastAttackTime || 0);
        targetAnim = timeSinceAtk < 650 ? item.attackAnim : 'Idle';
      }
      if (!item.actions[targetAnim]) targetAnim = 'Idle';

      if (item.currentAnim !== targetAnim) {
        const prev = item.actions[item.currentAnim];
        const next = item.actions[targetAnim];
        if (next) {
          if (prev) prev.fadeOut(0.2);
          next.setLoop(targetAnim === item.deathAnim ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
          if (targetAnim === item.deathAnim) next.clampWhenFinished = true;
          next.reset().fadeIn(0.2).play();
          item.currentAnim = targetAnim;
        }
      }

      const tp = uData.position;
      const cp = item.group.position;
      const distSq = (tp[0] - cp.x) ** 2 + (tp[2] - cp.z) ** 2;

      if (!item.initialized || distSq > 25) {
        cp.set(tp[0], tp[1], tp[2]);
        item.rotation = uData.rotation?.[1] || 0;
        item.group.rotation.y = item.rotation;
        item.initialized = true;
      } else {
        cp.x = THREE.MathUtils.lerp(cp.x, tp[0], lerpFactor);
        cp.y = THREE.MathUtils.lerp(cp.y, tp[1], lerpFactor);
        cp.z = THREE.MathUtils.lerp(cp.z, tp[2], lerpFactor);

        let diff = (uData.rotation?.[1] || 0) - item.rotation;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        item.rotation += diff * rotLerpFactor;
        item.group.rotation.y = item.rotation;
      }

      item.group.updateMatrix();
      const hIdx = uData.poolIdx;

      if (shadowRef.current && healthBarRef.current) {
        const totalVisualScale = baseScale * settings.unitScale * rScale;
        _frustumSphere.center.set(item.group.position.x, item.group.position.y + 4 * totalVisualScale, item.group.position.z);
        _frustumSphere.radius = 8 * Math.max(1, totalVisualScale);

        const HUD_DETAIL_DIST_SQ = 22500; 
        const isVisible = frustum ? frustum.intersectsSphere(_frustumSphere) : true;
        const showDetail = isVisible && (uData.isBoss || (uData.dSq || 0) < HUD_DETAIL_DIST_SQ);

        if (showDetail) {
          const vPos = item.group.position;
          const by = (uData.isBoss ? 3.6 : 4.0) * totalVisualScale;
          const bs = (uData.isBoss ? 0.7 : 0.8) * totalVisualScale;
          const ss = 1.1 * totalVisualScale;

          _hudTemp.position.set(vPos.x, -0.45, vPos.z);
          _hudTemp.quaternion.identity();
          _hudTemp.scale.set(ss, ss, 1);
          _hudTemp.updateMatrix();
          shadowRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          if (cooldownRef.current && cooldownAttr && uData.hp > 0) {
            const skillCfg = CLASS_CONFIG[classKey];
            const cdTime = (skillCfg.skill_cooldown || 1000) * (1.0 - ((uData as any).cooldownReduction || 0));
            const timeSinceSkill = (simTimeRef.current || 0) - (uData.lastSkillTime || 0);
            const progress = Math.min(1.0, timeSinceSkill / cdTime);

            _hudTemp.position.set(vPos.x, -0.44, vPos.z);
            _hudTemp.quaternion.identity(); 
            _hudTemp.scale.set(ss * 1.5, ss * 1.5, 1);
            _hudTemp.updateMatrix();
            cooldownRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
            cooldownAttr.setX(hIdx, progress);

            _healthColor.set(team === 'player' ? towerConfig.player.color : towerConfig.enemy.color);
            cooldownRef.current.setColorAt(hIdx, _healthColor);
          } else {
            _hudTemp.scale.set(0.001, 0.001, 0.001);
            _hudTemp.updateMatrix();
            cooldownRef.current?.setMatrixAt(hIdx, _hudTemp.matrix);
          }

          _healthColor.set(team === 'player' ? towerConfig.player.color : towerConfig.enemy.color);
          shadowRef.current.setColorAt(hIdx, _healthColor);

          _hudTemp.position.set(vPos.x, vPos.y + by, vPos.z);
          _hudTemp.quaternion.copy(camQ);
          _hudTemp.scale.set(bs * 1.8, bs * 0.45, 1); 
          _hudTemp.updateMatrix();
          healthBarRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
          
          if (healthAttr) {
            healthAttr.setXY(hIdx, uData.hp, uData.maxHp || 100);
          }

          _healthColor.set(team === 'enemy' ? '#ff0000' : (team === 'player' ? towerConfig.player.color : towerConfig.enemy.color));
          const flash = (simTimeRef.current || 0) - (uData.lastDamageTime || 0);
          if (flash < 100) _healthColor.lerp(_whiteColor, 1.0 - flash / 100);
          healthBarRef.current.setColorAt(hIdx, _healthColor);

          const slot = namePoolMap?.current?.get(id);
          if (slot !== undefined && nameGroupRefs?.current) {
            const labelGroup = nameGroupRefs.current[slot];
            if (labelGroup) {
              const labelYOffset = 0.8 * totalVisualScale;
              labelGroup.position.set(vPos.x, vPos.y + by + labelYOffset, vPos.z);
              labelGroup.quaternion.copy(camQ);
              const labelScale = 1.0 + (totalVisualScale - 1.0) * 0.5;
              labelGroup.scale.set(labelScale, labelScale, 1);
              labelGroup.visible = true;
            }
          }
        } else {
          _hudTemp.position.set(cp.x, -0.45, cp.z);
          _hudTemp.quaternion.identity(); 
          _hudTemp.scale.set(uData.isBoss ? 4.5 : 1.6, uData.isBoss ? 4.5 : 1.6, 1);
          _hudTemp.updateMatrix();
          shadowRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          _hudTemp.scale.set(0.001, 0.001, 0.001);
          _hudTemp.updateMatrix();
          healthBarRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
          cooldownRef.current?.setMatrixAt(hIdx, _hudTemp.matrix);

          const slot = namePoolMap?.current?.get(id);
          if (slot !== undefined && nameGroupRefs?.current) {
            const labelGroup = nameGroupRefs.current[slot];
            if (labelGroup) labelGroup.visible = false;
          }
        }
      }

      const tooFar = (uData.dSq || 0) > ANIM_CULL_DIST_SQ;
      const sf = (uData.dSq || 0) > 10000 ? 2 : 1; // 30 FPS far, 60 FPS close

      if (!tooFar && time - item.lastUpdate >= 0.016 * sf) {
        item.mixer.update(delta * sf);
        item.lastUpdate = time;
      }
    } 

    Object.keys(p).forEach(poolKey => {
      const pool = p[poolKey];
      const toRelease: string[] = [];
      for (const [uid, slotIdx] of pool.assigned) {
        if (!pool.activeSet.has(uid)) {
          const item = pool.items[slotIdx];
          if (item) item.group.visible = false;
          // Parse poolIdx from uid (format "unit-IDX")
          const hIdx = parseInt(uid.split('-')[1]);
          if (!isNaN(hIdx)) hideHUD(hIdx, uid);
          pool.available.push(slotIdx);
          toRelease.push(uid);
        }
      }
      for (let r = 0; r < toRelease.length; r++) {
        pool.assigned.delete(toRelease[r]);
      }
    });

    if (_ecsFrame % 6 === 0) {
      const globalTime = (simTimeRef.current || 0) * 0.001;
      for (const [_, mat] of _materialCache.entries()) {
        if (mat.userData.painterlyShader) {
          mat.userData.painterlyShader.uniforms.time.value = globalTime;
        }
      }
    }
  }); 

  return <group ref={groupRef} />;
};

export const ECSArmyRenderer = React.memo(ECSArmyRendererInner);

// ─── Preload all assets ───────────────────────────────────────────────────────
const _preload = (path: string) => useGLTF.preload(path, true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder));
_preload('/assets-model/Knight_Golden_Female.glb');
_preload('/assets-model/Knight_Golden_Male.glb');
_preload('/assets-model/Knight_Male.glb');
_preload('/assets-model/Viking_Male.glb');
_preload('/assets-model/Viking_Female.glb');
_preload('/assets-model/Witch.glb');
_preload('/assets-model/Wizard.glb');
_preload('/assets-model/Cowboy_Female.glb');
_preload('/assets-model/Ninja_Female.glb');
_preload('/assets-model/Ninja_Male.glb');
_preload('/assets-model/Goblin_Male.glb');
_preload('/assets-model/Goblin_Female.glb');
_preload('/assets-model/Zombie_Male.glb');
_preload('/assets-model/Zombie_Female.glb');
