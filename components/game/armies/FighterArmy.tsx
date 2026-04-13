'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { MeshoptDecoder } from 'meshoptimizer';
import { SkeletonUtils } from 'three-stdlib';
import { useVFX } from '../VFXManager';
import { ActiveUnit, TowerConfig, SimulationSettings, UnitRuntimeData } from '../../../hooks/battle/types';
import { useStore } from '../../../hooks/useStore';
import { ENEMY_BASE_Z, PLAYER_BASE_Z, WEATHER_CONFIG } from '../../../hooks/battle/constants';
import { lerpAngle } from '../../../hooks/battle/battleUtils';
import * as YUKA from 'yuka';
import { applyPainterlyStyle } from '../effects/PainterlyMaterials';


interface FighterArmyProps {
  unitsMap: React.RefObject<UnitRuntimeData[]>;
  towerConfig: TowerConfig;
  settingsRef: React.RefObject<SimulationSettings>;
  simTimeRef: React.RefObject<number>;
  vehicles: React.RefObject<YUKA.Vehicle[]>;
  unitIndex: React.RefObject<Map<string, ActiveUnit>>;
  renderedIdsRef: React.RefObject<Set<string>>;
  shadowRef: React.RefObject<THREE.InstancedMesh>;
  healthBgRef: React.RefObject<THREE.InstancedMesh>;
  healthFillRef: React.RefObject<THREE.InstancedMesh>;
  notchRef: React.RefObject<THREE.InstancedMesh>;
  // Global HUD base index for this class to prevent slot overlap
  hudBaseIdx: number;
  namePoolMap: React.MutableRefObject<Map<string, number>>;
  nameTextRefs: React.RefObject<any[]>;
  fighterSpellsRef: React.RefObject<any[]>;
}

const POOL_SIZE = 120; // Ultimate Warfare Capacity

const _hudTemp = new THREE.Object3D();
const _healthColor = new THREE.Color();
const _whiteColor = new THREE.Color('#ffffff');

