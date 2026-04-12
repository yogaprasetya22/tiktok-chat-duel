'use client';
/**
 * MMSpellEffect – High-performance instanced Marksman projectiles (bullets).
 * Renders fast-flying energy streaks with team-colored impact splatters.
 */

import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVFX } from '../VFXManager';
import { SpellsRegistryRef } from './MageSpellEffect';
import { UnitRuntimeData } from '../../../hooks/battle/types';
import gsap from 'gsap';

interface Props {
  spellsRef: SpellsRegistryRef;
  unitRegistry: React.RefObject<UnitRuntimeData[]>;
  simTimeRef: React.RefObject<number>;
  bulletSpeed?: number;
}

const MAX_BULLETS = 400;

const BulletShader = {
    uniforms: {
        time: { value: 0 },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        
        void main() {
            vUv = uv;
            vColor = instanceColor;
            vec4 worldPosition = instanceMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * modelViewMatrix * worldPosition;
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vColor;
        uniform float time;

        void main() {
            float dist = length(vUv - 0.5);
            // Energy streak look: bright center, faded edges
            float opacity = smoothstep(0.5, 0.2, dist);
            
            // Pulse effect
            float pulse = 1.0 + 0.5 * sin(time * 50.0);
            vec3 finalColor = vColor * pulse * 2.0;
            
            gl_FragColor = vec4(finalColor, opacity);
            if (gl_FragColor.a < 0.1) discard;
        }
    `
};

const _tempObj = new THREE.Object3D();
const _from    = new THREE.Vector3();
const _to      = new THREE.Vector3();
const _pos     = new THREE.Vector3();
const _dir     = new THREE.Vector3();
const _targetPos = new THREE.Vector3();
const _whiteColor = new THREE.Color();
const _bulletEase = gsap.parseEase("none"); // Bullets fly at constant high speed

export function MMSpellEffect({ spellsRef, unitRegistry, simTimeRef, bulletSpeed = 150 }: Props) {
  const { spawnVFX } = useVFX();
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const _color = useMemo(() => new THREE.Color(), []);

  // Long thin capsule for bullets (streaks)
  const bulletGeo = useMemo(() => {
    const geo = new THREE.CapsuleGeometry(0.02, 0.4, 2, 8);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, []);

  const bulletMat = useMemo(() => {
    return new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(BulletShader.uniforms),
        vertexShader: BulletShader.vertexShader,
        fragmentShader: BulletShader.fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        defines: { USE_INSTANCING: '', USE_INSTANCING_COLOR: '' }
    });
  }, []);

  useFrame((state) => {
    const mesh = meshRef.current;
    const spells = spellsRef?.current;
    if (!mesh || !spells) return;

    if ((bulletMat as any).uniforms?.time) {
        (bulletMat as any).uniforms.time.value = state.clock.elapsedTime;
    }

    let instanceIdx = 0;

    for (let i = 0; i < spells.length; i++) {
        const s = spells[i];
        if (!s || !s.active || !(s as any).isBullet) continue;

        // --- HOMING ---
        if (s.targetId && unitRegistry.current) {
            const tIdx = parseInt(s.targetId.split('-')[1]);
            const target = unitRegistry.current[tIdx];
            if (target && target.isActive && target.id === s.targetId && target.hp > 0) {
                _targetPos.set(target.position[0], target.position[1] + 1.2, target.position[2]);
                s.toX = _targetPos.x;
                s.toY = _targetPos.y;
                s.toZ = _targetPos.z;
            }
        }

        const currentSimTime = simTimeRef.current || 0;
        const alpha = (currentSimTime - s.startTime) / bulletSpeed;
        s.progress = Math.min(1.0, Math.max(0, isNaN(alpha) ? 0 : alpha));

        if (s.progress >= 1.0) {
            _pos.set(s.toX, s.toY, s.toZ);
        } else {
            _from.set(s.fromX, s.fromY, s.fromZ);
            _to.set(s.toX, s.toY, s.toZ);
            _pos.lerpVectors(_from, _to, s.progress);
            _dir.copy(_to).sub(_from).normalize();
        }

        _tempObj.position.copy(_pos);
        if (s.progress < 1.0 || _dir.lengthSq() > 0) {
            _tempObj.lookAt(s.toX, s.toY, s.toZ);
        }

        // Bullets are small and thin
        _tempObj.scale.set(1, 1, 1.5); // Stretch along Z for streak effect
        _tempObj.updateMatrix();
        
        mesh.setMatrixAt(instanceIdx, _tempObj.matrix);
        _color.set(s.color || '#ffffff');
        mesh.setColorAt(instanceIdx, _color);
        
        instanceIdx++;

        if (s.progress >= 0.99) {
            if (spawnVFX) {
                const pos: [number, number, number] = [s.toX, s.toY, s.toZ];
                // Splatter effect: team-colored sparks
                spawnVFX(pos, 'spark', s.color);
                spawnVFX(pos, 'hit', '#ffffff');
            }
            s.active = false;
        }
    }

    // Hide remaining instances
    for (let i = instanceIdx; i < MAX_BULLETS; i++) {
        _tempObj.position.set(0, -100, 0);
        _tempObj.updateMatrix();
        mesh.setMatrixAt(i, _tempObj.matrix);
    }
    
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.count = MAX_BULLETS;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[bulletGeo, bulletMat, MAX_BULLETS]}
      frustumCulled={false}
    />
  );
}
