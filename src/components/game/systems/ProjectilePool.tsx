import React, { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVFX } from './VFXManager';

const MAX_BULLETS = 100;
const BULLET_SPEED = 1.8;
const BULLET_LIFETIME = 2.0;

export interface ProjectilePoolHandle {
  fire: (origin: THREE.Vector3, direction: THREE.Vector3) => void;
}

interface ProjectilePoolProps {
  damageQueue?: React.RefObject<any[]>;
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
      // We cast from current position to next position to prevent tunneling
      raycaster.set(b.position, b.direction);
      raycaster.far = _vMove.length();
      
      // In BVH-enabled scenes, this intersect call is extremely fast
      const intersects = raycaster.intersectObjects(scene.children, true);
      
      if (intersects.length > 0) {
        // HIT DETECTED!
        const hit = intersects[0];
        
        // 1. Trigger VFX Spark at hit position
        spawnVFX([hit.point.x, hit.point.y, hit.point.z], 'spark', '#ffffff');

        // 2. Trigger hit event if defined in userData
        if (hit.object.userData?.onHit) {
          hit.object.userData.onHit();
        }

        // 3. Trigger Damage HUD Popup
        if (props.damageQueue?.current) {
            const isCrit = Math.random() > 0.8;
            props.damageQueue.current.push({
                value: 100 + Math.random() * 400,
                position: [hit.point.x, hit.point.y, hit.point.z],
                isCrit,
                isMagic: false,
                color: isCrit ? '#ffaa00' : '#ffffff'
            });
        }
        
        b.active = false;
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
      {/* Optimized simple geometry for projectiles */}
      <boxGeometry args={[0.06, 0.06, 0.4]} />
      <meshStandardMaterial 
        color="#00f3ff" 
        emissive="#00f3ff" 
        emissiveIntensity={10} 
        toneMapped={false} 
      />
    </instancedMesh>
  );
});

export default ProjectilePool;
