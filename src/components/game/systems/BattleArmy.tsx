'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
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
import { InstancedNameTagSystem } from './effects/InstancedNameTagSystem';

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

const tempObject = new THREE.Object3D();
const _hideObj = new THREE.Object3D();
_hideObj.position.set(0, -100, 0);
_hideObj.scale.set(0, 0, 0);
_hideObj.updateMatrix();
const _hideMatrix = _hideObj.matrix.clone();
const _frustum = new THREE.Frustum();
const _projMatrix = new THREE.Matrix4();

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
      
      float borderWidth = 0.015;
      float borderHeight = 0.08;
      bool isBorder = vUv.x < borderWidth || vUv.x > 1.0 - borderWidth || vUv.y < borderHeight || vUv.y > 1.0 - borderHeight;
      if (isBorder) {
          gl_FragColor = vec4(0.05, 0.05, 0.05, 0.9);
          return;
      }
      
      float totalSmallSegments = maxHp / 250.0;
      float smallNotchStep = 1.0 / totalSmallSegments;
      float smallNotch = mod(vUv.x, smallNotchStep);
      
      float thickNotchStep = 1.0 / (maxHp / 1000.0);
      float thickNotch = mod(vUv.x, thickNotchStep);
      
      bool isThickNotch = thickNotch < 0.015 && maxHp > 1001.0 && vUv.x > 0.02 && vUv.x < 0.98;
      bool isSmallNotch = smallNotch < 0.01 && vUv.x > 0.02 && vUv.x < 0.98;
      
      if (isThickNotch) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.95);
          return;
      }
      if (isSmallNotch) {
          gl_FragColor = vec4(0.0, 0.0, 0.0, 0.6);
          return;
      }
      
      if (vUv.x <= pct) {
          gl_FragColor = vec4(vColor, 1.0);
      } else {
          gl_FragColor = vec4(0.1, 0.1, 0.1, 0.75);
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
  const renderedIdsRef = useRef<Set<string>>(new Set());

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
    const healthInfoArray = new Float32Array(1500 * 2);
    for(let i=0; i<1500; i++) {
        healthInfoArray[i*2] = 250;
        healthInfoArray[i*2+1] = 250;
    }
    const attr = new THREE.InstancedBufferAttribute(healthInfoArray, 2);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aHealthInfo', attr);
    return geo;
  }, []);
  const shadowGeo = useMemo(() => new THREE.CircleGeometry(0.6, 12), []);
  const shadowMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.3, depthWrite: false }), []);
  const healthBarMat = useMemo(() => new THREE.ShaderMaterial({ 
      ...MLHealthBarShader, 
      transparent: true, 
      depthWrite: false,
      vertexColors: true,
      defines: { USE_INSTANCING: '', USE_INSTANCING_COLOR: '' }
  }), []);

  const frameCountRef = useRef(0);
  
  useFrame((state, delta) => {
    // 0. Clear rendering tracking for this frame - RUNS FIRST
    renderedIdsRef.current.clear();

    _projMatrix.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projMatrix);
    (state as any).battleFrustum = _frustum;

    updateSimulation(delta);

    const rawMap = unitRegistry.current;
    if (!rawMap) return;

    const camPos = state.camera.position;
    frameCountRef.current++;

    if (frameCountRef.current % 5 === 0) {
      const activeUnits: any[] = [];
      const buckets: Record<string, UnitRuntimeData[]> = { fighter: [], tank: [], mage: [], marksman: [], assassin: [] };
      
      const indices = compBuffers?.activeIndices?.current || [];
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
      
      for (const key in buckets) {
        buckets[key].sort((a, b) => (a.dSq || 0) - (b.dSq || 0));
      }

      (state as any).unitBuckets = buckets; 
    }

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

    if (shadowRef.current) shadowRef.current.instanceMatrix.needsUpdate = true;
    if (healthBarRef.current) {
      healthBarRef.current.instanceMatrix.needsUpdate = true;
      if (healthBarRef.current.instanceColor) healthBarRef.current.instanceColor.needsUpdate = true;
      const attr = healthBarRef.current.geometry.getAttribute('aHealthInfo');
      if (attr) attr.needsUpdate = true;
    }
  }, 1);

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
      />
      <InstancedImpostorRenderer
        unitRegistry={unitRegistry}
        renderedIdsRef={renderedIdsRef}
        playerColor={towerConfig.player.color}
        enemyColor={towerConfig.enemy.color}
        settingsRef={settingsRef}
        activeIndices={compBuffers?.activeIndices?.current}
      />
      <MageSpellEffect spellsRef={spellsRef} unitRegistry={unitRegistry} simTimeRef={simTimeRef} />
      <MMSpellEffect spellsRef={mmSpellsRef} unitRegistry={unitRegistry} simTimeRef={simTimeRef} />
      <FighterSpellEffect fighterSpellsRef={fighterSpellsRef} simTimeRef={simTimeRef} />
      <TankSpellEffect tankSpellsRef={tankSpellsRef} simTimeRef={simTimeRef} />
      <AssassinSpellEffect assassinSpellsRef={assassinSpellsRef} simTimeRef={simTimeRef} />
      <instancedMesh ref={shadowRef} args={[null as any, null as any, 1500]} geometry={shadowGeo} material={shadowMat} frustumCulled={false} />
      <instancedMesh ref={healthBarRef} args={[null as any, null as any, 1500]} geometry={healthGeo} material={healthBarMat} renderOrder={7} frustumCulled={false} />
      <InstancedNameTagSystem unitRegistry={unitRegistry} />
    </group>
  );
};

export const BattleArmy = React.memo(BattleArmyComponent);
