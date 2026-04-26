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
import { UnitRuntimeData, TowerConfig, SimulationSettings } from '@/src/core/domain/unit.types';
import { ARMY_POOL_SIZE, ANIM_CULL_DIST_SQ } from '@/src/core/logic/combat/constants';
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
  renderedIdsRef: React.RefObject<Set<string>>;
  shadowRef: React.RefObject<THREE.InstancedMesh>;
  healthBarRef: React.RefObject<THREE.InstancedMesh>;
}

// ─── Per-class config (static) ───────────────────────────────────────────────

const CLASS_COLORABLE_KW: Record<ClassKey, string[]> = {
  fighter:  ['cape', 'cloth', 'trim', 'helmet', 'shoulder', 'robe', 'cloak', 'primary', 'team'],
  tank:     ['cloth', 'plume', 'trim', 'shield_pattern', 'helmet', 'robe', 'cloak', 'cape', 'primary', 'team'],
  mage:     ['cloth', 'trim', 'jewel', 'robe', 'cloak', 'cape', 'scarf', 'primary', 'team'],
  marksman: ['cloth', 'pattern', 'trim', 'ribbon', 'quiver', 'robe', 'cloak', 'cape', 'primary', 'team'],
  assassin: ['cloth', 'mask', 'hood', 'wrap', 'ribbon', 'robe', 'cloak', 'cape', 'primary', 'team'],
};

// HUD slot base index per class (must match instanced mesh allocation of 1500 total)
const CLASS_HUD_BASE: Record<ClassKey, number> = {
  fighter:  0,
  tank:     250,
  mage:     500,
  marksman: 750,
  assassin: 1000,
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
      return actions['Shoot_OneHanded'] ? 'Shoot_OneHanded' : (actions['Shoot'] ? 'Shoot' : (actions['Attack'] ? 'Attack' : 'Idle'));
    case 'assassin': {
      const f = keys.find(n => n === 'Attack' || n.includes('Attack') || n.includes('Slash') || n.includes('Stab') || n.includes('Strike'));
      return f || 'Idle';
    }
    default: return 'Idle';
  }
}

function resolveRunAnim(actions: Record<string, THREE.AnimationAction>): string {
  const keys = Object.keys(actions);
  return keys.find(n => n === 'Run' || n.toLowerCase().includes('run') || n.toLowerCase().includes('walk')) || 'Idle';
}

function resolveDeathAnim(actions: Record<string, THREE.AnimationAction>): string {
  const keys = Object.keys(actions);
  return keys.find(n => n === 'Death' || n.toLowerCase().includes('death')) || 'Idle';
}

function getBaseScale(classKey: ClassKey, level: number, isBoss: boolean): number {
  if (isBoss) {
    return classKey === 'tank' ? 6.5 : (classKey === 'fighter' ? 4.5 : 4.0);
  }
  return classKey === 'tank' ? (2.5 + level * 0.15) : (1.4 + level * 0.1);
}

// ─── Scratch objects (zero-alloc) ────────────────────────────────────────────
const _hudTemp = new THREE.Object3D();
const _healthColor = new THREE.Color();
const _whiteColor = new THREE.Color('#ffffff');


// ─── Main Component ──────────────────────────────────────────────────────────

