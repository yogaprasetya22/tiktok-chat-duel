'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { useVFX } from './VFXManager';
import { ActiveUnit, TowerConfig, SimulationSettings, UnitRuntimeData } from '@/src/core/domain/unit.types';
import * as YUKA from 'yuka';
import { useStore } from "@/src/state/useStore";
import { FighterSpellEffect } from './effects/FighterSpellEffect';
import { TankSpellEffect } from './effects/TankSpellEffect';
import { AssassinSpellEffect } from './effects/AssassinSpellEffect';
import { ECSArmyRenderer } from './armies/ECSArmyRenderer';
import { InstancedImpostorRenderer } from './armies/InstancedImpostorRenderer';
import { MageSpellEffect, SpellEntry } from './effects/MageSpellEffect';
import { MMSpellEffect } from './effects/MMSpellEffect';
import { ShieldEffect } from './effects/ShieldEffect';
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
const NAME_POOL_SIZE = 120;
const TEST_IMAGE_URL = 'https://t3.ftcdn.net/jpg/13/11/22/86/360_F_1311228699_YoiLc5aJ3RWz3uRfdEtlV0UYSQjqf7RW.jpg';

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');
const textureCache = new Map<string, { tex: THREE.Texture, lastUsed: number }>();
const textureLoading = new Set<string>();

const tempObject = new THREE.Object3D();

// Pre-computed hide matrix — avoids recomputing position+scale+updateMatrix per cleanup slot
const _hideObj = new THREE.Object3D();
_hideObj.position.set(0, -100, 0);
_hideObj.scale.set(0, 0, 0);
_hideObj.updateMatrix();
const _hideMatrix = _hideObj.matrix.clone();
const _vec = new THREE.Vector3();
const _projMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _col = new THREE.Color();



const RARITY_COLORS: Record<string, string> = {
  common: '#E2E8F0',    // Bright Slate
  elite: '#3B82F6',     // Epic Blue
  epic: '#A855F7',      // Mythic Purple
  legendary: '#FBBF24', // Legendary Gold
};
const getRarityColor = (rarity?: string): string => RARITY_COLORS[rarity || 'common'] ?? '#E2E8F0';

const RARITY_BADGES: Record<string, string> = {
  common: '',
  elite: '✦ ',
  epic: '★ ',
  legendary: '👑 ',
};
const getRarityBadge = (rarity?: string): string => RARITY_BADGES[rarity || 'common'] ?? '';



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
      if (d > 1.0) discard;
      
      // Ultra cheap linear fade for massive fill-rate savings
      float alpha = (1.0 - d) * 0.4;
      
      // Fast single mix: 40% team color aura, 60% black core shadow
      vec3 finalCol = mix(vColor, vec3(0.02), 0.6);
      
      gl_FragColor = vec4(finalCol, alpha);
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

const RadialCooldownShader = {
  vertexShader: `
    attribute float aProgress;
    varying vec2 vUv;
    varying float vProgress;
    #ifndef USE_INSTANCING_COLOR
      attribute vec3 instanceColor;
    #endif
    varying vec3 vColor;
    
    void main() {
      vUv = uv;
      vProgress = aProgress;
      vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vProgress;
    varying vec3 vColor;
    void main() {
      vec2 uv = vUv - 0.5;
      float dist = length(uv);
      
      // Ring shape
      float inner = 0.38;
      float outer = 0.5;
      if (dist > outer || dist < inner) discard;

      // Radial Fill (Clockwise from Top)
      float angle = atan(uv.x, uv.y); // Range -PI to PI. Top is 0.
      if (angle < 0.0) angle += 6.283185;
      
      float normAngle = angle / 6.283185;
      
      // If progress is 1.0 (ready), show full ring. If 0.0, show nothing.
      if (normAngle > vProgress) discard;

      // Glow effect based on proximity to center of ring thickness
      float glow = 1.0 - abs(dist - (inner + outer) * 0.5) / (outer - inner);
      
      // Team Color Sync (vColor) + Readiness White Glow
      vec3 color = mix(vColor, vec3(1.0), vProgress * 0.5);
      
      gl_FragColor = vec4(color * (1.2 + glow), 0.8 * glow);
    }
  `
};

const ProfileImageShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      float d = distance(vUv, vec2(0.5));
      if (d > 0.5) discard;
      
      // Simple anti-aliasing for the circular edge
      float alpha = smoothstep(0.5, 0.48, d);
      
      vec4 tex = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(tex.rgb, tex.a * alpha);
    }
  `
};

const BattleArmyComponent = ({
  unitRegistry, towerConfig, updateSimulation, settingsRef, simTimeRef,
  unitIndex, spellsRef, mmSpellsRef, fighterSpellsRef,
  tankSpellsRef, assassinSpellsRef, vfxRef, compBuffers
}: BattleArmyProps) => {
  const shadowRef = useRef<THREE.InstancedMesh>(null!);
  const healthBarRef = useRef<THREE.InstancedMesh>(null!);
  const cooldownRef = useRef<THREE.InstancedMesh>(null!);

  const { spawnVFX } = useVFX();

  // Shared ref: each army class adds its rendered unit indices (poolIdx) here each frame.
  // The InstancedImpostorRenderer reads this to skip already-rendered units.
  const renderedIdsRef = useRef<Set<number>>(new Set());

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
        cooldownRef.current?.setMatrixAt(i, tempObject.matrix);
      }
      shadowRef.current.instanceMatrix.needsUpdate = true;
      if (healthBarRef.current) healthBarRef.current.instanceMatrix.needsUpdate = true;
      if (cooldownRef.current) cooldownRef.current.instanceMatrix.needsUpdate = true;
    }
  }, []);

  const healthGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1.2, 0.18);
    const healthInfoArray = new Float32Array(MAX_UNITS * 2);
    for (let i = 0; i < MAX_UNITS; i++) {
      healthInfoArray[i * 2] = 250;
      healthInfoArray[i * 2 + 1] = 250;
    }
    const attr = new THREE.InstancedBufferAttribute(healthInfoArray, 2);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aHealthInfo', attr);
    return geo;
  }, []);
  const shadowGeo = useMemo(() => {
    const geo = new THREE.CircleGeometry(0.6, 6); // Hexagon provides 50% vertex reduction and looks completely fine for soft shadows
    geo.rotateX(-Math.PI / 2); // Pre-rotate on CPU once to save 1,500 rotation matrix calculations per frame
    return geo;
  }, []);
  const cooldownGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const progressArray = new Float32Array(1500);
    const attr = new THREE.InstancedBufferAttribute(progressArray, 1);
    attr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aProgress', attr);
    return geo;
  }, []);
  const cooldownMat = useMemo(() => new THREE.ShaderMaterial({
    ...RadialCooldownShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    defines: { USE_INSTANCING: '', USE_INSTANCING_COLOR: '' }
  }), []);

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


  const namePoolMap = useRef<Map<string, number>>(new Map());
  const nameAvailableSlots = useRef<number[]>(Array.from({ length: NAME_POOL_SIZE }, (_, i) => i));
  const nameGroupRefs = useRef<(THREE.Group | null)[]>(Array(NAME_POOL_SIZE).fill(null));
  const nameTextRefs = useRef<(any | null)[]>(Array(NAME_POOL_SIZE).fill(null));
  const nameImageRefs = useRef<(THREE.Mesh | null)[]>(Array(NAME_POOL_SIZE).fill(null));
  const nameImageMaterials = useRef<(THREE.ShaderMaterial | null)[]>(Array(NAME_POOL_SIZE).fill(null));
  const nameBorderRefs = useRef<(THREE.Mesh | null)[]>(Array(NAME_POOL_SIZE).fill(null));
  const nameSlotContent = useRef<string[]>(Array(NAME_POOL_SIZE).fill(''));
  const nameSlotColor = useRef<string[]>(Array(NAME_POOL_SIZE).fill('#ffffff'));
  const nameSlotImage = useRef<string[]>(Array(NAME_POOL_SIZE).fill(''));


  const lastNameCullTime = useRef(0);
  const cachedActiveUnits = useRef<any[]>([]);
  const frameCountRef = useRef(0);
  const hudDirtyRef = useRef(true); // FIX: Track if HUD needs GPU upload
  useFrame((state, delta) => {
    // 0. Update Frustum for class animators
    _projMatrix.multiplyMatrices(state.camera.projectionMatrix, state.camera.matrixWorldInverse);
    _frustum.setFromProjectionMatrix(_projMatrix);
    (state as any).battleFrustum = _frustum;

    // Optimized Simulation Step
    updateSimulation(delta);

    const rawMap = unitRegistry.current;
    if (!rawMap) return;

    const time = state.clock.elapsedTime;
    const camPos = state.camera.position;
    frameCountRef.current++;

    // PERFORMANCE: Use consistent constants at the top
    const HUD_DETAIL_DIST_SQ = 4900; // 70 * 70
    const HUD_MAX_RANGE_SQ = 7350; // 4900 * 1.5

    // PERFORMANCE: Throttle sorting and unit filtering to every 12 frames
    const shouldSort = frameCountRef.current % 12 === 0 || cachedActiveUnits.current.length === 0;

    const indices = compBuffers?.activeIndices?.current || [];
    for (let k = 0; k < indices.length; k++) {
      const i = indices[k];
      const u = rawMap[i];
      if (!u || !u.isActive || u.hp <= 0 || u.position[1] < -50) continue;
      const dx = camPos.x - u.position[0];
      const dz = camPos.z - u.position[2];
      u.dSq = dx * dx + dz * dz;
    }

    if (shouldSort) {
      // Zero-allocation bucket clearing using persistent state
      const b = (state as any)._persBuckets ||= { fighter: [], tank: [], mage: [], marksman: [], assassin: [] };
      b.fighter.length = 0; b.tank.length = 0; b.mage.length = 0; b.marksman.length = 0; b.assassin.length = 0;

      const nearUnits = (state as any)._persNearUnits ||= [];
      nearUnits.length = 0;

      for (let k = 0; k < indices.length; k++) {
        const i = indices[k];
        const u = rawMap[i];
        if (!u || !u.isActive || u.hp <= 0 || u.position[1] < -50) continue;

        if (b[u.unitClass]) b[u.unitClass].push(u);
        if ((u.dSq || 0) < HUD_MAX_RANGE_SQ) {
          nearUnits.push(u);
        }
      }

      // Sort only units near the camera to save CPU
      nearUnits.sort((a: any, b: any) => {
        if (a.isBoss !== b.isBoss) return a.isBoss ? -1 : 1;
        return (a.dSq || 0) - (b.dSq || 0);
      });

      cachedActiveUnits.current = nearUnits;
      (state as any).unitBuckets = b;
    }

    const activeUnits = cachedActiveUnits.current;
    (state as any).sortedActiveUnits = activeUnits;
    const isPotato = !!settingsRef.current.potatoMode;
    const gameMode = (state as any)._cachedGameMode ||= useStore.getState().gameMode;
    const frustum = (state as any).battleFrustum as THREE.Frustum;

    if (isPotato) {
      if (frameCountRef.current % 15 === 0) {
        for (let i = 0; i < 1500; i++) {
          shadowRef.current?.setMatrixAt(i, _hideMatrix);
          healthBarRef.current?.setMatrixAt(i, _hideMatrix);
          cooldownRef.current?.setMatrixAt(i, _hideMatrix);
        }
        shadowRef.current.instanceMatrix.needsUpdate = true;
        if (healthBarRef.current) healthBarRef.current.instanceMatrix.needsUpdate = true;
      }
    }

    // ─── 2. Name Labels Lifecycle ─────────────────────────────────────────────

    // FIX B: Immediate cleanup tiap frame — jangan tunggu 4 frame
    // Cek kematian, jauh dari kamera, atau inactive langsung
    for (const [uid, slot] of namePoolMap.current.entries()) {
      const uIdx = unitIndex.current.get(uid);
      const u = uIdx ? rawMap[uIdx.poolIdx ?? -1] : null;

      const isDead = !u || !u.isActive || u.hp <= 0 || u.position[1] < -50;
      const isTooFar = (u?.dSq ?? 0) > HUD_DETAIL_DIST_SQ;

      if (isDead || isTooFar || isPotato) {
        const group = nameGroupRefs.current[slot];
        if (group) {
          group.visible = false;
          group.position.set(0, -200, 0);
        }
        if (nameTextRefs.current[slot]) nameTextRefs.current[slot].visible = false;
        if (nameImageRefs.current[slot]) nameImageRefs.current[slot].visible = false;
        if (nameBorderRefs.current[slot]) nameBorderRefs.current[slot].visible = false;
        nameAvailableSlots.current.push(slot);
        namePoolMap.current.delete(uid);
        nameSlotImage.current[slot] = '';
      }
    }

    if (frameCountRef.current % 4 === 0) {
      lastNameCullTime.current = time;

      // Assign slots ke unit baru yang dekat (dari yang paling dekat)
      if (!isPotato) {
        let updatesThisFrame = 0;
        const MAX_UPDATES_PER_FRAME = 2;

        const assignCount = Math.min(activeUnits.length, 60);
        for (let i = 0; i < assignCount; i++) {
          const u = activeUnits[i];
          const id = u.id;

          if (namePoolMap.current.has(id)) continue;
          if (namePoolMap.current.size >= NAME_POOL_SIZE || nameAvailableSlots.current.length === 0) break;

          // FRUSTUM CULLING: Jangan assign slot ke unit di balik kamera
          const pos = _vec.set(u.position[0], u.position[1] + 2, u.position[2]);
          if (frustum && !frustum.containsPoint(pos)) continue;
          if ((u.dSq || 0) > HUD_DETAIL_DIST_SQ) continue;

          const slot = nameAvailableSlots.current.shift()!;
          namePoolMap.current.set(id, slot);
          const mesh = nameTextRefs.current[slot];
          const group = nameGroupRefs.current[slot];

          if (mesh) {
            const badge = getRarityBadge(u.rarity);
            const label = badge + (u.userName || 'Guest');

            let needsSync = false;
            if (nameSlotContent.current[slot] !== label) {
              mesh.text = label;
              nameSlotContent.current[slot] = label;
              needsSync = true;
            }

            const rawCol = u.type === 'player' ? towerConfig.player.color : towerConfig.enemy.color;
            _col.set(rawCol).offsetHSL(0, 0, 0.2);
            const teamStyle = _col.getStyle();

            if (nameSlotColor.current[slot] !== teamStyle) {
              mesh.color = teamStyle;
              nameSlotColor.current[slot] = teamStyle;
              const borderMesh = nameBorderRefs.current[slot];
              if (borderMesh) {
                (borderMesh.material as THREE.MeshBasicMaterial).color.copy(_col);
                (borderMesh.material as THREE.MeshBasicMaterial).opacity = 1.0;
              }
              needsSync = true;
            }

            const targetFontSize = u.isBoss ? 1.0 : 0.45;
            if (mesh.fontSize !== targetFontSize) {
              mesh.fontSize = targetFontSize;
              needsSync = true;
            }

            mesh.outlineWidth = 0.08;
            mesh.outlineColor = "#000000";

            if (needsSync && updatesThisFrame < MAX_UPDATES_PER_FRAME) {
              mesh.sync();
              updatesThisFrame++;
            }
            mesh.visible = true;

            // Handle Profile Image
            const imgMesh = nameImageRefs.current[slot];
            if (imgMesh) {
              const imgUrl = (gameMode === "TRAINING" || !u.profileImage)
                ? TEST_IMAGE_URL
                : `/api/proxy-image?url=${encodeURIComponent(u.profileImage)}`;
              if (nameSlotImage.current[slot] !== imgUrl) {
                nameSlotImage.current[slot] = imgUrl;
                const mat = nameImageMaterials.current[slot];
                const now = Date.now();
                if (textureCache.has(imgUrl)) {
                  const entry = textureCache.get(imgUrl)!;
                  entry.lastUsed = now;
                  if (mat) mat.uniforms.tDiffuse.value = entry.tex;
                } else if (!textureLoading.has(imgUrl)) {
                  textureLoading.add(imgUrl);
                  textureLoader.load(imgUrl, (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    textureCache.set(imgUrl, { tex, lastUsed: Date.now() });
                    textureLoading.delete(imgUrl);
                    if (namePoolMap.current.get(id) === slot && mat) {
                      mat.uniforms.tDiffuse.value = tex;
                    }
                    if (textureCache.size > 80) {
                      let oldestKey = "";
                      let oldestTime = Infinity;
                      for (const [key, val] of textureCache.entries()) {
                        if (val.lastUsed < oldestTime) { oldestTime = val.lastUsed; oldestKey = key; }
                      }
                      if (oldestKey) { textureCache.get(oldestKey)?.tex.dispose(); textureCache.delete(oldestKey); }
                    }
                  }, undefined, () => { textureLoading.delete(imgUrl); });
                }
              }
              imgMesh.visible = true;
              imgMesh.scale.setScalar(u.isBoss ? 2.2 : 1.4);
            }

            // Handle Decorative Rarity Border
            const borderMesh = nameBorderRefs.current[slot];
            if (borderMesh) {
              const rCol = getRarityColor(u.rarity);
              (borderMesh.material as THREE.MeshBasicMaterial).color.set(rCol);
              let pulse = 1.0;
              if (u.rarity === 'legendary') pulse = 1.0 + Math.sin(time * 6) * 0.1;
              else if (u.rarity === 'epic') pulse = 1.0 + Math.sin(time * 4) * 0.05;
              borderMesh.scale.setScalar((u.isBoss ? 2.2 : 1.4) * 1.15 * pulse);
              borderMesh.visible = true;
            }

            if (group) {
              group.visible = true;
            }
          }
        }
      }
    }



    // 3. Signal Updates — Only upload GPU buffers when data actually changed
    hudDirtyRef.current = true; // Mark dirty on any frame with active units
    if (hudDirtyRef.current) {
      if (shadowRef.current) {
        shadowRef.current.instanceMatrix.needsUpdate = true;
        if (shadowRef.current.instanceColor) shadowRef.current.instanceColor.needsUpdate = true;
      }
      if (healthBarRef.current) {
        healthBarRef.current.instanceMatrix.needsUpdate = true;
        if (healthBarRef.current.instanceColor) healthBarRef.current.instanceColor.needsUpdate = true;
        const attr = healthBarRef.current.geometry.getAttribute('aHealthInfo');
        if (attr) attr.needsUpdate = true;
      }
      if (cooldownRef.current) {
        cooldownRef.current.instanceMatrix.needsUpdate = true;
        if (cooldownRef.current.instanceColor) cooldownRef.current.instanceColor.needsUpdate = true;
        const attr = cooldownRef.current.geometry.getAttribute('aProgress');
        if (attr) attr.needsUpdate = true;
      }
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
        cooldownRef={cooldownRef}
        namePoolMap={namePoolMap}
        nameGroupRefs={nameGroupRefs}
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

      {/* GLSL Combat Effects */}
      <ShieldEffect
        unitRegistry={unitRegistry}
        activeIndicesRef={compBuffers?.activeIndices}
        settingsRef={settingsRef}
        simTimeRef={simTimeRef}
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
      <instancedMesh ref={cooldownRef} args={[null as any, null as any, 1500]} geometry={cooldownGeo} material={cooldownMat} frustumCulled={false} />
      <instancedMesh ref={healthBarRef} args={[null as any, null as any, 1500]} geometry={healthGeo} material={healthBarMat} renderOrder={7} frustumCulled={false} />

      <group>
        {useMemo(() => Array.from({ length: NAME_POOL_SIZE }, (_, i) => (
          <group
            key={"name-slot-" + i}
            ref={(el) => { nameGroupRefs.current[i] = el; }}
            visible={false}
          >
            <Text
              ref={(el) => { nameTextRefs.current[i] = el; }}
              visible={false}
              fontSize={0.4}
              color="#ffffff"
              outlineWidth={0.06}
              outlineColor="#000000"
              anchorX="center"
              anchorY="middle"
              renderOrder={100}
              depthOffset={-10}
            >
              {' '}
            </Text>
            <mesh
              ref={(el) => { nameImageRefs.current[i] = el; }}
              visible={false}
              position={[0, 1.25, 0]}
              renderOrder={102}
            >
              <planeGeometry args={[0.7, 0.7]} />
              <shaderMaterial
                ref={(el) => { nameImageMaterials.current[i] = el; }}
                vertexShader={ProfileImageShader.vertexShader}
                fragmentShader={ProfileImageShader.fragmentShader}
                uniforms={{
                  tDiffuse: { value: null }
                }}
                transparent={true}
                depthWrite={false}
              />
            </mesh>
            <mesh
              ref={(el) => { nameBorderRefs.current[i] = el; }}
              visible={false}
              position={[0, 1.25, -0.01]}
              renderOrder={101}
            >
              <circleGeometry args={[0.38, 12]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={0.8} />
            </mesh>
          </group>
        )), [])}
      </group>
    </group>
  );
};

export const BattleArmy = React.memo(BattleArmyComponent);
