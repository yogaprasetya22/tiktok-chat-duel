'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { useVFX } from '../VFXManager';
import { ActiveUnit, TowerConfig, SimulationSettings, UnitRuntimeData } from '../../../hooks/battle/types';
import { useStore } from '../../../hooks/useStore';
import { SpellsRegistryRef } from '../effects/MageSpellEffect';
import { PLAYER_BASE_Z, ENEMY_BASE_Z } from '../../../hooks/battle/constants';
import { lerpAngle } from '../../../hooks/battle/battleUtils';
import * as YUKA from 'yuka';
import { applyPainterlyStyle } from '../effects/PainterlyMaterials';


interface MarksmanArmyProps {
  unitsMap: React.RefObject<UnitRuntimeData[]>;
  towerConfig: TowerConfig;
  settingsRef: React.RefObject<SimulationSettings>;
  spellsRef: SpellsRegistryRef;
  mmSpellsRef: SpellsRegistryRef;
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
}

const POOL_SIZE = 120; // Ultimate Warfare Capacity

const _hudTemp = new THREE.Object3D();
const _healthColor = new THREE.Color();
const _whiteColor = new THREE.Color('#ffffff');

export function MarksmanArmy({
  unitsMap, towerConfig, settingsRef, spellsRef, mmSpellsRef, simTimeRef, vehicles,
  unitIndex, renderedIdsRef, shadowRef, healthBgRef, healthFillRef, notchRef, hudBaseIdx,
  namePoolMap, nameTextRefs
}: MarksmanArmyProps) {
  const poolMapRef = useRef<Map<string, number>>(new Map());
  const availableIndicesRef = useRef<number[]>([]);
  const activeSetRef = useRef<Set<string>>(new Set());
  const lastVFXRef = useRef<Map<string, number>>(new Map());
  const frameCountRef = useRef(0);
  const { spawnVFX } = useVFX();

  useEffect(() => {
    availableIndicesRef.current = Array.from({ length: POOL_SIZE }, (_, i) => i);
  }, []);

  const m1 = useGLTF('/assets-model/Cowboy_Female.glb') as any;

  const characterPool = useMemo(() => {
    const items: any[] = [];
    if (!m1.scene) return [];

    for (let i = 0; i < POOL_SIZE; i++) {
      const clone = SkeletonUtils.clone(m1.scene);
      const mixer = new THREE.AnimationMixer(clone);
      const actions: Record<string, THREE.AnimationAction> = {};
      if (m1.animations) {
        m1.animations.forEach((clip: THREE.AnimationClip) => { actions[clip.name] = mixer.clipAction(clip); });
      }
      const colorable: THREE.Mesh[] = [];
      clone.traverse((child: any) => {
        if (child.isMesh) {
          child.castShadow = false;
          child.receiveShadow = false;
          child.frustumCulled = true;
          const name = child.name.toLowerCase();
          const isColorable = name.includes('cloth') || name.includes('pattern') || name.includes('trim') || name.includes('ribbon') || name.includes('quiver') || name.includes('robe') || name.includes('cloak') || name.includes('cape') || name.includes('primary') || name.includes('team');
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
      items.push({ group: clone, colorable, mixer, actions, currentAnim: '', lastUpdate: 0, rotation: 0, initialized: false });
    }
    return items;
  }, [m1]);

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
    const camPos = state.camera.position;
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

    // Filter units of this class
    const myUnits: UnitRuntimeData[] = [];
    for (let i = 0; i < rawMap.length; i++) {
      const u = rawMap[i];
      if (!u.isActive || u.hp <= 0 || u.unitClass !== 'marksman') continue;
      myUnits.push(u);
    }

    // --- 1. BRAIN LOOP ---
    for (let i = 0; i < myUnits.length; i++) {
      const uData = myUnits[i];
      const id = uData.id;

      // Targeting (Throttled & Sticky)
      if (frameCountRef.current % 12 === 0 || !uData.targetId) {
        let bestScore = -Infinity;
        let bestTargetId = undefined;
        const STICKY_MULT = 0.75; // 25% advantage for current target

        for (let j = 0; j < rawMap.length; j++) {
          const potential = rawMap[j];
          if (!potential.isActive || potential.hp <= 0 || potential.isDying) continue;
          if (potential.id === id) continue;
          if (potential.type === uData.type) continue;
          if (mode === 'TRAINING' && uData.type === 'player' && potential.userName !== 'Training') continue;

          const dx = uData.position[0] - potential.position[0];
          const dz = uData.position[2] - potential.position[2];
          const dSq = dx * dx + dz * dz;

          const perceptionSq = uData.perceptionRadiusSq || 6400;
          const chaseRangeSq = mode === 'TRAINING' ? 1000000 : 6400;

          if (dSq > perceptionSq || dSq > chaseRangeSq) continue;

          // Targeting Score: 1/distSq. If it's the current target, boost score.
          let score = 1.0 / (dSq + 0.1);
          if (potential.id === uData.targetId) score /= STICKY_MULT;

          if (score > bestScore) {
            bestScore = score;
            bestTargetId = potential.id;
          }
        }

        // --- SCORE TOWER (ONLY if no units found) ---
        if (bestTargetId === undefined) {
          const targetBaseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
          const distToBaseSq = uData.position[0] * uData.position[0] + Math.pow(uData.position[2] - targetBaseZ, 2);
          bestScore = 6.0 / (distToBaseSq + 0.1);
          bestTargetId = uData.type === 'player' ? 'enemy-base' : 'player-base';
        }
        uData.targetId = bestTargetId;
        const coreUnit = unitIndex?.current?.get(id);
        if (coreUnit) coreUnit.targetId = bestTargetId;
      }

      // Status
      if (uData.targetId) {
        const tIdx = parseInt(uData.targetId.split('-')[1]);
        const target = rawMap[tIdx];
        if (target && target.isActive && target.id === uData.targetId) {
          const dx = uData.position[0] - target.position[0];
          const dz = uData.position[2] - target.position[2];
          const distSq = dx * dx + dz * dz;
          const rangeSq = (uData.range || 8.5) * (uData.range || 8.5);
          uData.status = distSq <= rangeSq ? 'attacking' : 'marching';
        } else if (uData.targetId === 'player-base' || uData.targetId === 'enemy-base') {
          const baseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
          const distSq = uData.position[0] * uData.position[0] + Math.pow(uData.position[2] - baseZ, 2);

          // MM range reduction for Tower (0.82)
          const range = (uData.range || 8.5) * 0.82;
          const rangeSq = range * range;
          uData.status = (distSq <= rangeSq) ? 'attacking' : 'marching';
        } else { uData.targetId = undefined; }
      } else {
        const baseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
        const distToBaseSq = Math.pow(uData.position[2] - baseZ, 2);
        uData.status = distToBaseSq < 225 ? 'attacking' : 'marching';
      }

      // VFX (Muzzle Flashes & Bullets)
      const currentAtk = uData.lastAttackTime || 0;
      const prevAtk = lastVFXRef.current.get(id) || 0;
      if (currentAtk > prevAtk) {
        const forwardX = Math.sin(uData.rotation[1]) * 2.5;
        const forwardZ = Math.cos(uData.rotation[1]) * 2.5;
        const teamColor = uData.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
        const launchY = 1.8;

        spawnVFX([uData.position[0] + forwardX, launchY, uData.position[2] + forwardZ], 'muzzle', teamColor);

        // Intelligence: Launch Bullet
        if (uData.targetId && mmSpellsRef?.current) {
          const tIdx = parseInt(uData.targetId.split('-')[1]);
          const target = rawMap[tIdx];
          if (target && target.isActive) {
            const spells = mmSpellsRef.current;
            for (let sIdx = 0; sIdx < spells.length; sIdx++) {
              if (!spells[sIdx].active) {
                spells[sIdx].fromX = uData.position[0] + forwardX;
                spells[sIdx].fromY = launchY;
                spells[sIdx].fromZ = uData.position[2] + forwardZ;
                spells[sIdx].toX = target.position[0];
                spells[sIdx].toY = target.position[1] + 1.2;
                spells[sIdx].toZ = target.position[2];
                spells[sIdx].targetId = uData.targetId;
                spells[sIdx].startTime = simTimeRef.current || 0;
                spells[sIdx].color = teamColor;
                spells[sIdx].active = true;
                spells[sIdx].progress = 0;
                spells[sIdx].isBullet = true;
                break;
              }
            }
          }
        }

        lastVFXRef.current.set(id, currentAtk);
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
            // PERF: Find SeekBehavior directly
            const seekB = (vehicle.steering.behaviors as any).find((b: any) => b.target !== undefined);
            if (seekB) {
              const totalVal = id.split('-').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
              const angle = (totalVal % 360) * (Math.PI / 180);
              const orbitRadius = uData.encirclementRadius || 1.0;
              const offsetX = Math.cos(angle) * orbitRadius;
              const offsetZ = Math.sin(angle) * orbitRadius;
              seekB.target.set(target.position[0] + offsetX, 0, target.position[2] + offsetZ);
              isChasing = true;
            }
          }
        }
        if (!isChasing) {
          const seekB = (vehicle.steering.behaviors as any).find((b: any) => b.target !== undefined);
          if (seekB) {
            const baseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
            const amp = uData.laneSwaggerAmp || 0.3;
            const swagger = Math.sin((id.length * 7) + (uData.jitterOffset || 0)) * amp;
            seekB.target.set((uData.laneOffset || 0) + swagger, 0, baseZ);
          }
        }
        vehicle.maxSpeed = (uData.status === 'attacking' || uData.isDying) ? 0 : (uData.speed || 3) * (settings.globalSpeedMultiplier || 1);

        // Intelligence: Smoother Rotation (Fixed spinning bug)
        const velSq = vehicle.velocity.x ** 2 + vehicle.velocity.z ** 2;
        if (uData.status === 'marching' && velSq > 0.05) {
          const targetRot = Math.atan2(vehicle.velocity.x, vehicle.velocity.z);
          uData.rotation[1] = lerpAngle(uData.rotation[1], targetRot, (settings.rotationSmoothing || 0.1) * 2);
        } else if (uData.status === 'attacking') {
          const baseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
          const tIdx = uData.targetId ? parseInt(uData.targetId.split('-')[1]) : -1;
          const tData = tIdx !== -1 ? rawMap[tIdx] : null;
          const tx = (tData && tData.isActive && tData.id === uData.targetId) ? tData.position[0] : 0;
          const tz = (tData && tData.isActive && tData.id === uData.targetId) ? tData.position[2] : baseZ;
          const targetRot = Math.atan2(tx - uData.position[0], tz - uData.position[2]);
          uData.rotation[1] = lerpAngle(uData.rotation[1], targetRot, settings.rotationSmoothing || 0.1);
        }
      }
    }

    // --- 2. ACTOR LOOP ---
    myUnits.sort((a, b) => {
      if (a.isBoss !== b.isBoss) return -1;
      return (a.dSq || 0) - (b.dSq || 0);
    });
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
      if (!pItem) {
        poolMapRef.current.delete(id);
        return;
      }
      pItem.group.visible = true;

      const baseScale = uData.isBoss ? 4.2 : (1.3 + (uData.level || 1) * 0.1);
      pItem.group.scale.setScalar(baseScale * settings.unitScale);

      let targetAnim = 'Idle';
      if (uData.isDying) targetAnim = 'Death';
      else if (uData.status === 'marching') targetAnim = 'Run';
      else if (uData.status === 'attacking') {
        const timeSinceAtk = (simTimeRef.current || 0) - (uData.lastAttackTime || 0);
        const shootName = pItem.actions['Shoot_OneHanded'] ? 'Shoot_OneHanded' :
          (pItem.actions['Shoot'] ? 'Shoot' :
            (pItem.actions['Attack'] ? 'Attack' : 'Idle'));
        targetAnim = timeSinceAtk < 600 ? shootName : 'Idle';
      }
      if (!pItem.actions[targetAnim]) targetAnim = 'Idle';

      if (pItem.currentAnim !== targetAnim) {
        const prev = pItem.actions[pItem.currentAnim];
        const next = pItem.actions[targetAnim];
        if (next) {
          if (prev) prev.fadeOut(0.2);
          next.setLoop(targetAnim === 'Death' ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
          if (targetAnim === 'Death') next.clampWhenFinished = true;
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

      // --- HUD SYNC (Frame-Perfect) ---
      pItem.group.updateMatrix();

      const hIdx = hudBaseIdx + poolIdx;
      if (shadowRef.current && healthBgRef.current) {
        const HUD_DETAIL_DIST_SQ = 180 * 180;
        const showDetail = uData.isBoss || (uData.dSq || 0) < HUD_DETAIL_DIST_SQ;

        if (showDetail) {
          const pct = Math.max(0, uData.hp / (uData.maxHp || 100));
          const by = uData.isBoss ? 7.0 : 3.2;
          const bs = uData.isBoss ? 2.5 : 1.0;

          // 1. Shadow
          _hudTemp.position.set(cp.x, -0.45, cp.z);
          _hudTemp.rotation.set(-Math.PI / 2, 0, 0);
          const ss = uData.isBoss ? 4.5 : 1.6;
          _hudTemp.scale.set(ss, ss, 1);
          _hudTemp.updateMatrix();
          shadowRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          // 2. Health BG
          _hudTemp.position.set(cp.x, by, cp.z);
          _hudTemp.quaternion.copy(state.camera.quaternion);
          _hudTemp.scale.set(bs, bs, 1);
          _hudTemp.updateMatrix();
          healthBgRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          // 3. Health Fill
          const fx = pct * bs;
          _hudTemp.scale.set(fx, bs, 1);
          const ox = (bs - fx) * 0.4;
          const camRotY = state.camera.rotation.y;
          _hudTemp.position.x -= Math.cos(camRotY) * ox;
          _hudTemp.position.z += Math.sin(camRotY) * ox;
          _hudTemp.updateMatrix();
          healthFillRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          // 4. Color & Flash
          _healthColor.set(uData.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color);
          const flash = Date.now() - (uData.lastDamageTime || 0);
          if (flash < 100) _healthColor.lerp(_whiteColor, 1.0 - (flash / 100));
          healthFillRef.current.setColorAt(hIdx, _healthColor);

          // 5. Notch
          _hudTemp.position.set(cp.x, by, cp.z);
          _hudTemp.scale.set(bs, bs, 1);
          _hudTemp.updateMatrix();
          notchRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          // 6. Name Sync (Glued to head)
          if (namePoolMap.current.has(id) && nameTextRefs.current) {
            const nameSlot = namePoolMap.current.get(id)!;
            const nameMesh = nameTextRefs.current[nameSlot];
            if (nameMesh) {
              const hover = Math.sin(state.clock.elapsedTime * 3 + id.length) * 0.1;
              nameMesh.position.set(cp.x, (uData.isBoss ? 7.2 : 3.4) + (uData.isBoss ? 1.8 : 0.7) + hover, cp.z);
              nameMesh.quaternion.copy(state.camera.quaternion);
            }
          }
        } else {
          // Standard low-detail shadow even if far
          _hudTemp.position.set(cp.x, -0.45, cp.z);
          _hudTemp.rotation.set(-Math.PI / 2, 0, 0);
          _hudTemp.scale.set(uData.isBoss ? 4.5 : 1.6, uData.isBoss ? 4.5 : 1.6, 1);
          _hudTemp.updateMatrix();
          shadowRef.current.setMatrixAt(hIdx, _hudTemp.matrix);

          // Hide detailed HUD
          _hudTemp.position.set(0, -100, 0);
          _hudTemp.updateMatrix();
          healthBgRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
          healthFillRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
          notchRef.current.setMatrixAt(hIdx, _hudTemp.matrix);
        }
      }

      const sf = (uData.dSq || 0) > 3600 ? 5 : (uData.dSq || 0) > 400 ? 2 : 1;
      if (time - pItem.lastUpdate >= 0.016 * sf) {
        pItem.mixer.update(delta * sf);
        pItem.lastUpdate = time;
      }
    });

    poolMapRef.current.forEach((poolIdx, unitId) => {
      if (!_activeSet.has(unitId)) {
        const pItem = characterPool[poolIdx];
        if (pItem) pItem.group.visible = false;

        // --- CLEANUP HUD (Ghost Shadow fix) ---
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

    // Painterly Shader Update
    characterPool.forEach(item => {
      item.colorable.forEach((mesh: THREE.Mesh) => {
        const mat = mesh.material as THREE.Material;
        if (mat.userData.painterlyShader) {
          mat.userData.painterlyShader.uniforms.time.value = (simTimeRef.current || 0) * 0.001;
        }
      });
    });
  });

  return (
    <group>
      {characterPool.map((item, idx) => (<primitive key={"pool-marksman-" + idx} object={item.group} />))}
    </group>
  );
}

useGLTF.preload('/assets-model/Cowboy_Female.glb');
