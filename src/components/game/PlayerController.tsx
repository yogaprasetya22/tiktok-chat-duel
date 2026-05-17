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
import { PlayerInput } from './systems/PlayerECS';

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
const _targetVec  = new THREE.Vector3();

// ─── ECS BUFFERS (TypedArrays — same-frame, no GC) ───────────────────────────
// Camera state
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
const ZOOM_LERP  = 8.0;
const EYE_HEIGHT = 1.4; // Slightly lower for better center framing
const SHOULDER_OFFSET = 0.0; // Perfectly centered horizontally
const AUTO_FIRE_RATE  = 250;   // ms between auto-shots
const AUTO_AIM_RADIUS = 40.0;  // world units detection radius (MM Role)
const AUTO_AIM_RSQ    = AUTO_AIM_RADIUS * AUTO_AIM_RADIUS;

// Camera Collision Check
const _rayDir = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

// ─── MMORPG STATE MACHINE ────────────────────────────────────────────────────
const charState = new Uint8Array(1);     // 0=NORMAL, 1=ATTACKING, 2=CHASING
const attackTimer = new Float64Array(1); // Time spent in attack animation
const ATTACK_DURATION = 600;             // ms animation lock duration
const ATTACK_RANGE_SQ = 225.0;           // 15 meters range (MM Role)
const _chaseDir = new THREE.Vector3();
const _camProjDir = new THREE.Vector3();
const _camRightDir = new THREE.Vector3();


