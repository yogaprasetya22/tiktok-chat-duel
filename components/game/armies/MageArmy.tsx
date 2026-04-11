'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { SkeletonUtils } from 'three-stdlib';
import { useVFX } from '../VFXManager';
import { ActiveUnit, TowerConfig, SimulationSettings } from '../../../hooks/battle/types';
import { useStore } from '../../../hooks/useStore';
import { SpellEntry, SpellsRegistryRef } from '../MageSpellEffect';
import { ENEMY_BASE_Z, PLAYER_BASE_Z, WEATHER_CONFIG } from "../../../hooks/battle/constants";

interface MageArmyProps {
  unitsMap: React.RefObject<Map<string, any>>;
  towerConfig: TowerConfig;
  settingsRef: React.RefObject<SimulationSettings>;
  spellsRef: SpellsRegistryRef;
  simTimeRef: React.RefObject<number>;
  vehicles: React.RefObject<Map<string, any>>;
  unitIndex: React.RefObject<Map<string, any>>;
  renderedIdsRef: React.RefObject<Set<string>>;
}

const POOL_SIZE = 8;

export function MageArmy({ unitsMap, towerConfig, settingsRef, spellsRef, simTimeRef, vehicles, unitIndex, renderedIdsRef }: MageArmyProps) {
  const poolMapRef = useRef<Map<string, number>>(new Map());
  const availableIndicesRef = useRef<number[]>([]);
  const activeSetRef = useRef<Set<string>>(new Set());
  const frameCountRef = useRef(0);
  const prevStatusRef = useRef<Map<string, string>>(new Map());
  const { spawnVFX } = useVFX();
  const lastVFXRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    availableIndicesRef.current = Array.from({ length: POOL_SIZE }, (_, i) => i);
  }, []);

  const mage1 = useGLTF('/assets-model/Witch.glb') as any;
  const mage2 = useGLTF('/assets-model/Wizard.glb') as any;

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
            if (name.includes('cloth') || name.includes('robe') || name.includes('hat') || name.includes('cape') || name.includes('trim')) {
               // PERF: Only clone material for colorable meshes — shared materials for everything else
               if (child.material) child.material = child.material.clone();
               colorable.push(child);
            }
          }
        });
        items.push({ group: clone, colorable, mixer, actions, currentAnim: '', lastUpdate: 0, rotation: 0, initialized: false });
    }
    return items;
  }, [mage1, mage2]);

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

    // PERF: Cache weather speed multiplier ONCE per frame
    const weather = storeState.weather;
    const wConfig = WEATHER_CONFIG[weather];
    const wMults = (wConfig as any).multipliers || {};
    const mageMults = wMults['mage'] || {};
    const cachedWeatherSpeedMult = (mageMults.move_speed_mult || 1.0) * (wMults.globalSpeedMultiplier || 1.0);

    // Filter units of this class
    const myUnits: any[] = [];
    rawMap.forEach((u: any, id: string) => {
        if (!u || u.hp <= 0 || u.unitClass !== 'mage') return;
        u.id = id;
        myUnits.push(u);
    });

    // --- 1. BRAIN LOOP: Process ALL units of this class for AI/Steering ---
    myUnits.forEach((u) => {
        const id = u.id;
        const uData = rawMap.get(id);
        if (!uData) return;

        // Targeting (Throttled)
        if (frameCountRef.current % 10 === 0 || !u.targetId) {
            let bestDistSq = uData.perceptionRadiusSq || 3600; 
            let bestTargetId = undefined;
            rawMap.forEach((potential, pid) => {
                if (pid === id || potential.hp <= 0 || potential.isDying) return;
                if (potential.type === u.type) return;
                if (mode === 'TRAINING' && u.type === 'player' && potential.userName !== 'Training') return;
                const dx = uData.position[0] - potential.position[0];
                const dz = uData.position[2] - potential.position[2];
                const dSq = dx * dx + dz * dz;
                const perceptionRadiusSq = uData.perceptionRadiusSq || 2025;
                const chaseRangeSq = (uData.chaseRange || 60) * (uData.chaseRange || 60);
                const switchThreshold = pid === u.targetId ? 1.0 : 0.5;
                if (dSq < perceptionRadiusSq && dSq < bestDistSq * switchThreshold && dSq < chaseRangeSq) {
                    bestDistSq = dSq;
                    bestTargetId = pid;
                }
            });
            u.targetId = bestTargetId;
            const coreUnit = unitIndex?.current?.get(id);
            if (coreUnit) coreUnit.targetId = bestTargetId;
        }

        // VFX & Spark Logic (Ensure launch effects always show)
        const currentAtk = u.lastAttackTime || 0;
        const prevAtk = lastVFXRef.current.get(id) || 0;
        if (currentAtk > prevAtk) {
             const launchY = uData.position[1] + 1.8;
             spawnVFX([uData.position[0], launchY, uData.position[2]], 'spark', u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color);
             lastVFXRef.current.set(id, currentAtk);
        }

        // Status
        if (u.targetId) {
            const target = rawMap.get(u.targetId);
            if (target) {
                const dx = uData.position[0] - target.position[0];
                const dz = uData.position[2] - target.position[2];
                const distSq = dx * dx + dz * dz;
                const rangeSq = (u.range || 12) * (u.range || 12);
                uData.status = distSq <= rangeSq ? 'attacking' : 'marching';
            } else {
                u.targetId = undefined;
            }
        } else {
            const baseZ = u.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z; 
            const distToBaseSq = Math.pow(uData.position[2] - baseZ, 2);
            uData.status = distToBaseSq < 225 ? 'attacking' : 'marching';
        }

        // Steering & Rotation
        const vehicle = vehicles?.current?.get(id);
        if (vehicle) {
            // PERF: Use frame-cached weather multiplier
            const weatherSpeedMult = cachedWeatherSpeedMult;

            let isChasing = false;
            let isKiting = false;

            // Chase Target with Steering
            if (u.targetId) {
                const target = rawMap.get(u.targetId);
                if (target) {
                    const dx = uData.position[0] - target.position[0];
                    const dz = uData.position[2] - target.position[2];
                    const distSq = dx * dx + dz * dz;
                    const kitingThresholdSq = 49; 
                    // PERF: Find SeekBehavior directly
                    const seekB = vehicle.steering.behaviors.find((b: any) => b.target !== undefined);
                    if (seekB) {
                        if (distSq < kitingThresholdSq) {
                            const safeDirZ = u.type === 'player' ? 1 : -1;
                            const retreatX = uData.position[0] + (uData.position[0] - target.position[0]) * 2;
                            const retreatZ = uData.position[2] + (uData.position[2] - target.position[2]) * 2 + (safeDirZ * 5);
                            seekB.target.set(retreatX, 0, retreatZ);
                            isKiting = true;
                        } else {
                            const totalVal = id.split('-').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
                            const angle = (totalVal % 360) * (Math.PI / 180);
                            const encRadius = 1.5; 
                            const offsetX = Math.cos(angle) * encRadius;
                            const offsetZ = Math.sin(angle) * encRadius;
                            seekB.target.set(target.position[0] + offsetX, 0, target.position[2] + offsetZ);
                        }
                        isChasing = true;
                    }
                }
            }

            if (!isChasing) {
                const seekB = vehicle.steering.behaviors.find((b: any) => b.target !== undefined);
                if (seekB) {
                    const baseZ = u.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
                    const amp = uData.laneSwaggerAmp || 0.5;
                    const swagger = Math.sin((id.length * 8) + (uData.jitterOffset || 0)) * amp;
                    seekB.target.set((uData.laneOffset || 0) + swagger, 0, baseZ);
                }
            }
            const baseSpeed = (u.speed || 3) * (settings.globalSpeedMultiplier || 1);
            vehicle.maxSpeed = (uData.status === 'attacking' || u.isDying) ? 0 : baseSpeed * weatherSpeedMult;
            
            // Rotation
            const velSq = vehicle.velocity.x ** 2 + vehicle.velocity.z ** 2;
            if (uData.status === 'marching' && velSq > 0.01) {
                uData.rotation[1] = Math.atan2(vehicle.velocity.x, vehicle.velocity.z);
            } else if (uData.status === 'attacking') {
                const baseZ = u.type === 'player' ? ENEMY_BASE_Z : PLAYER_BASE_Z;
                const tData = u.targetId ? rawMap.get(u.targetId) : null;
                const tx = tData ? tData.position[0] : 0;
                const tz = tData ? tData.position[2] : baseZ;
                const targetRot = Math.atan2(tx - uData.position[0], tz - uData.position[2]);
                uData.rotation[1] = THREE.MathUtils.lerp(uData.rotation[1], targetRot, settings.rotationSmoothing || 0.1);
            }
        }
    });

    // --- 2. ACTOR LOOP: Process POOL_SIZE units for rendering ---
    myUnits.sort((a, b) => {
        if (a.isBoss !== b.isBoss) return -1;
        return a.dSq - b.dSq;
    });
    const visibleUnits = myUnits.slice(0, POOL_SIZE);

    visibleUnits.forEach((u: any) => {
      const id = u.id;
      const uData = rawMap.get(id);
      if (!uData) return;
      _activeSet.add(id);
      renderedIdsRef.current.add(id);

      if (!poolMapRef.current.has(id)) {
        if (availableIndicesRef.current.length > 0) {
          const pIdx = availableIndicesRef.current.shift()!;
          poolMapRef.current.set(id, pIdx);
          const pItem = characterPool[pIdx];
          const teamColor = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
          pItem.colorable.forEach((mesh: THREE.Mesh) => {
              (mesh.material as THREE.MeshStandardMaterial).color.set(teamColor);
          });
        } else return;
      }

      const poolIdx = poolMapRef.current.get(id);
      if (poolIdx === undefined) return;
      const pItem = characterPool[poolIdx];
      pItem.group.visible = true;

      const baseScale = u.isBoss ? 4.0 : (1.3 + (u.level || 1) * 0.1);
      pItem.group.scale.setScalar(baseScale * settings.unitScale);

      let targetAnim = 'Idle';
      if (u.isDying) targetAnim = 'Death';
      else if (uData.status === 'marching') targetAnim = 'Run';
      else if (uData.status === 'attacking') {
        // Dynamic search for attack animation
        const attackKeywords = ['spell', 'cast', 'shoot', 'attack', 'slash'];
        let foundAttack = '';
        
        for (const kw of attackKeywords) {
          const matched = Object.keys(pItem.actions).find(name => name.toLowerCase().includes(kw));
          if (matched) {
            foundAttack = matched;
            break;
          }
        }
        
        targetAnim = foundAttack || 'Idle';
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
      if (!pItem.initialized) {
        cp.set(tp[0], tp[1], tp[2]);
        pItem.rotation = uData.rotation[1];
        pItem.group.rotation.y = pItem.rotation;
        pItem.initialized = true;
      } else {
        cp.x += (tp[0]-cp.x)*0.25; cp.y += (tp[1]-cp.y)*0.25; cp.z += (tp[2]-cp.z)*0.25;
        let diff = uData.rotation[1] - pItem.rotation;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        pItem.rotation += diff * 0.15;
        pItem.group.rotation.y = pItem.rotation;
      }

      const sf = u.dSq > 3600 ? 5 : u.dSq > 400 ? 2 : 1;
      if (time - pItem.lastUpdate >= 0.016 * sf) {
        pItem.mixer.update(delta * sf);
        pItem.lastUpdate = time;
      }
    }); // end visibleUnits.forEach (Removed redundant Engine-handled spell launch)

    poolMapRef.current.forEach((poolIdx, unitId) => {
      if (!_activeSet.has(unitId)) {
        const pItem = characterPool[poolIdx];
        if (pItem) pItem.group.visible = false;
        availableIndicesRef.current.push(poolIdx);
        poolMapRef.current.delete(unitId);
      }
    });
  });

  return (
    <group>
      {characterPool.map((item, idx) => ( <primitive key={"pool-mage-" + idx} object={item.group} /> ))}
    </group>
  );
}

useGLTF.preload('/assets-model/Witch.glb');
useGLTF.preload('/assets-model/Wizard.glb');
