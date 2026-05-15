'use client';

/**
 * PlayerController — MMORPG Edition (Auto-Aim)
 *
 * Architecture:
 * - Auto-aim: Scans unitRegistry each frame for nearest enemy → auto-fire
 * - Mouse/wheel only for camera control (no click-to-attack)
 * - Animation transitions driven by BVHEcctrl's animationStatus global
 * - Single, prioritised useFrame (priority=-1) handles camera + combat
 * - No useState, no useRef for per-frame values (all in ECS)
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF } from '@react-three/drei';
import BVHEcctrl, { useAnimationStore, characterStatus } from 'bvhecctrl';
import * as THREE from 'three';
import { useVFX } from './systems/VFXManager';
import ProjectilePool, { ProjectilePoolHandle } from './systems/ProjectilePool';
import { useStore } from '@/src/state/useStore';
import { UnitRuntimeData } from '@/src/core/domain/unit.types';

// ─── ANIMATION MAPS ──────────────────────────────────────────────────────────
const animationSet = {
  idle:  'Idle',
  walk:  'Walk',
  run:   'Run',
  jump:  'Jump',
  shoot: 'Shoot_OneHanded',
};

const ecctrlAnimationSet: Record<string, string> = {
  IDLE:       animationSet.idle,
  WALK:       animationSet.walk,
  RUN:        animationSet.run,
  JUMP_START: animationSet.jump,
  JUMP_IDLE:  animationSet.jump,
  JUMP_FALL:  animationSet.jump,
  JUMP_LAND:  animationSet.idle,
};

export const keyboardMap = [
  { name: 'forward',   keys: ['ArrowUp',    'KeyW'] },
  { name: 'backward',  keys: ['ArrowDown',  'KeyS'] },
  { name: 'leftward',  keys: ['ArrowLeft',  'KeyA'] },
  { name: 'rightward', keys: ['ArrowRight', 'KeyD'] },
  { name: 'jump',      keys: ['Space'] },
  { name: 'run',       keys: ['Shift'] },
  { name: 'action1',   keys: ['KeyF', 'KeyE'] },
];

// ─── ZERO-ALLOC MATH OBJECTS (module-level = never GC'd) ─────────────────────
const _charPos    = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _lookAt     = new THREE.Vector3();
const _camTarget  = new THREE.Vector3();
const _camDir     = new THREE.Vector3();
const _originVec  = new THREE.Vector3();
const _fwdVec     = new THREE.Vector3();
const _toEnemy    = new THREE.Vector3();
const _targetVec  = new THREE.Vector3();

// ─── ECS BUFFERS (TypedArrays — same-frame, no GC) ───────────────────────────
// Camera state
const PlayerInput = {
  mouseX:   new Float32Array(1),
  mouseY:   new Float32Array(1),
  playerPosition: new Float32Array(3), // [x, y, z] Zero-GC tracking
};
const camYaw        = new Float32Array(1);   // radians
const camPitch      = new Float32Array([0.3]);
const camZoom       = new Float32Array([5.0]);
const camZoomTarget = new Float32Array([5.0]);
const camPosX       = new Float32Array(1);
const camPosY       = new Float32Array(1);
const camPosZ       = new Float32Array(1);
const lookAtX       = new Float32Array(1);
const lookAtY       = new Float32Array(1);
const lookAtZ       = new Float32Array(1);
const hasCamInit    = new Uint8Array(1);     // 0=false, 1=true

// Input state (written by DOM events, read by useFrame)
const isRightClick  = new Uint8Array(1);
const isLeftClick   = new Uint8Array(1);

// Auto-aim state
const autoFireTimer  = new Float64Array(1);   // last auto-fire time (ms)
const aimTargetX     = new Float32Array(1);
const aimTargetY     = new Float32Array(1);
const aimTargetZ     = new Float32Array(1);
const hasTarget      = new Uint8Array(1);     // 0=no target, 1=has target

// Constants
const ZOOM_MIN   = 1.5;
const ZOOM_MAX   = 20.0;
const ZOOM_LERP  = 10.0;
const EYE_HEIGHT = 1.6;
const AUTO_FIRE_RATE  = 250;   // ms between auto-shots
const AUTO_AIM_RADIUS = 20.0;  // world units detection radius
const AUTO_AIM_RSQ    = AUTO_AIM_RADIUS * AUTO_AIM_RADIUS;

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export const PlayerController = ({
  damageQueue,
  settingsRef,
  paused = false,
  unitRegistry,
  dealPlayerDamage,
}: {
  damageQueue?: React.RefObject<any[]>;
  settingsRef: React.RefObject<any>;
  paused?: boolean;
  unitRegistry?: React.RefObject<UnitRuntimeData[]>;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean) => void;
}) => {
  const poolRef      = useRef<ProjectilePoolHandle>(null);
  const ecctrlRef    = useRef<any>(null);
  const characterRef = useRef<THREE.Group>(null!);
  const { camera }   = useThree();

  // ─── ASSET LOADING ────────────────────────────────────────────────────────
  const { scene, animations } = useGLTF('/assets-model/Chef_Male.glb');
  const { actions }           = useAnimations(animations, characterRef);
  const activeAction          = useRef<THREE.AnimationAction | null>(null);

  // ─── ANIMATION SYNC (outside useFrame, driven by bvhecctrl store) ─────────
  const animationStatus = useAnimationStore((s) => s.animationStatus);
  useEffect(() => {
    // Priority: If shooting, play shoot animation (handled in useFrame for better responsiveness)
    // but we still sync base animations here.
    if (isLeftClick[0] && hasTarget[0]) return; 

    const animName   = ecctrlAnimationSet[animationStatus] ?? animationSet.idle;
    const nextAction = actions[animName];
    if (!nextAction || nextAction === activeAction.current) return;

    if (activeAction.current) {
      nextAction.reset().play();
      activeAction.current.crossFadeTo(nextAction, 0.2, true);
    } else {
      nextAction.reset().fadeIn(0.1).play();
    }
    activeAction.current = nextAction;
  }, [animationStatus, actions]);

  // ─── DOM EVENT LISTENERS (write to ECS buffers, not React state) ──────────
  useEffect(() => {
    // Mouse look (right-drag)
    const onMouseMove = (e: MouseEvent) => {
      if (!isRightClick[0]) return;
      const s = settingsRef.current?.mouseSensitivity ?? 0.002;
      camYaw[0]   -= e.movementX * s;
      camPitch[0] -= e.movementY * s;
      camPitch[0]  = Math.max(-0.4, Math.min(1.1, camPitch[0]));
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) isLeftClick[0] = 1;
      if (e.button === 2) isRightClick[0] = 1;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) isLeftClick[0] = 0;
      if (e.button === 2) isRightClick[0] = 0;
    };
    const preventContext = (e: MouseEvent) => { if (e.button === 2) e.preventDefault(); };

    // Zoom (mouse wheel)
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camZoomTarget[0] = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX,
        camZoomTarget[0] + e.deltaY * 0.01 * 2.0
      ));
    };

    // Pointer lock: when locked treat any movement as camera look
    const onPointerLockMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      const s = settingsRef.current?.mouseSensitivity ?? 0.002;
      camYaw[0]   -= e.movementX * s;
      camPitch[0] -= e.movementY * s;
      camPitch[0]  = Math.max(-0.4, Math.min(1.1, camPitch[0]));
    };

    document.addEventListener('mousemove',   onMouseMove);
    document.addEventListener('mousemove',   onPointerLockMove);
    document.addEventListener('mousedown',   onMouseDown);
    document.addEventListener('mouseup',     onMouseUp);
    document.addEventListener('contextmenu', preventContext);
    window.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      document.removeEventListener('mousemove',   onMouseMove);
      document.removeEventListener('mousemove',   onPointerLockMove);
      document.removeEventListener('mousedown',   onMouseDown);
      document.removeEventListener('mouseup',     onMouseUp);
      document.removeEventListener('contextmenu', preventContext);
      window.removeEventListener('wheel', onWheel);
    };
  }, [settingsRef]);

  const { spawnVFX } = useVFX();
  const [, getKeys]  = useKeyboardControls();

  // ─── SINGLE USEFRAME: Camera + Auto-Aim Combat (priority 1 = runs AFTER physics) ──
  useFrame((_, delta) => {
    // === CAMERA SYSTEM ===
    _charPos.copy(characterStatus.position as THREE.Vector3);

    // Update player position in store (for enemy AI targeting)
    useStore.getState().setPlayerPosition([_charPos.x, _charPos.y, _charPos.z]);
    
    // Sync position to PlayerECS for enemies to seek without GC pressure
    PlayerInput.playerPosition[0] = _charPos.x;
    PlayerInput.playerPosition[1] = _charPos.y;
    PlayerInput.playerPosition[2] = _charPos.z;

    // Lerp zoom (ECS buffers → no allocation)
    camZoom[0] += (camZoomTarget[0] - camZoom[0]) * Math.min(1, ZOOM_LERP * delta);

    const cosPitch = Math.cos(camPitch[0]);
    const sinPitch = Math.sin(camPitch[0]);
    const dist     = camZoom[0];

    _camDesired.set(
      _charPos.x - Math.sin(camYaw[0]) * cosPitch * dist,
      _charPos.y + sinPitch * dist + EYE_HEIGHT,
      _charPos.z - Math.cos(camYaw[0]) * cosPitch * dist,
    );

    if (!hasCamInit[0]) {
      camPosX[0] = _camDesired.x;
      camPosY[0] = _camDesired.y;
      camPosZ[0] = _camDesired.z;
      lookAtX[0] = _charPos.x;
      lookAtY[0] = _charPos.y + EYE_HEIGHT;
      lookAtZ[0] = _charPos.z;
      hasCamInit[0] = 1;
    }

    // Lerp camera pos (write to ECS floats first, then push to Three.js once)
    const lerpT = Math.min(1, 14 * delta);
    camPosX[0] += (_camDesired.x - camPosX[0]) * lerpT;
    camPosY[0] += (_camDesired.y - camPosY[0]) * lerpT;
    camPosZ[0] += (_camDesired.z - camPosZ[0]) * lerpT;
    camera.position.set(camPosX[0], camPosY[0], camPosZ[0]);

    // Lerp lookAt
    const lookT = Math.min(1, 18 * delta);
    lookAtX[0] += (_charPos.x               - lookAtX[0]) * lookT;
    lookAtY[0] += (_charPos.y + EYE_HEIGHT  - lookAtY[0]) * lookT;
    lookAtZ[0] += (_charPos.z               - lookAtZ[0]) * lookT;
    _lookAt.set(lookAtX[0], lookAtY[0], lookAtZ[0]);
    camera.lookAt(_lookAt);

    // === AUTO-AIM COMBAT SYSTEM ===
    const now = performance.now();
    const registry = unitRegistry?.current;

    // ── Find Nearest Enemy Unit ──
    hasTarget[0] = 0;
    let nearestDistSq = AUTO_AIM_RSQ;

    if (registry) {
      for (let i = 0; i < registry.length; i++) {
        const u = registry[i];
        if (!u.isActive || u.isDying || u.type !== 'enemy') continue;

        const dx = _charPos.x - u.position[0];
        const dz = _charPos.z - u.position[2];
        const dSq = dx * dx + dz * dz;

        if (dSq < nearestDistSq) {
          nearestDistSq = dSq;
          aimTargetX[0] = u.position[0];
          aimTargetY[0] = u.position[1] + 1.2;
          aimTargetZ[0] = u.position[2];
          hasTarget[0] = 1;
        }
      }
    }

    // ── Face Target and Handle Animation ──
    if (hasTarget[0] && isLeftClick[0]) {
      // Robust Local-Space Targeting: 
      // 1. Get world target
      _targetVec.set(aimTargetX[0], _charPos.y, aimTargetZ[0]);
      
      // 2. Convert to local space of the character's parent (the capsule)
      // This automatically accounts for the parent's rotation.
      if (characterRef.current.parent) {
        characterRef.current.parent.worldToLocal(_targetVec);
      }
      
      // 3. Calculate angle in local space. 
      // Most models face -Z, so we use atan2(x, z) + PI or similar.
      // We'll use the most common orientation for these assets.
      const localTargetAngle = Math.atan2(_targetVec.x, _targetVec.z);

      // Smoothly rotate the character model (inside Ecctrl) to face target
      const rotLerpT = Math.min(1, 20 * delta);
      
      // Handle angle wrapping for smooth rotation
      let diff = localTargetAngle - characterRef.current.rotation.y;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      characterRef.current.rotation.y += diff * rotLerpT;

      // Force Shoot Animation
      const shootAction = actions[animationSet.shoot];
      if (shootAction && shootAction !== activeAction.current) {
        shootAction.reset().play();
        if (activeAction.current) activeAction.current.crossFadeTo(shootAction, 0.1, true);
        activeAction.current = shootAction;
      }
    } else {
      // Lerp back to 0 so it aligns with capsule movement again when not shooting
      const resetLerpT = Math.min(1, 10 * delta);
      characterRef.current.rotation.y += (0 - characterRef.current.rotation.y) * resetLerpT;
    }

    // ── Auto-Fire at Nearest Enemy ──
    const keys = getKeys();

    // Auto-fire only when left mouse is clicked and target is in range
    if (hasTarget[0] && isLeftClick[0] && now - autoFireTimer[0] > AUTO_FIRE_RATE) {
      autoFireTimer[0] = now;

      _originVec.set(_charPos.x, _charPos.y + 1.35, _charPos.z);
      _camDir.set(
        aimTargetX[0] - _charPos.x,
        aimTargetY[0] - (_charPos.y + 1.35),
        aimTargetZ[0] - _charPos.z,
      ).normalize();

      // Offset origin slightly forward
      _fwdVec.copy(_camDir).multiplyScalar(0.7);
      _originVec.add(_fwdVec);

      spawnVFX([_originVec.x, _originVec.y, _originVec.z], 'muzzle', '#ffaa00');

      // ── Find best hit target with AOE fallback ──
      const combatMode = useStore.getState().combatMode;
      const LOCK_RSQ = AUTO_AIM_RSQ;
      const AOE_RSQ  = 5.0 * 5.0;

      let nearestTarget: UnitRuntimeData | null = null;
      let minDSq = LOCK_RSQ;

      if (registry) {
        for (let i = 0; i < registry.length; i++) {
          const u = registry[i];
          if (!u.isActive || u.isDying || u.type !== 'enemy') continue;
          const dx = _charPos.x - u.position[0];
          const dz = _charPos.z - u.position[2];
          const dSq = dx * dx + dz * dz;
          if (dSq < minDSq) {
            minDSq = dSq;
            nearestTarget = u;
          }
        }
      }

      if (nearestTarget) {
        _camTarget.set(nearestTarget.position[0], nearestTarget.position[1] + 1, nearestTarget.position[2]);

        if (combatMode === 'SINGLE' && (nearestTarget as any).onHit) {
          (nearestTarget as any).onHit?.();
        }

        const damage = 100 + Math.random() * 400;
        const isCrit = Math.random() > 0.8;
        
        if (dealPlayerDamage) {
          dealPlayerDamage(nearestTarget.id, damage, isCrit);
        } else {
          // Fallback visual damage if dealPlayerDamage is not provided
          damageQueue?.current?.push({
            value: damage,
            position: [_camTarget.x, _camTarget.y + 1, _camTarget.z],
            isCrit: isCrit,
            isMagic: false,
            color: '#ffaa00',
          });
        }
        spawnVFX([_camTarget.x, _camTarget.y + 1, _camTarget.z], 'spark', '#ff0000');

        if (combatMode === 'AOE' && registry) {
          const nx = _camTarget.x;
          const ny = _camTarget.y;
          const nz = _camTarget.z;
          for (let i = 0; i < registry.length; i++) {
            const u = registry[i];
            if (!u.isActive || u.isDying || u.type !== 'enemy') continue;
            const dx = u.position[0] - nx;
            const dy = u.position[1] - ny;
            const dz = u.position[2] - nz;
            if (dx*dx + dy*dy + dz*dz > AOE_RSQ) continue;
            const damage = 80 + Math.random() * 200;
            const isCrit = Math.random() > 0.85;
            
            if (dealPlayerDamage) {
              dealPlayerDamage(u.id, damage, isCrit);
            } else {
              damageQueue?.current?.push({
                value: damage,
                position: [u.position[0], u.position[1] + 1, u.position[2]],
                isCrit: isCrit,
                isMagic: false,
                color: '#ffaa00',
              });
            }
            spawnVFX([u.position[0], u.position[1] + 1, u.position[2]], 'spark', '#ff4400');
          }
        }

        // Aim direction for projectile
        _toEnemy.set(
          nearestTarget.position[0] - _charPos.x,
          (nearestTarget.position[1] + 1.2) - (_charPos.y + 1.35),
          nearestTarget.position[2] - _charPos.z,
        ).normalize();

        poolRef.current?.fire(_originVec, _toEnemy);
      }
    }

    // Allow manual fire even without nearby target (F/E keys)
    if (keys.action1 && !hasTarget[0] && now - autoFireTimer[0] > AUTO_FIRE_RATE) {
      autoFireTimer[0] = now;
      _originVec.set(_charPos.x, _charPos.y + 1.35, _charPos.z);
      camera.getWorldDirection(_camDir);
      _camDir.y = 0;
      _camDir.normalize();
      _fwdVec.copy(_camDir).multiplyScalar(0.7);
      _originVec.add(_fwdVec);
      spawnVFX([_originVec.x, _originVec.y, _originVec.z], 'muzzle', '#ffaa00');
      poolRef.current?.fire(_originVec, _camDir);
    }
  }, -1); // priority -1: runs before physics

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <>
      <ProjectilePool ref={poolRef} damageQueue={damageQueue} />

      <BVHEcctrl
        ref={ecctrlRef}
        paused={paused}
        position={[0, 15, 0]}
        floatHeight={0.1}
        maxWalkSpeed={3}
        onPointerCancel={true}
        maxRunSpeed={5}
        turnSpeed={20}
        jumpVel={5}
        collisionCheckIteration={20}
        collisionPushBackVelocity={20}
        collisionPushBackThreshold={0.0001}
      >
        <group ref={characterRef} dispose={null} position={[0, -0.65, 0]}>
          <primitive object={scene} />
        </group>
      </BVHEcctrl>
    </>
  );
};