const ECSArmyRendererInner = ({
  unitRegistry, activeIndicesRef, towerConfig, settingsRef, simTimeRef,
  renderedIdsRef, shadowRef, healthBarRef,
}: ECSArmyRendererProps) => {

  // ── Load all GLTF assets (preload happens at bottom of file) ──
  const f1 = useGLTF('/assets-model/Knight_Golden_Female.glb', true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const f2 = useGLTF('/assets-model/Knight_Golden_Male.glb',   true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const f3 = useGLTF('/assets-model/Knight_Male.glb',          true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const t1 = useGLTF('/assets-model/Viking_Male.glb',          true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const t2 = useGLTF('/assets-model/Viking_Female.glb',        true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const g1 = useGLTF('/assets-model/Witch.glb',                true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const g2 = useGLTF('/assets-model/Wizard.glb',               true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const m1 = useGLTF('/assets-model/Cowboy_Female.glb',        true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const n1 = useGLTF('/assets-model/Ninja_Female.glb',         true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;
  const n2 = useGLTF('/assets-model/Ninja_Male.glb',           true, true, (l: any) => l.setMeshoptDecoder(MeshoptDecoder)) as any;

  // Map classKey → array of GLTF assets to pick from randomly
  const gltfByClass = useMemo<Record<ClassKey, any[]>>(() => ({
    fighter:  [f1, f2, f3],
    tank:     [t1, t2],
    mage:     [g1, g2],
    marksman: [m1],
    assassin: [n1, n2],
  }), [f1, f2, f3, t1, t2, g1, g2, m1, n1, n2]);

  // Scene group — all lazy-cloned models are added imperatively here
  const groupRef = useRef<THREE.Group>(null!);

  // ── Lazy Pools (one per class) — all empty at mount ──
  const pools = useRef<Record<ClassKey, ClassPool>>({
    fighter:  { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    tank:     { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    mage:     { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    marksman: { items: [], available: [], assigned: new Map(), activeSet: new Set() },
    assassin: { items: [], available: [], assigned: new Map(), activeSet: new Set() },
  });

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      const allPools = pools.current;
      (Object.keys(allPools) as ClassKey[]).forEach(key => {
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
    };
  }, []);

  // ── Lazily create a new pool item for classKey ──
  const createPoolItem = (classKey: ClassKey, teamColor: string): number | null => {
    const pool = pools.current[classKey];
    if (pool.items.length >= ARMY_POOL_SIZE) return null;

    const assets = gltfByClass[classKey];
    if (!assets || assets.some(a => !a.scene)) return null;

    const selected = assets[Math.floor(Math.random() * assets.length)];
    const clone = SkeletonUtils.clone(selected.scene);
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
          if (child.material) {
            child.material = child.material.clone();
            applyPainterlyStyle(child.material);
            child.material.color.set(teamColor);
          }
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
      runAnim:    resolveRunAnim(actions),
      deathAnim:  resolveDeathAnim(actions),
    };

    pool.items.push(item);
    return pool.items.length - 1;
  };

  // ── Get pool slot for unit (lazy-create if needed) ──
  const acquirePoolSlot = (classKey: ClassKey, id: string, teamColor: string): number | null => {
    const pool = pools.current[classKey];
    if (pool.assigned.has(id)) return pool.assigned.get(id)!;

    let slotIdx: number | null = null;
    if (pool.available.length > 0) {
      slotIdx = pool.available.pop()!;
    } else if (pool.items.length < ARMY_POOL_SIZE) {
      slotIdx = createPoolItem(classKey, teamColor);
    }
    if (slotIdx === null) return null;

    // Re-apply team color when reusing a slot
    const item = pool.items[slotIdx];
    item.colorable.forEach(mesh => {
      (mesh.material as THREE.MeshStandardMaterial).color.set(teamColor);
    });
    item.initialized = false;
    pool.assigned.set(id, slotIdx);
    return slotIdx;
  };

  // ── HUD helper: hide a slot's HUD ──
  const hideHUD = (hIdx: number) => {
    _hudTemp.position.set(0, -100, 0);
    _hudTemp.updateMatrix();
    shadowRef.current?.setMatrixAt(hIdx, _hudTemp.matrix);
    healthBarRef.current?.setMatrixAt(hIdx, _hudTemp.matrix);
  };

  // ── Main render loop ──────────────────────────────────────────────────────
  useFrame((state, delta) => {
    const rawMap = unitRegistry.current;
    if (!rawMap) return;

    const indices = activeIndicesRef.current;
    if (!indices) return;

    const time = state.clock.elapsedTime;
    const camPos = state.camera.position;
    const camQ = state.camera.quaternion;
    const settings = settingsRef.current;
    const frustum = (state as any).battleFrustum;

    const isPotato = settings.potatoMode;

    // Clear all active sets
    const p = pools.current;
    p.fighter.activeSet.clear();
    p.tank.activeSet.clear();
    p.mage.activeSet.clear();
    p.marksman.activeSet.clear();
    p.assassin.activeSet.clear();

    if (isPotato) {
      // Potato mode: hide everything immediately
      (Object.keys(p) as ClassKey[]).forEach(key => {
        p[key].assigned.forEach((slotIdx, _uid2) => {
          const item = p[key].items[slotIdx];
          if (item) item.group.visible = false;
          const hIdx = CLASS_HUD_BASE[key] + slotIdx;
          hideHUD(hIdx);
          p[key].available.push(slotIdx);
        });
        p[key].assigned.clear();
      });
      return;
    }

    // Build sorted view: boss-first, then by distance
    const unitCount = indices.length;

    // Per-class unit lists (to determine who gets a pool slot — closest ARMY_POOL_SIZE)
    const classBuckets: Record<ClassKey, UnitRuntimeData[]> = {
      fighter: [], tank: [], mage: [], marksman: [], assassin: [],
    };

    for (let k = 0; k < unitCount; k++) {
      const i = indices[k];
      const u = rawMap[i];
      if (!u || !u.isActive || u.hp <= 0 || u.isDying) continue;
      const dx = camPos.x - u.position[0];
      const dz = camPos.z - u.position[2];
      u.dSq = dx * dx + dz * dz;
      const bucket = classBuckets[u.unitClass];
      if (bucket) bucket.push(u);
    }

    // For each class: sort by distance, take top ARMY_POOL_SIZE to render
    (Object.keys(classBuckets) as ClassKey[]).forEach(classKey => {
      const bucket = classBuckets[classKey];
      bucket.sort((a, b) => (a.isBoss !== b.isBoss) ? (a.isBoss ? -1 : 1) : (a.dSq || 0) - (b.dSq || 0));

      const visibleUnits = bucket.length > ARMY_POOL_SIZE ? bucket.slice(0, ARMY_POOL_SIZE) : bucket;
      const pool = p[classKey];
      const hudBase = CLASS_HUD_BASE[classKey];

      for (let vi = 0; vi < visibleUnits.length; vi++) {
        const uData = visibleUnits[vi];
        const id = uData.id;
        const teamColor = uData.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;

        const slotIdx = acquirePoolSlot(classKey, id, teamColor);
        if (slotIdx === null) continue;

        pool.activeSet.add(id);
        renderedIdsRef.current?.add(id);

        const item = pool.items[slotIdx];
        item.group.visible = true;

        const baseScale = getBaseScale(classKey, uData.level || 1, uData.isBoss);
        item.group.scale.setScalar(baseScale * settings.unitScale);

        // ── Animation ──────────────────────────────────────────────────────
        let targetAnim = 'Idle';
        if (uData.isDying) {
          targetAnim = item.deathAnim;
        } else if (uData.status === 'marching' || uData.status === 'chasing') {
          targetAnim = item.runAnim;
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

        // ── Position Lerp ──────────────────────────────────────────────────
        const tp = uData.position;
        const cp = item.group.position;
        const lerpFactor = 1.0 - Math.exp(-45 * delta);
        const distSq = (tp[0] - cp.x) ** 2 + (tp[2] - cp.z) ** 2;

        if (!item.initialized || distSq > 25) {
          cp.set(tp[0], tp[1], tp[2]);
          item.rotation = uData.rotation[1];
          item.group.rotation.y = item.rotation;
          item.initialized = true;
        } else {
          cp.x = THREE.MathUtils.lerp(cp.x, tp[0], lerpFactor);
          cp.y = THREE.MathUtils.lerp(cp.y, tp[1], lerpFactor);
          cp.z = THREE.MathUtils.lerp(cp.z, tp[2], lerpFactor);

          let diff = uData.rotation[1] - item.rotation;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff >  Math.PI) diff -= Math.PI * 2;
          item.rotation += diff * (1.0 - Math.exp(-15 * delta));
          item.group.rotation.y = item.rotation;
        }

        // ── Painterly Shader Uniform Time ──────────────────────────────────
        const timeVal = (simTimeRef.current || 0) * 0.001;
        item.colorable.forEach(mesh => {
          const mat = mesh.material as THREE.Material;
          if (mat.userData.painterlyShader) {
            mat.userData.painterlyShader.uniforms.time.value = timeVal;
          }
        });

        // ── HUD Sync ───────────────────────────────────────────────────────
        item.group.updateMatrix();
        const hIdx = hudBase + slotIdx;

        if (shadowRef.current && healthBarRef.current) {
          const HUD_DETAIL_DIST_SQ = 180 * 180;
          const showDetail = uData.isBoss || (uData.dSq || 0) < HUD_DETAIL_DIST_SQ;

          if (showDetail) {
            const by  = uData.isBoss ? 7.0 : 3.2;
            const bs  = uData.isBoss ? 2.5 : 1.0;
            const ss  = uData.isBoss ? 4.5 : 1.6;

            // Shadow
            _hudTemp.position.set(cp.x, -0.45, cp.z);
            _hudTemp.rotation.set(-Math.PI / 2, 0, 0);
            _hudTemp.scale.set(ss, ss, 1);
            _hudTemp.updateMatrix();
            shadowRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

            // Health Bar
            _hudTemp.position.set(cp.x, by, cp.z);
            _hudTemp.quaternion.copy(camQ);
            _hudTemp.scale.set(bs, bs, 1);
            _hudTemp.updateMatrix();
            healthBarRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

            // Update custom shader attribute for health percentage & ticks
            const healthAttr = healthBarRef.current.geometry.getAttribute('aHealthInfo') as THREE.InstancedBufferAttribute | undefined;
            if (healthAttr) {
                healthAttr.setXY(hIdx, uData.hp, uData.maxHp || 100);
            }

            // Fill Color + Damage Flash
            _healthColor.set(teamColor);
            const flash = Date.now() - (uData.lastDamageTime || 0);
            if (flash < 100) _healthColor.lerp(_whiteColor, 1.0 - flash / 100);
            healthBarRef.current.setColorAt(hIdx, _healthColor);


          } else {
            // Far: shadow only
            _hudTemp.position.set(cp.x, -0.45, cp.z);
            _hudTemp.rotation.set(-Math.PI / 2, 0, 0);
            _hudTemp.scale.set(uData.isBoss ? 4.5 : 1.6, uData.isBoss ? 4.5 : 1.6, 1);
            _hudTemp.updateMatrix();
            shadowRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

            _hudTemp.scale.set(0.001, 0.001, 0.001);
            _hudTemp.updateMatrix();
            healthBarRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
          }
        }

        // ── Animation Mixer Update (with culling) ──────────────────────────
        const isVisible = frustum ? frustum.containsPoint(cp) : true;
        const sf = (uData.dSq || 0) > 3600 ? 5 : (uData.dSq || 0) > 400 ? 2 : 1;
        const tooFar = (uData.dSq || 0) > ANIM_CULL_DIST_SQ;

        if (!tooFar && isVisible && time - item.lastUpdate >= 0.016 * sf) {
          item.mixer.update(delta * sf);
          item.lastUpdate = time;
        }
      }

      // ── Return inactive slots to pool ──────────────────────────────────────
      pool.assigned.forEach((slotIdx, _uid) => {
        if (!pool.activeSet.has(_uid)) {
          const item = pool.items[slotIdx];
          if (item) item.group.visible = false;

          const hIdx = hudBase + slotIdx;
          hideHUD(hIdx);

          pool.available.push(slotIdx);
          pool.assigned.delete(_uid);
        }
      });
    });
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
