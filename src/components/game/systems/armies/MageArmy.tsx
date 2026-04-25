'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MeshoptDecoder } from 'meshoptimizer';
import { SkeletonUtils } from 'three-stdlib';
import { useVFX } from '../VFXManager';
import { ActiveUnit, TowerConfig, SimulationSettings, UnitRuntimeData } from "@/src/core/domain/unit.types";
import { useStore } from "@/src/state/useStore";
import { SpellsRegistryRef } from '../effects/MageSpellEffect';
import { ENEMY_BASE_Z, PLAYER_BASE_Z, ARMY_POOL_SIZE, ANIM_CULL_DIST_SQ } from "@/src/core/logic/combat/constants";
import { lerpAngle } from "@/src/core/logic/combat/battleUtils";
import { battleGrid } from "@/src/core/logic/combat/spatialGrid";
import * as YUKA from 'yuka';
import { applyPainterlyStyle } from '../effects/PainterlyMaterials';


interface MageArmyProps {
  unitsMap: React.RefObject<UnitRuntimeData[]>;
  towerConfig: TowerConfig;
  settingsRef: React.RefObject<SimulationSettings>;
  spellsRef: SpellsRegistryRef;
  simTimeRef: React.RefObject<number>;
  vehicles: React.RefObject<YUKA.Vehicle[]>;
  unitIndex: React.RefObject<Map<string, ActiveUnit>>;
  renderedIdsRef: React.RefObject<Set<string>>;
  shadowRef: React.RefObject<THREE.InstancedMesh>;
  healthBgRef: React.RefObject<THREE.InstancedMesh>;
  healthFillRef: React.RefObject<THREE.InstancedMesh>;
  notchRef: React.RefObject<THREE.InstancedMesh>;
  hudBaseIdx: number;
  namePoolMap: React.MutableRefObject<Map<string, number>>;
  nameTextRefs: React.RefObject<any[]>;
  compBuffers: any;
}

const POOL_SIZE = ARMY_POOL_SIZE; // Controlled from constants.ts

const _hudTemp = new THREE.Object3D();
const _healthColor = new THREE.Color();

