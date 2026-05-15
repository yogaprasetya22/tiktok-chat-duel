import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVFX } from './VFXManager';

const MAX_BULLETS = 100;
const BULLET_SPEED = 2.2; // Increased speed for better feel
const BULLET_LIFETIME = 2.5;

export interface ProjectilePoolHandle {
  fire: (origin: THREE.Vector3, direction: THREE.Vector3) => void;
}

interface ProjectilePoolProps {
  damageQueue?: React.RefObject<any[]>;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean) => void;
}

const ProjectilePool = forwardRef<ProjectilePoolHandle, ProjectilePoolProps>((props, ref) => {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const { scene } = useThree();
  const { spawnVFX } = useVFX();
  
  // High-performance static array pool
  const pool = useMemo(() => Array.from({ length: MAX_BULLETS }, () => ({
    active: false,
    position: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    life: 0
  })), []);

  // Pre-allocated objects for zero-allocation frame updates
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const _vMove = useMemo(() => new THREE.Vector3(), []);
  const _target = useMemo(() => new THREE.Vector3(), []);

  useImperativeHandle(ref, () => ({
    fire: (origin, direction) => {
      const b = pool.find(bullet => !bullet.active);
      if (b) {
        b.active = true;
        b.position.copy(origin);
        b.direction.copy(direction).normalize();
        b.life = BULLET_LIFETIME;
      }
    }
  }));

  useFrame((_, delta) => {
    if (!meshRef.current) return;

    for (let i = 0; i < MAX_BULLETS; i++) {
      const b = pool[i];
      if (!b.active) {
        // Hide inactive bullets efficiently
        dummy.position.set(0, -1000, 0);
        dummy.updateMatrix();
        meshRef.current.setMatrixAt(i, dummy.matrix);
        continue;
      }

      // 1. Calculate next movement vector
      _vMove.copy(b.direction).multiplyScalar(BULLET_SPEED);
      
      // 2. High-Precision Raycast Hit Detection (via BVH)
      raycaster.set(b.position, b.direction);
      raycaster.far = _vMove.length() * 1.5; // Slightly more for safety
      
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        const hit = intersects[0];
        
        // Find onHit in the hierarchy (traverse up)
        let targetId: string | null = null;
        let curr: THREE.Object3D | null = hit.object;
        while (curr) {
          if (curr.userData?.onHit && curr.userData?.unitId) {
            targetId = curr.userData.unitId;
            curr.userData.onHit(); // Triggers aggro
            break;
          }
          curr = curr.parent;
        }

        if (targetId) {
          spawnVFX([hit.point.x, hit.point.y, hit.point.z], 'spark', '#ff0000');
          
          const damage = 1200 + Math.random() * 2500;
          const isCrit = Math.random() > 0.8;
          
          if (props.dealPlayerDamage) {
            props.dealPlayerDamage(targetId, damage, isCrit);
          } else if (props.damageQueue?.current) {
            props.damageQueue.current.push({
                value: damage,
                position: [hit.point.x, hit.point.y, hit.point.z],
                isCrit,
                isMagic: false,
                color: isCrit ? '#ff4400' : '#ffaa00'
            });
          }
          b.active = false;
        } else {
          // Hit world or something else
          b.position.add(_vMove);
          b.life -= delta;
          if (b.life <= 0) b.active = false;
        }
      } else {
        // 3. Update Position & Life
        b.position.add(_vMove);
        b.life -= delta;
        if (b.life <= 0) b.active = false;
      }

      // 4. Update Visuals
      dummy.position.copy(b.position);
      _target.copy(b.position).add(b.direction);
      dummy.lookAt(_target);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, MAX_BULLETS]} frustumCulled={false}>
      <boxGeometry args={[0.08, 0.08, 0.6]} />
      <meshStandardMaterial 
        color="#00f3ff" 
        emissive="#00f3ff" 
        emissiveIntensity={15} 
        toneMapped={false} 
      />
    </instancedMesh>
  );
});

export default ProjectilePool;
