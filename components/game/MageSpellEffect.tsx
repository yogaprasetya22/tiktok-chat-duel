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
        varying vec3 vViewDirection;
        varying vec3 vNormal;
        
        void main() {
            vUv = uv;
            vColor = instanceColor;
            
            vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
            vWorldPosition = worldPosition.xyz;
            vNormal = normalize(mat3(instanceMatrix) * normal);
            
            vec4 mvPosition = modelViewMatrix * worldPosition;
            vViewDirection = -mvPosition.xyz;
            
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vColor;
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;
        varying vec3 vNormal;

        // Noise for heat distortion
        float noise3D(vec3 p) {
            vec3 s = vec3(7, 157, 113);
            vec3 ip = floor(p); p -= ip;
            vec4 h = vec4(0, s.yz, s.y + s.z) + dot(ip, s);
            p = p * p * (3.0 - 2.0 * p);
            h = mix(fract(sin(h) * 43758.545), fract(sin(h + s.x) * 43758.545), p.x);
            h.xy = mix(h.xz, h.yw, p.y);
            return mix(h.x, h.y, p.z);
        }

        void main() {
            vec2 center = vUv - 0.5;
            float dist = length(center);
            
            // Fresnel / Rim Glow effect (Blurred edges)
            vec3 viewDir = normalize(vViewDirection);
            float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
            rim = pow(rim, 1.5); // Softer than before

            // Heat Noise
            float n = noise3D(vWorldPosition * 3.0 + time * 12.0);
            float energy = smoothstep(0.48 + n * 0.08, 0.0, dist);
            float core = smoothstep(0.18, 0.0, dist);
            
            // Fire Colors (Derived from Team Color)
            vec3 fireMid = vColor;
            vec3 fireEdge = mix(vColor, vec3(0.0), 0.4); // Darker rim
            vec3 firePulse = mix(vColor, vec3(1.0), 0.5); // Lighter core
            vec3 coreWhite = vec3(1.0, 1.0, 1.0);
            
            vec3 fireColor = mix(fireEdge, fireMid, energy);
            fireColor = mix(fireColor, firePulse, core + rim * 0.4);
            fireColor = mix(fireColor, coreWhite, core * 1.8);
            
            // Glow intensity
            float pulse = 1.4 + sin(time * 30.0) * 0.3;
            vec3 emissive = fireColor * energy * pulse * 4.2;
            
            // Blur & Alpha (Volumetric feel)
            float alpha = (energy + rim * 0.8) * 1.5;
            alpha *= (1.0 - smoothstep(0.42, 0.5, dist)); // Soft falloff
            
            gl_FragColor = vec4(emissive, alpha);
            if (gl_FragColor.a < 0.01) discard;
        }
    `
};

// ─── Component ────────────────────────────────────────────────────────────────
const MAX_SPELLS = 600; // 200 spells * 3 segments


import { UnitRuntimeData } from '../../hooks/battle/types';

interface Props {
  spellsRef: SpellsRegistryRef;
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
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
  const { spawnVFX } = useVFX();
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const _color = useMemo(() => new THREE.Color(), []);
  const settings = useStore((s) => s.settings);

  // Capsule geometry for the magic bolt (Larger for visibility)
  const rocketGeo = useMemo(() => {
    const geo = new THREE.CapsuleGeometry(0.24, 0.55, 4, 12);
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
            const tIdx = parseInt(s.targetId.split('-')[1]);
            const target = unitRegistry.current[tIdx];
            if (target && target.isActive && target.id === s.targetId && target.hp > 0) {
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


        const SEGMENTS = 3; 
        for (let j = 0; j < SEGMENTS; j++) {
            if (instanceIdx >= MAX_SPELLS) break;

            const tOffset = j * -0.015; 
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
            
            const pulse = (j === 0) ? Math.sin(time * 30) * 0.05 : 0;

            const isBullet = (s as any).isBullet;
            const headScale = (isBullet ? 0.4 : 1.3) + pulse;
            const trailScale = (isBullet ? 0.2 : (0.7 - (j * 0.2))) + pulse;
            
            const finalScale = (j === 0 ? headScale : Math.max(0.15, trailScale * 0.8));
            _tempObj.scale.setScalar(finalScale * 1.25);
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
        
        if (s.progress >= 0.99) {
            // TRIGGER IMPACT VFX
            if (spawnVFX) {
                const pos: [number, number, number] = [s.toX, s.toY, s.toZ];
                spawnVFX(pos, 'fireball_hit', s.color);
                spawnVFX(pos, 'spark', s.color); 
                spawnVFX(pos, 'shockwave', s.color); 
            }
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
