'use client';
/**
 * MageSpellEffect – GLSL instanced magic projectile system.
 * Renders high-impact energy fireballs with pulsing cores and trails.
 */

import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVFX } from './VFXManager';
import { useStore } from '../../hooks/useStore';
import { MAGE_PROJECTILE_TIME_MS } from '../../hooks/battle/constants';
import gsap from 'gsap';

// ─── Shared types ─────────────────────────────────────────────────────────────
export interface SpellEntry {
  fromX: number; fromY: number; fromZ: number;
  toX: number;   toY: number;   toZ: number;
  progress: number;  
  startTime: number; 
  active: boolean;
  color?: string;
  targetId?: string;
  targetPrevX?: number;
  targetPrevZ?: number;
}

export type SpellsRegistryRef = React.RefObject<SpellEntry[]>;

// ─── GLSL Shaders ─────────────────────────────────────────────────────────────
const FireballShader = {
    uniforms: {
        time: { value: 0 },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        varying vec3 vWorldPosition;
        
        void main() {
            vUv = uv;
            vColor = instanceColor;
            
            vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            
            gl_Position = projectionMatrix * modelViewMatrix * worldPosition;
        }

    `,
    fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vColor;
        varying vec3 vWorldPosition;
        
        void main() {
            // Distance from center of sphere
            float d = distance(vUv, vec2(0.5));
            
            // Core bloom (bright center)
            float core = 1.0 - smoothstep(0.0, 0.4, d);
            
            // Outer flicker using time
            float flicker = sin(time * 20.0 + vWorldPosition.x * 10.0 + vWorldPosition.z * 10.0) * 0.1 + 0.9;
            float outer = (1.0 - smoothstep(0.3, 0.5, d)) * flicker;
            
            // Colors
            vec3 coreColor = vec3(1.0, 1.0, 1.0);
            vec3 outerColor = vColor;
            
            // Mixing based on radial distance
            vec3 finalColor = mix(outerColor, coreColor, core * 0.8);
            
            // Add a bit of "fire" energy modulation
            float intensity = 2.5 + sin(time * 15.0) * 0.5;
            vec3 emissive = finalColor * intensity * max(outer, core);
            
            // Soft edges
            float alpha = smoothstep(0.5, 0.0, d) * max(outer, core) * 2.0;
            
            gl_FragColor = vec4(emissive, alpha);
            
            if (gl_FragColor.a < 0.1) discard;
        }

    `
};

// ─── Component ────────────────────────────────────────────────────────────────
const MAX_SPELLS = 1800; // 300 spells * 6 segments


interface Props {
  spellsRef: SpellsRegistryRef;
  unitRegistry: React.RefObject<Map<string, any>>;
  simTimeRef: React.RefObject<number>;
}

const _tempObj = new THREE.Object3D();
const _from    = new THREE.Vector3();
const _to      = new THREE.Vector3();
const _pos     = new THREE.Vector3();
const _dir     = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _whiteColor = new THREE.Color();
const _rocketEase = gsap.parseEase("power2.in");

export function MageSpellEffect({ spellsRef, unitRegistry, simTimeRef }: Props) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const _color = useMemo(() => new THREE.Color(), []);
  
  const settings = useStore((s) => s.settings);

  // Capsule geometry for the rocket body (rotated 90deg to point along Z by default)
  const rocketGeo = useMemo(() => {
    const geo = new THREE.CapsuleGeometry(0.18, 0.45, 4, 12);
    geo.rotateX(Math.PI / 2); // Orient head along Z
    return geo;
  }, []);

  const orbMat = useMemo(() => {
    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(FireballShader.uniforms),
        vertexShader: FireballShader.vertexShader,
        fragmentShader: FireballShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
    });
  }, []);



  useFrame((state, delta) => {
    const mesh = meshRef.current;
    const spells = spellsRef?.current;
    if (!mesh || !spells) return;

    const time = state.clock.elapsedTime;
    if ((orbMat as any).uniforms?.time) {
        (orbMat as any).uniforms.time.value = time;
    }


    let instanceIdx = 0;

    for (let i = 0; i < spells.length; i++) {
        const s = spells[i];
        if (!s || !s.active) continue;

        // --- LEAD TARGETING & HOMING ---
        if (s.targetId && unitRegistry.current) {
            const target = unitRegistry.current.get(s.targetId);
            if (target && target.hp > 0) {
                // Pure Homing: Track the target precisely without twitchy velocity prediction
                _targetPos.set(
                    target.position[0], 
                    target.position[1] + 1.0, 
                    target.position[2]
                );
                
                s.toX = _targetPos.x;
                s.toY = _targetPos.y;
                s.toZ = _targetPos.z;
            }
        }

        const currentSimTime = simTimeRef.current || 0;
        const timeLimit = MAGE_PROJECTILE_TIME_MS || 350;
        let alpha = (currentSimTime - s.startTime) / timeLimit;
        if (isNaN(alpha)) alpha = 0;
        
        s.progress = Math.min(1.0, Math.max(0, alpha));


        // Use GSAP Easing for "Rocket Kick-off"
        const tBase = _rocketEase(s.progress);

        if (s.progress >= 1.0) {
            _pos.set(s.toX || 0, s.toY || 0, s.toZ || 0);
        } else {
            _from.set(s.fromX || 0, s.fromY || 0, s.fromZ || 0);
            _to.set(s.toX || 0, s.toY || 0, s.toZ || 0);
            _pos.lerpVectors(_from, _to, tBase);
            _dir.copy(_to).sub(_from);
            if (_dir.lengthSq() > 0.0001) _dir.normalize();
            else _dir.set(0, 0, 1);
        }

        _color.set(s.color || '#ffffff');


        const SEGMENTS = 6; 
        for (let j = 0; j < SEGMENTS; j++) {
            if (instanceIdx >= MAX_SPELLS) break;

            const tOffset = j * -0.012; 
            const tRaw = Math.max(0, s.progress + tOffset);
            const t = _rocketEase(tRaw);
            
            if (s.progress >= 1.0) {
                _pos.set(s.toX || 0, s.toY || 0, s.toZ || 0);
            } else {
                _from.set(s.fromX || 0, s.fromY || 0, s.fromZ || 0);
                _to.set(s.toX || 0, s.toY || 0, s.toZ || 0);
                _pos.lerpVectors(_from, _to, t);
            }

            _tempObj.position.copy(_pos);

            
            // Align with direction (safe LookAt)
            _to.set(s.toX, s.toY, s.toZ);
            if (_pos.distanceToSquared(_to) > 0.001) {
                _tempObj.lookAt(s.toX, s.toY, s.toZ);
            } else if (_dir.lengthSq() > 0.001) {
                _tempObj.lookAt(_pos.x + _dir.x, _pos.y + _dir.y, _pos.z + _dir.z); // use fallback direction
            }
            
            const pulse = Math.sin(time * 30 + j) * 0.05;

            const headScale = 1.3 + pulse;
            const trailScale = (0.7 - (j * 0.12)) + pulse;
            
            const finalScale = (j === 0 ? headScale : Math.max(0.1, trailScale * 0.8));
            _tempObj.scale.setScalar(finalScale);
            _tempObj.updateMatrix();
            
            mesh.setMatrixAt(instanceIdx, _tempObj.matrix);
            
            if (j === 0) {
                _whiteColor.set('#ffffff').lerp(_color, 0.1);
                mesh.setColorAt(instanceIdx, _whiteColor);
            } else {
                mesh.setColorAt(instanceIdx, _color);
            }
            
            instanceIdx++;
        }
        
        if (s.progress >= 1.0) {
            s.active = false;
        }
    }

    for (let i = instanceIdx; i < MAX_SPELLS; i++) {
        _tempObj.position.set(0, -100, 0);
        _tempObj.scale.setScalar(0);
        _tempObj.updateMatrix();
        mesh.setMatrixAt(i, _tempObj.matrix);
        mesh.setColorAt(i, _color.set('#000000'));
    }

    
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = MAX_SPELLS;

  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[rocketGeo, orbMat, MAX_SPELLS]}
      frustumCulled={false}
      renderOrder={100}
    />

  );
}