const FighterArmyComponent = ({
  unitsMap, towerConfig, settingsRef, simTimeRef, vehicles, unitIndex,
  renderedIdsRef, shadowRef, healthBgRef, healthFillRef, notchRef, hudBaseIdx,
  namePoolMap, nameTextRefs, fighterSpellsRef
}: FighterArmyProps) => {
  const poolMapRef = useRef<Map<string, number>>(new Map());
  const availableIndicesRef = useRef<number[]>([]);
  const activeSetRef = useRef<Set<string>>(new Set());
  const lastVFXRef = useRef<Map<string, number>>(new Map());
  const frameCountRef = useRef(0);
  const { spawnVFX } = useVFX();

  useEffect(() => {
    availableIndicesRef.current = Array.from({ length: POOL_SIZE }, (_, i) => i);
  }, []);

  const f1 = useGLTF('/assets-model/Knight_Golden_Female.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }) as any;
  const f2 = useGLTF('/assets-model/Knight_Golden_Male.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }) as any;
  const f3 = useGLTF('/assets-model/Knight_Male.glb', true, true, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  }) as any;

  const characterPool = useMemo(() => {
    const items: any[] = [];
    if (!f1.scene || !f2.scene || !f3.scene) return [];
    const availableAssets = [f1, f2, f3];

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
          const isColorable = name.includes('cape') || name.includes('cloth') || name.includes('trim') || name.includes('helmet') || name.includes('shoulder') || name.includes('robe') || name.includes('cloak') || name.includes('primary') || name.includes('team');
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
  }, [f1, f2, f3]);

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

    // PERF: Cache weather speed multiplier ONCE per frame, not per-unit
    const weather = storeState.weather;
    const wConfig = WEATHER_CONFIG[weather];
    const wMults = (wConfig as any).multipliers || {};
    const fighterMults = wMults['fighter'] || {};
    const cachedWeatherSpeedMult = (fighterMults.move_speed_mult || 1.0) * (wMults.globalSpeedMultiplier || 1.0);

    // Filter and SORT units by distance to prioritize close units for the 3D pool
    const myUnits: UnitRuntimeData[] = [];
    for (let i = 0; i < rawMap.length; i++) {
      const u = rawMap[i];
      if (!u.isActive || u.hp <= 0 || u.unitClass !== 'fighter') continue;
      myUnits.push(u);
    }
    myUnits.sort((a, b) => (a.dSq || 0) - (b.dSq || 0));

    // --- 1. BRAIN LOOP: Process ALL units of this class for AI/Steering ---
    for (let i = 0; i < myUnits.length; i++) {
      const uData = myUnits[i];
      const id = uData.id;

      // Targeting (Throttled & Sticky)
      if (frameCountRef.current % 10 === 0 || !uData.targetId) {
        let bestScore = -Infinity;
        let bestTargetId = undefined;
        const STICKY_MULT = 0.75; // 25% advantage for current target

        // --- INITIAL SCORE ---
        bestScore = -Infinity;
        bestTargetId = undefined;

        for (let j = 0; j < rawMap.length; j++) {
          const potential = rawMap[j];
          if (!potential.isActive || potential.hp <= 0 || potential.isDying) continue;
          if (potential.id === id) continue;
          if (potential.type === uData.type) continue;
          if (mode === 'TRAINING' && uData.type === 'player' && potential.userName !== 'Training') continue;

          const dx = uData.position[0] - potential.position[0];
          const dz = uData.position[2] - potential.position[2];
          const dSq = dx * dx + dz * dz;

          const perceptionSq = uData.perceptionRadiusSq || 3600;
          const chaseRangeSq = (mode === 'TRAINING' ? 1000000 : (uData.chaseRange || 60) * (uData.chaseRange || 60));

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
        const isBase = uData.targetId === 'player-base' || uData.targetId === 'enemy-base';
        if (isBase) {
          const baseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
          const distSq = uData.position[0] * uData.position[0] + Math.pow(uData.position[2] - baseZ, 2);
          const rangeSq = (uData.range || 2) * (uData.range || 2);
          uData.status = distSq <= rangeSq ? 'attacking' : 'marching';
        } else {
          const tIdx = parseInt(uData.targetId.split('-')[1]);
          const target = rawMap[tIdx];
          if (target && target.isActive && target.id === uData.targetId) {
            const dx = uData.position[0] - target.position[0];
            const dz = uData.position[2] - target.position[2];
            const distSq = dx * dx + dz * dz;
            const rangeSq = (uData.range || 2.5) * (uData.range || 2.5);
            uData.status = distSq <= rangeSq ? 'attacking' : 'marching';
          } else {
            uData.targetId = undefined;
          }
        }
      } else {
        const baseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
        const distToBaseSq = Math.pow(uData.position[2] - baseZ, 2);
        uData.status = distToBaseSq < 9 ? 'attacking' : 'marching';
      }

      // VFX (Melee Slashes)
      const currentAtk = uData.lastAttackTime || 0;
      const prevAtk = lastVFXRef.current.get(id) || 0;
      if (currentAtk > prevAtk) {
        const forwardX = Math.sin(uData.rotation[1]) * 1.5;
        const forwardZ = Math.cos(uData.rotation[1]) * 1.5;
        spawnVFX([uData.position[0] + forwardX, 1.2, uData.position[2] + forwardZ], 'slash', '#ffffff');

        // Trigger Slash Trail effect
        if (fighterSpellsRef.current) {
          const spells = fighterSpellsRef.current;
          const sIdx = spells.findIndex(s => !s.active);
          if (sIdx !== -1) {
            spells[sIdx].x = uData.position[0] + forwardX;
            spells[sIdx].y = 1.0;
            spells[sIdx].z = uData.position[2] + forwardZ;
            spells[sIdx].rotation = uData.rotation[1];
            spells[sIdx].startTime = simTimeRef.current || 0;
            spells[sIdx].color = uData.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
            spells[sIdx].active = true;
            spells[sIdx].progress = 0;
          }
        }

        lastVFXRef.current.set(id, currentAtk);
      }

      // Steering & Rotation
      const vehicleIdx = parseInt(id.split('-')[1]);
      const vehicle = vehicles?.current?.[vehicleIdx];
      if (vehicle) {
        let isChasing = false;

        // PERF: Use frame-cached weather multiplier
        const weatherSpeedMult = cachedWeatherSpeedMult;

        // Chase Target with Encirclement Offset
        if (uData.targetId) {
          const tIdx = parseInt(uData.targetId.split('-')[1]);
          const target = rawMap[tIdx];
          if (target && target.isActive && target.id === uData.targetId) {
            // PERF: Find SeekBehavior directly instead of forEach
            const seekB = (vehicle.steering.behaviors as any).find((b: any) => b.target !== undefined);
            if (seekB) {
              const totalVal = id.split('-').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
              const angle = (totalVal % 360) * (Math.PI / 180);
              const orbitRadius = uData.encirclementRadius || 1.25;
              const offsetX = Math.cos(angle) * orbitRadius;
              const offsetZ = Math.sin(angle) * orbitRadius;
              seekB.target.set(target.position[0] + offsetX, 0, target.position[2] + offsetZ);
              isChasing = true;
            }
          }
        }

        if (!isChasing) {
          // PERF: Find SeekBehavior directly
          const seekB = (vehicle.steering.behaviors as any).find((b: any) => b.target !== undefined);
          if (seekB) {
            const baseZ = uData.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
            const amp = uData.laneSwaggerAmp || 0.5;
            const swagger = Math.sin((id.length * 8) + (uData.jitterOffset || 0)) * amp;
            seekB.target.set((uData.laneOffset || 0) + swagger, 0, baseZ);
          }
        }
        // PERF: Velocity based rotation logic
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

    // --- 2. ACTOR LOOP: Process POOL_SIZE units for rendering ---
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

      const baseScale = uData.isBoss ? 4.5 : (1.4 + (uData.level || 1) * 0.1);
      pItem.group.scale.setScalar(baseScale * settings.unitScale);

      let targetAnim = 'Idle';
      if (uData.isDying) targetAnim = 'Death';
      else if (uData.status === 'marching') targetAnim = 'Run';
      else if (uData.status === 'attacking') {
        targetAnim = pItem.actions['SwordSlash'] ? 'SwordSlash' : (pItem.actions['Attack'] ? 'Attack' : 'Idle');
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
      
      // Interpolation: Snap if jump is too large (Lag resilience)
      const distSq = (tp[0]-cp.x)**2 + (tp[2]-cp.z)**2;

      const lerpFactor = 1.0 - Math.exp(-45 * delta); // Snappier smoothing
      if (!pItem.initialized || distSq > 25) { // Snap if > 5m
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
      // We manually update world matrix to ensure sibling elements (HUD) match the character exactly
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

    // Optimized Shader Uniform Update: Only update uniforms for units currently "on-duty"
    poolMapRef.current.forEach((poolIdx) => {
      const item = characterPool[poolIdx];
      if (!item) return;
      const timeVal = (simTimeRef.current || 0) * 0.001;
      item.colorable.forEach((mesh: THREE.Mesh) => {
        const mat = mesh.material as THREE.Material;
        if (mat.userData.painterlyShader) {
          mat.userData.painterlyShader.uniforms.time.value = timeVal;
        }
      });
    });
  });



  return (
    <group>
      {characterPool.map((item, idx) => (<primitive key={"pool-fighter-" + idx} object={item.group} />))}
    </group>
  );
};

export const FighterArmy = React.memo(FighterArmyComponent);

useGLTF.preload('/assets-model/Knight_Golden_Female.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
useGLTF.preload('/assets-model/Knight_Golden_Male.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
useGLTF.preload('/assets-model/Knight_Male.glb', true, true, (loader) => {
  loader.setMeshoptDecoder(MeshoptDecoder);
});