// ─── COMPONENT ───────────────────────────────────────────────────────────────
export const PlayerController = ({
  damageQueue,
  settingsRef,
  paused = false,
  unitRegistry: _unitRegistry,
  dealPlayerDamage,
  mmSpellsRef,
  simTimeRef,
}: {
  damageQueue?: React.RefObject<any[]>;
  settingsRef: React.RefObject<any>;
  paused?: boolean;
  unitRegistry?: React.RefObject<UnitRuntimeData[]>;
  dealPlayerDamage?: (targetId: string, damage: number, isCrit?: boolean) => void;
  mmSpellsRef?: React.RefObject<any[]>;
  simTimeRef?: React.RefObject<number>;
}) => {
  const poolRef      = useRef<ProjectilePoolHandle>(null);
  const ecctrlRef    = useRef<any>(null);
  const characterRef = useRef<THREE.Group>(null!);
  const { camera }   = useThree();
  const mmSpellPtr   = useRef(0);

  // ─── ASSET LOADING ────────────────────────────────────────────────────────
  const { scene, animations } = useGLTF('/assets-model/Chef_Male.glb');
  const { actions }           = useAnimations(animations, characterRef);
  const activeAction          = useRef<THREE.AnimationAction | null>(null);

  // --- RESET CAMERA ON GAME START ---
  const gameState = useStore(s => s.gameState);
  useEffect(() => {
    hasCamInit[0] = 0; // Force camera snap on game state change (Play/Setup)
  }, [gameState]);

  // ─── ANIMATION SYNC (outside useFrame, driven by bvhecctrl store) ─────────

  const animationStatus = useAnimationStore((s) => s.animationStatus);
  useEffect(() => {
    // If in ATTACKING state, do not apply idle/walk animations (handled in useFrame)
    if (charState[0] === 1) return; 

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
    
    // --- 1. CALCULATE IDEAL CAMERA POSITION ---
    // Offset the target slightly to the shoulder for premium look
    _fwdVec.set(Math.sin(camYaw[0]), 0, Math.cos(camYaw[0])).normalize();
    const _shoulderOffset = new THREE.Vector3().set(Math.cos(camYaw[0]), 0, -Math.sin(camYaw[0])).multiplyScalar(SHOULDER_OFFSET);
    
    _camTarget.copy(_charPos).add(_shoulderOffset);
    _camTarget.y += EYE_HEIGHT;

    _camDesired.set(
      _camTarget.x - Math.sin(camYaw[0]) * cosPitch * camZoom[0],
      _camTarget.y + sinPitch * camZoom[0],
      _camTarget.z - Math.cos(camYaw[0]) * cosPitch * camZoom[0],
    );

    // --- 2. CAMERA COLLISION (Ghost Busting Walls/Trees) ---
    _rayOrigin.copy(_camTarget);
    _rayDir.subVectors(_camDesired, _rayOrigin).normalize();
    _raycaster.set(_rayOrigin, _rayDir);
    _raycaster.far = camZoom[0];

    const colliders = (window as any).globalColliders || [];
    const intersects = _raycaster.intersectObjects(colliders, false);

    if (intersects.length > 0) {
      // Push camera forward to hit point (minus buffer to prevent near-plane clipping)
      const hitDist = intersects[0].distance;
      const safeDist = Math.max(0.4, hitDist - 0.4); 
      _camDesired.copy(_rayOrigin).add(_rayDir.multiplyScalar(safeDist));
      
      // INSTANT SNAP: If we are colliding, don't lerp slowly into the character
      // This prevents the "slow zoom" feel when hitting a tree
      camPosX[0] = _camDesired.x;
      camPosY[0] = _camDesired.y;
      camPosZ[0] = _camDesired.z;
    }

    // --- 3. PREVENT UNDERWORLD CAMERA (Hard Floor) ---
    // Only check ground if colliders are actually loaded to prevent flickering at start
    if (colliders.length > 0) {
      const terrainHeightAtCam = (window as any).getGroundHeight ? (window as any).getGroundHeight(_camDesired.x, _camDesired.z, -1) : -1;
      if (_camDesired.y < terrainHeightAtCam + 0.6) {
        _camDesired.y = terrainHeightAtCam + 0.6;
        camPosY[0] = _camDesired.y; 
      }
    }

    if (!hasCamInit[0]) {
      camPosX[0] = _camDesired.x;
      camPosY[0] = _camDesired.y;
      camPosZ[0] = _camDesired.z;
      lookAtX[0] = _camTarget.x;
      lookAtY[0] = _camTarget.y;
      lookAtZ[0] = _camTarget.z;
      hasCamInit[0] = 1;
    }

    // Lerp camera pos (write to ECS floats first, then push to Three.js once)
    const lerpT = Math.min(1, 15 * delta);
    camPosX[0] += (_camDesired.x - camPosX[0]) * lerpT;
    camPosY[0] += (_camDesired.y - camPosY[0]) * lerpT;
    camPosZ[0] += (_camDesired.z - camPosZ[0]) * lerpT;
    camera.position.set(camPosX[0], camPosY[0], camPosZ[0]);

    // Lerp lookAt
    const lookT = Math.min(1, 20 * delta);
    lookAtX[0] += (_camTarget.x  - lookAtX[0]) * lookT;
    lookAtY[0] += (_camTarget.y  - lookAtY[0]) * lookT;
    lookAtZ[0] += (_camTarget.z  - lookAtZ[0]) * lookT;
    _lookAt.set(lookAtX[0], lookAtY[0], lookAtZ[0]);
    camera.lookAt(_lookAt);

    const now = performance.now();

    // ── Find Nearest Enemy Unit ──
    hasTarget[0] = 0;
    let nearestTarget: UnitRuntimeData | null = null;
    const grid = (window as any).battleGrid; 
    
    if (grid) {
      const nearby = grid.queryRadius(_charPos.x, _charPos.z, AUTO_AIM_RADIUS);
      let nearestDistSq = AUTO_AIM_RSQ;

      for (let i = 0; i < nearby.length; i++) {
        const u = nearby[i];
        if (u.type !== 'enemy' || !u.isActive || u.isDying) continue;

        const dx = _charPos.x - u.position[0];
        const dz = _charPos.z - u.position[2];
        const dSq = dx * dx + dz * dz;

        if (dSq < nearestDistSq) {
          nearestDistSq = dSq;
          aimTargetX[0] = u.position[0];
          aimTargetY[0] = u.position[1] + 1.2;
          aimTargetZ[0] = u.position[2];
          hasTarget[0] = 1;
          nearestTarget = u;
        }
      }
    }

    const keys = getKeys();
    const isMovingInput = keys.forward || keys.backward || keys.leftward || keys.rightward;
    const isAttackInput = isLeftClick[0] || keys.action1;

    // ── Execute Attack Function (Spawns VFX & Projectile) ──
    const executeAttack = (target: UnitRuntimeData | null) => {
      _originVec.set(_charPos.x, _charPos.y + 1.35, _charPos.z);
      camera.getWorldDirection(_camDir);
      
      if (target) {
        _camDir.set(
          aimTargetX[0] - _charPos.x,
          aimTargetY[0] - (_charPos.y + 1.35),
          aimTargetZ[0] - _charPos.z,
        ).normalize();
      } else {
        _camDir.y = 0;
        _camDir.normalize();
      }

      _fwdVec.copy(_camDir).multiplyScalar(0.7);
      _originVec.add(_fwdVec);
      spawnVFX([_originVec.x, _originVec.y, _originVec.z], 'muzzle', '#ffaa00');

      if (target && mmSpellsRef?.current) {
        // Targeted MMORPG Magic/Bullet
        const pool = mmSpellsRef.current;
        const s = pool[mmSpellPtr.current];
        s.active = true;
        s.isBullet = true;
        s.fromX = _originVec.x;
        s.fromY = _originVec.y;
        s.fromZ = _originVec.z;
        s.toX = target.position[0];
        s.toY = target.position[1] + 1.2;
        s.toZ = target.position[2];
        s.startTime = simTimeRef?.current || 0;
        s.color = "#00d4ff";
        s.targetId = target.id;
        (s as any).targetPoolIdx = target.poolIdx;
        (s as any).isSniper = true;
        (s as any).isFinisher = false;
        (s as any).bulletSpeed = 135.0;
        
        mmSpellPtr.current = (mmSpellPtr.current + 1) % pool.length;

        if (dealPlayerDamage) {
          const damage = 2500 + Math.random() * 1500;
          const isCrit = Math.random() > 0.85;
          dealPlayerDamage(target.id, damage, isCrit);
        }
      } else {
        // Free-fire mode (No target)
        poolRef.current?.fire(_originVec, _camDir);
      }
    };

    // ── MMORPG STATE MACHINE ──
    
    // Check Input triggers
    if (isAttackInput && now - autoFireTimer[0] > AUTO_FIRE_RATE) {
      if (hasTarget[0]) {
        const dx = aimTargetX[0] - _charPos.x;
        const dz = aimTargetZ[0] - _charPos.z;
        const distSq = dx*dx + dz*dz;
        
        if (distSq > ATTACK_RANGE_SQ) {
          // 4. Otomatis Mengejar Musuh
          charState[0] = 2; // CHASING
        } else {
          // 2. Combo Diam di Tempat (Reset timer jika serang lagi)
          charState[0] = 1; // ATTACKING
          attackTimer[0] = now;
          autoFireTimer[0] = now;
          ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
          executeAttack(nearestTarget);
        }
      } else {
        // Memukul angin
        charState[0] = 1; // ATTACKING
        attackTimer[0] = now;
        autoFireTimer[0] = now;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
        executeAttack(null);
      }
    }

    // Process Active States
    if (charState[0] === 1) { 
      // == STATE: ATTACKING ==
      if (isMovingInput) {
        // 3. Batal Memukul Jika Bergerak (Cancel/Override)
        charState[0] = 0; 
      } else {
        // 1. Berhenti Saat Menyerang (Animation Lock)
        // Force velocity X & Z to 0, but keep Y for gravity
        const vel = characterStatus.linvel;
        _originVec.set(0, vel.y, 0);
        ecctrlRef.current?.setLinVel(_originVec);
        
        // Face target dynamically
        if (hasTarget[0]) {
          _targetVec.set(aimTargetX[0], _charPos.y, aimTargetZ[0]);
          if (characterRef.current.parent) characterRef.current.parent.worldToLocal(_targetVec);
          const localTargetAngle = Math.atan2(_targetVec.x, _targetVec.z);
          let diff = localTargetAngle - characterRef.current.rotation.y;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          characterRef.current.rotation.y += diff * 15 * delta;
        }

        // Force Shoot Animation
        const shootAction = actions[animationSet.shoot];
        if (shootAction && shootAction !== activeAction.current) {
          shootAction.reset().play();
          if (activeAction.current) activeAction.current.crossFadeTo(shootAction, 0.1, true);
          activeAction.current = shootAction;
        }

        // Check if animation lock is over
        if (now - attackTimer[0] > ATTACK_DURATION) {
          charState[0] = 0; // Return to normal
        }
      }
    } else if (charState[0] === 2) { 
      // == STATE: CHASING ==
      if (isMovingInput) {
        // Cancel chase if player moves manually
        charState[0] = 0;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
      } else if (hasTarget[0]) {
        const dx = aimTargetX[0] - _charPos.x;
        const dz = aimTargetZ[0] - _charPos.z;
        const distSq = dx*dx + dz*dz;
        
        if (distSq <= ATTACK_RANGE_SQ) {
          // Reached Target! Stop and Attack
          charState[0] = 1; 
          attackTimer[0] = now;
          autoFireTimer[0] = now;
          ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
          executeAttack(nearestTarget);
        } else {
          // Keep Chasing (Spoof Joystick Input to run to target)
          _chaseDir.set(dx, 0, dz).normalize();
          
          camera.getWorldDirection(_camProjDir);
          _camProjDir.y = 0;
          _camProjDir.normalize();
          
          // Calculate standard right vector based on camera
          _camRightDir.set(1, 0, 0).applyQuaternion(camera.quaternion);
          _camRightDir.y = 0;
          _camRightDir.normalize();
          
          // Project world direction onto camera's local axes to fake joystick
          const moveY = _chaseDir.dot(_camProjDir);
          const moveX = _chaseDir.dot(_camRightDir);
          
          ecctrlRef.current?.setMovement({ 
            joystick: { x: moveX, y: moveY },
            run: true // Force run mode while chasing
          });
          
          // Reset rotation offset to 0 so character faces movement direction
          const resetLerpT = Math.min(1, 10 * delta);
          characterRef.current.rotation.y += (0 - characterRef.current.rotation.y) * resetLerpT;
        }
      } else {
        // Target lost
        charState[0] = 0;
        ecctrlRef.current?.setMovement({ joystick: { x: 0, y: 0 } });
      }
    } 

    if (charState[0] === 0) {
      // == STATE: NORMAL ==
      // Revert animation if stuck in shoot
      if (activeAction.current === actions[animationSet.shoot]) {
         const animName = ecctrlAnimationSet[characterStatus.animationStatus] ?? animationSet.idle;
         const nextAction = actions[animName];
         if (nextAction && nextAction !== activeAction.current) {
            nextAction.reset().fadeIn(0.1).play();
            if (activeAction.current) activeAction.current.crossFadeTo(nextAction, 0.2, true);
            activeAction.current = nextAction;
         }
      }
      
      // Revert local rotation offset
      const resetLerpT = Math.min(1, 10 * delta);
      characterRef.current.rotation.y += (0 - characterRef.current.rotation.y) * resetLerpT;
    }
  }, -1); // priority -1: runs before physics

  // ─── RENDER ──────────────────────────────────────────────────────────────
  return (
    <>
      <ProjectilePool 
        ref={poolRef} 
        damageQueue={damageQueue} 
        dealPlayerDamage={dealPlayerDamage}
      />

      <BVHEcctrl
        ref={ecctrlRef}
        paused={paused}
        position={[0, 3, 0]}
        floatHeight={0.3}
        floatSensorRadius={0.3}
        delay={0.5}
        colliderCapsuleArgs={[0.4, 1.2, 4, 8]}
        maxWalkSpeed={3.5}
        maxRunSpeed={6}
        turnSpeed={20}
        jumpVel={4} 
        collisionCheckIteration={15} 
        collisionPushBackVelocity={1.5} 
        collisionPushBackDamping={0.05}
        collisionPushBackThreshold={0.01}
      >
        <group ref={characterRef} dispose={null} position={[0, -1.3, 0]}>
          <primitive object={scene} />
        </group>
      </BVHEcctrl>
    </>
  );
};