export function MageArmy({
  unitsMap, towerConfig, settingsRef, spellsRef, simTimeRef, vehicles,
  unitIndex, renderedIdsRef, shadowRef, healthBgRef, healthFillRef, notchRef, hudBaseIdx,
  namePoolMap, nameTextRefs
}: MageArmyProps) {
  const poolMapRef = useRef<Map<string, number>>(new Map());
  const availableIndicesRef = useRef<number[]>([]);
  const activeSetRef = useRef<Set<string>>(new Set());
  const frameCountRef = useRef(0);
  const { spawnVFX } = useVFX();
  const lastVFXRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    availableIndicesRef.current = Array.from({ length: POOL_SIZE }, (_, i) => i);
  }, []);

  const mage1 = useGLTF('/assets-model/Witch.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }) as any;
  const mage2 = useGLTF('/assets-model/Wizard.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }) as any;

  const characterPool = useMemo(() => {
    const items: any[] = [];
    if (!mage1.scene || !mage2.scene) return [];
    const availableAssets = [mage1, mage2];
    for (let i = 0; i < POOL_SIZE; i++) {
      const selectedAsset = availableAssets[Math.floor(Math.random() * availableAssets.length)];
      const clone = SkeletonUtils.clone(selectedAsset.scene);
      const mixer = new THREE.AnimationMixer(clone);
      const actions: Record<string, THREE.AnimationAction> = {};
      if (selectedAsset.animations) {
        selectedAsset.animations.forEach((clip: THREE.AnimationClip) => { actions[clip.name] = mixer.clipAction(clip); });
      }
      const colorable: THREE.Mesh[] = [];
      clone.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          child.frustumCulled = true;
          const name = child.name.toLowerCase();
          const isColorable = name.includes('cloth') || name.includes('trim') || name.includes('jewel') || name.includes('robe') || name.includes('cloak') || name.includes('cape') || name.includes('scarf') || name.includes('primary') || name.includes('team');
          if (isColorable) {
            if (child.material) {
              child.material = child.material.clone();
              applyPainterlyStyle(child.material);
            }
            colorable.push(child);
          }
        }
      });
      clone.position.set(0, -100, 0);
      clone.visible = false;
      const actionNames = Object.keys(actions);
      const attackAnim = actionNames.find((name) => {
        const lowered = name.toLowerCase();
        return (
          lowered.includes('spell') ||
          lowered.includes('cast') ||
          lowered.includes('attack') ||
          lowered.includes('shoot')
        );
      }) || 'Idle';
      const runAnim = actionNames.find((name) => {
        const lowered = name.toLowerCase();
        return lowered.includes('run') || lowered.includes('walk');
      }) || 'Idle';
      items.push({ group: clone, colorable, mixer, actions, attackAnim, runAnim, currentAnim: '', lastUpdate: 0, rotation: 0, initialized: false });
    }
    return items;
  }, [mage1, mage2]);

  useEffect(() => {
    return () => {
      characterPool.forEach(item => {
        if (item.group) {
          item.group.traverse((child: any) => {
            if (child.isMesh) {
              child.geometry.dispose();
              if (child.material) {
                if (Array.isArray(child.material)) {
                  child.material.forEach((m: any) => m.dispose());
                } else {
                  child.material.dispose();
                }
              }
            }
          });
        }
      });
    };
  }, [characterPool]);

  useFrame((state, delta) => {
    frameCountRef.current++;
    const rawMap = unitsMap.current;
    if (!rawMap || characterPool.length === 0) return;

    const time = state.clock.elapsedTime;
    const _activeSet = activeSetRef.current;
    _activeSet.clear();

    const storeState = useStore.getState();
    const mode = storeState.gameMode;
    const settings = settingsRef.current;
    if (settings.potatoMode) {
      poolMapRef.current.forEach((idx) => {
        if (characterPool[idx]) characterPool[idx].group.visible = false;
      });
      poolMapRef.current.clear();
      availableIndicesRef.current = Array.from({ length: POOL_SIZE }, (_, i) => i);
      return;
    }

    const buckets = (state as any).unitBuckets;
    const myUnits: UnitRuntimeData[] = buckets ? buckets.mage : [];
    if (!myUnits) return;

    // --- 1. BRAIN LOOP ---
    for (let i = 0; i < myUnits.length; i++) {
      const uData = myUnits[i];
      const id = uData.id;

      // Targeting
      if (frameCountRef.current % 10 === 0 || !uData.targetId) {
        let bestScore = -Infinity;
        let bestTargetId = undefined;
        const STICKY_MULT = 0.75;

        const searchRadius = mode === 'TRAINING' ? 1000 : (Math.sqrt(uData.perceptionRadiusSq || 2025) + 2);
        const nearby = battleGrid.queryRadius(uData.position[0], uData.position[2], searchRadius);

        for (let j = 0; j < nearby.length; j++) {
          const potential = nearby[j];
          if (!potential.isActive || potential.hp <= 0 || potential.isDying) continue;
          if (potential.id === id) continue;
          if (potential.type === uData.type) continue;
          if (mode === 'TRAINING' && uData.type === 'player' && potential.userName !== 'Training') continue;

          const dx = uData.position[0] - potential.position[0];
          const dz = uData.position[2] - potential.position[2];
          const dSq = dx * dx + dz * dz;

          let score = 1.0 / (dSq + 0.1);
          if (potential.id === uData.targetId) score /= STICKY_MULT;

          if (score > bestScore) {
            bestScore = score;
            bestTargetId = potential.id;
          }
        }

        if (bestTargetId === undefined) {
          bestTargetId = uData.type === 'player' ? 'enemy-base' : 'player-base';
        }

        uData.targetId = bestTargetId;
        const coreUnit = unitIndex?.current?.get(id);
        if (coreUnit) coreUnit.targetId = bestTargetId;
      }

      // VFX Implementation
      const currentAtk = uData.lastAttackTime || 0;
      const prevAtk = lastVFXRef.current.get(id) || 0;
      if (currentAtk > prevAtk) {
        const launchY = uData.position[1] + 1.8;
        const teamColor = uData.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
        spawnVFX([uData.position[0], launchY, uData.position[2]], 'spark', '#ffffff');
        spawnVFX([uData.position[0], launchY, uData.position[2]], 'muzzle', teamColor);

        if (uData.targetId && spellsRef?.current) {
          const isBase = uData.targetId === 'enemy-base' || uData.targetId === 'player-base';
          const tIdx = !isBase ? parseInt(uData.targetId.split('-')[1]) : -1;
          const target = !isBase ? rawMap[tIdx] : null;

          if (isBase || (target && target.isActive)) {
            const spells = spellsRef.current;
            const targets: any[] = [];
            if (isBase) {
              targets.push({ id: uData.targetId, position: [0, 1.8, uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z] });
            } else {
              targets.push(target);
              const AOE_RADIUS = 3.5;
              const aoeNearby = battleGrid.queryRadius(target!.position[0], target!.position[2], AOE_RADIUS);
              for (let j = 0; j < aoeNearby.length && targets.length < 4; j++) {
                const potential = aoeNearby[j];
                if (!potential.isActive || potential.hp <= 0 || potential.id === target?.id || potential.type === uData.type) continue;
                targets.push(potential);
              }
            }

            targets.forEach(t => {
              const sIdx = spells.findIndex(s => !s.active);
              if (sIdx !== -1) {
                spells[sIdx].fromX = uData.position[0];
                spells[sIdx].fromY = launchY;
                spells[sIdx].fromZ = uData.position[2];
                spells[sIdx].toX = t.position[0];
                spells[sIdx].toY = t.position[1] + (t.id.includes('base') ? 0 : 1.0);
                spells[sIdx].toZ = t.position[2];
                spells[sIdx].targetId = t.id;
                spells[sIdx].startTime = simTimeRef.current || 0;
                spells[sIdx].color = teamColor;
                spells[sIdx].active = true;
                spells[sIdx].progress = 0;
              }
            });
          }
        }
        lastVFXRef.current.set(id, currentAtk);
      }

      // Status
      if (uData.targetId) {
        const isBase = uData.targetId === 'player-base' || uData.targetId === 'enemy-base';
        const distSq = isBase ? (uData.position[0] * uData.position[0] + Math.pow(uData.position[2] - (uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z), 2)) :
          (Math.pow(uData.position[0] - rawMap[parseInt(uData.targetId.split('-')[1])].position[0], 2) + Math.pow(uData.position[2] - rawMap[parseInt(uData.targetId.split('-')[1])].position[2], 2));
        const range = isBase ? (uData.range || 15.0) * 0.82 : (uData.range || 15.0);
        uData.status = distSq <= range * range ? 'attacking' : 'marching';
      } else {
        const baseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
        uData.status = Math.abs(uData.position[2] - baseZ) < 15 ? 'attacking' : 'marching';
      }

      // Steering
      const vIdx = parseInt(id.split('-')[1]);
      const vehicle = vehicles?.current?.[vIdx];
      if (vehicle) {
        let isChasing = false;
        if (uData.targetId) {
          const tIdx = parseInt(uData.targetId.split('-')[1]);
          const target = rawMap[tIdx];
          if (target && target.isActive && target.id === uData.targetId) {
            const seekB = (vehicle.steering.behaviors as any).find((b: any) => b.target !== undefined);
            if (seekB) {
              const dx = uData.position[0] - target.position[0];
              const dz = uData.position[2] - target.position[2];
              if (dx * dx + dz * dz < 49) {
                const retreatDirZ = uData.type === 'player' ? 1 : -1;
                seekB.target.set(uData.position[0] + (uData.position[0] - target.position[0]) * 2, 0, uData.position[2] + (uData.position[2] - target.position[2]) * 2 + (retreatDirZ * 5));
              } else {
                seekB.target.set(target.position[0], 0, target.position[2]);
              }
              isChasing = true;
            }
          }
        }
        if (!isChasing) {
          const seekB = (vehicle.steering.behaviors as any).find((b: any) => b.target !== undefined);
          if (seekB) {
            seekB.target.set((uData.laneOffset || 0), 0, uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z);
          }
        }
        vehicle.maxSpeed = (uData.status === 'attacking' || uData.isDying) ? 0 : (uData.speed || 3) * (settings.globalSpeedMultiplier || 1);
        const velSq = vehicle.velocity.x ** 2 + vehicle.velocity.z ** 2;
        if (uData.status === 'marching' && velSq > 0.05) {
          uData.rotation[1] = lerpAngle(uData.rotation[1], Math.atan2(vehicle.velocity.x, vehicle.velocity.z), (settings.rotationSmoothing || 0.1) * 2);
        } else if (uData.status === 'attacking') {
          const baseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
          const tIdx = uData.targetId ? parseInt(uData.targetId.split('-')[1]) : -1;
          const tData = tIdx !== -1 ? rawMap[tIdx] : null;
          const tx = (tData && tData.isActive) ? tData.position[0] : 0;
          const tz = (tData && tData.isActive) ? tData.position[2] : baseZ;
          uData.rotation[1] = lerpAngle(uData.rotation[1], Math.atan2(tx - uData.position[0], tz - uData.position[2]), settings.rotationSmoothing || 0.1);
        }
      }
    }

    // --- 2. ACTOR LOOP ---
    myUnits.sort((a, b) => (a.isBoss !== b.isBoss ? -1 : (a.dSq || 0) - (b.dSq || 0)));
    const visibleUnits = myUnits.slice(0, POOL_SIZE);

    visibleUnits.forEach((uData) => {
      const id = uData.id;
      _activeSet.add(id);
      renderedIdsRef.current.add(id);

      if (!poolMapRef.current.has(id)) {
        if (availableIndicesRef.current.length > 0) {
          const pIdx = availableIndicesRef.current.shift()!;
          poolMapRef.current.set(id, pIdx);
          const pItem = characterPool[pIdx];
          const teamColor = uData.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
          pItem.colorable.forEach((mesh: THREE.Mesh) => {
            (mesh.material as THREE.MeshStandardMaterial).color.set(teamColor);
          });
        } else return;
      }

      const poolIdx = poolMapRef.current.get(id);
      if (poolIdx === undefined) return;
      const pItem = characterPool[poolIdx];
      if (!pItem) return;
      pItem.group.visible = true;
      pItem.group.scale.setScalar(uData.isBoss ? 4.0 : (1.3 + (uData.level || 1) * 0.1) * settings.unitScale);

      let targetAnim = 'Idle';
      if (uData.isDying) targetAnim = 'Death';
      else if (uData.status === 'marching') targetAnim = pItem.runAnim || 'Run';
      else if (uData.status === 'attacking') {
        const timeSinceAtk = (simTimeRef.current || 0) - (uData.lastAttackTime || 0);
        const atkName = pItem.attackAnim || 'Idle';
        targetAnim = timeSinceAtk < 650 ? atkName : 'Idle';
      }
      if (!pItem.actions[targetAnim]) targetAnim = 'Idle';

      if (pItem.currentAnim !== targetAnim) {
        const prev = pItem.actions[pItem.currentAnim];
        const next = pItem.actions[targetAnim];
        if (next) {
          if (prev) prev.fadeOut(0.2);
          next.reset().fadeIn(0.2).play();
          pItem.currentAnim = targetAnim;
        }
      }

      const tp = uData.position;
      const cp = pItem.group.position;
      const lerpFactor = 1.0 - Math.exp(-25 * delta);
      if (!pItem.initialized) {
        cp.set(tp[0], tp[1], tp[2]);
        pItem.rotation = uData.rotation[1];
        pItem.group.rotation.y = pItem.rotation;
        pItem.initialized = true;
      } else {
        cp.x = THREE.MathUtils.lerp(cp.x, tp[0], lerpFactor);
        cp.y = THREE.MathUtils.lerp(cp.y, tp[1], lerpFactor);
        cp.z = THREE.MathUtils.lerp(cp.z, tp[2], lerpFactor);
        let diff = uData.rotation[1] - pItem.rotation;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        pItem.rotation += diff * (1.0 - Math.exp(-15 * delta));
        pItem.group.rotation.y = pItem.rotation;
      }

      pItem.group.updateMatrix();
      const hIdx = hudBaseIdx + poolIdx;
      if (shadowRef.current && healthBgRef.current) {
        const showDetail = uData.isBoss || (uData.dSq || 0) < 32400;
        if (showDetail) {
          const pct = Math.max(0, uData.hp / (uData.maxHp || 100));
          const by = uData.isBoss ? 7.0 : 3.2;
          const bs = uData.isBoss ? 2.5 : 1.0;

          _hudTemp.position.set(cp.x, -0.45, cp.z);
          _hudTemp.rotation.set(-Math.PI / 2, 0, 0);
          _hudTemp.scale.set(uData.isBoss ? 4.5 : 1.6, uData.isBoss ? 4.5 : 1.6, 1);
          _hudTemp.updateMatrix();
          shadowRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          _hudTemp.position.set(cp.x, by, cp.z);
          _hudTemp.quaternion.copy(state.camera.quaternion);
          _hudTemp.scale.set(bs, bs, 1);
          _hudTemp.updateMatrix();
          healthBgRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          const fx = pct * bs;
          _hudTemp.scale.set(fx, bs, 1);
          _hudTemp.updateMatrix();
          healthFillRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          _healthColor.set(uData.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color);
          healthFillRef.current.setColorAt(hIdx, _healthColor);

          _hudTemp.position.set(cp.x, by, cp.z);
          _hudTemp.scale.set(bs, bs, 1);
          _hudTemp.updateMatrix();
          notchRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          if (namePoolMap.current.has(id) && nameTextRefs.current) {
            const nameSlot = namePoolMap.current.get(id)!;
            const nameMesh = nameTextRefs.current[nameSlot];
            if (nameMesh) {
              nameMesh.position.set(cp.x, (uData.isBoss ? 7.2 : 3.4) + (uData.isBoss ? 1.8 : 0.7), cp.z);
              nameMesh.quaternion.copy(state.camera.quaternion);
            }
          }
        } else {
          _hudTemp.position.set(cp.x, -0.45, cp.z);
          _hudTemp.rotation.set(-Math.PI / 2, 0, 0);
          _hudTemp.scale.set(1.6, 1.6, 1);
          _hudTemp.updateMatrix();
          shadowRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          _hudTemp.position.set(0, -100, 0);
          _hudTemp.updateMatrix();
          healthBgRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
          healthFillRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
          notchRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
        }
      }

      const frustum = (state as any).battleFrustum;
      const isVisible = frustum ? frustum.containsPoint(cp) : true;
      const sf = (uData.dSq || 0) > 3600 ? 5 : (uData.dSq || 0) > 400 ? 2 : 1;
      if ((uData.dSq || 0) <= ANIM_CULL_DIST_SQ && isVisible && time - pItem.lastUpdate >= 0.016 * sf) {
        pItem.mixer.update(delta * sf);
        pItem.lastUpdate = time;
      }
    });

    poolMapRef.current.forEach((poolIdx, unitId) => {
      if (!_activeSet.has(unitId)) {
        const pItem = characterPool[poolIdx];
        if (pItem) pItem.group.visible = false;
        const hIdx = hudBaseIdx + poolIdx;
        _hudTemp.position.set(0, -100, 0);
        _hudTemp.updateMatrix();
        if (shadowRef.current) shadowRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
        if (healthBgRef.current) {
          healthBgRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
          healthFillRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
          notchRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
        }
        availableIndicesRef.current.push(poolIdx);
        poolMapRef.current.delete(unitId);
      }
    });

    if (frameCountRef.current % 2 === 0) {
      poolMapRef.current.forEach((poolIdx) => {
      const item = characterPool[poolIdx];
      if (!item) return;
      item.colorable.forEach((mesh: THREE.Mesh) => {
        const mat = mesh.material as THREE.Material;
        if (mat.userData.painterlyShader) {
          mat.userData.painterlyShader.uniforms.time.value = (simTimeRef.current || 0) * 0.001;
        }
      });
      });
    }
  });

  return (
    <group>
      {characterPool.map((item, idx) => (<primitive key={"pool-mage-" + idx} object={item.group} />))}
    </group>
  );
}

useGLTF.preload('/assets-model/Witch.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
useGLTF.preload('/assets-model/Wizard.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
