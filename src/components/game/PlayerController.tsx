'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF } from '@react-three/drei';
import BVHEcctrl, { useAnimationStore, characterStatus } from 'bvhecctrl';
import * as THREE from 'three';
import { useVFX } from './systems/VFXManager';
import ProjectilePool, { ProjectilePoolHandle } from './systems/ProjectilePool';
import { useStore } from '@/src/state/useStore';

const animationSet = {
  idle:    'Idle',
  walk:    'Walk',
  run:     'Run',
  jump:    'Jump',
  shoot:   'Shoot_OneHanded',
};

const ecctrlAnimationSet = {
  IDLE:       animationSet.idle,
  WALK:       animationSet.walk,
  RUN:        animationSet.run,
  JUMP_START: animationSet.jump,
  JUMP_IDLE:  animationSet.jump,
  JUMP_FALL:  animationSet.jump,
  JUMP_LAND:  animationSet.idle,
};

export const keyboardMap = [
  { name: "forward",   keys: ["ArrowUp",    "KeyW"] },
  { name: "backward",  keys: ["ArrowDown",  "KeyS"] },
  { name: "leftward",  keys: ["ArrowLeft",  "KeyA"] },
  { name: "rightward", keys: ["ArrowRight", "KeyD"] },
  { name: "jump",      keys: ["Space"] },
  { name: "run",       keys: ["Shift"] },
  { name: "action1",   keys: ["KeyF", "KeyE"] },
];

const _charPos    = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camPos     = new THREE.Vector3();
const _lookAt     = new THREE.Vector3();
const _camTarget  = new THREE.Vector3();
const _camDir     = new THREE.Vector3();

const ZOOM_MIN     = 1.5;
const ZOOM_MAX     = 20.0;
const ZOOM_DEFAULT = 5.0;
const ZOOM_SPEED   = 2.0;
const ZOOM_LERP    = 10.0;

export const PlayerController = ({ damageQueue, settingsRef }: { damageQueue?: React.RefObject<any[]>, settingsRef: React.RefObject<any> }) => {
  const poolRef      = useRef<ProjectilePoolHandle>(null);
  const characterRef = useRef<THREE.Group>(null);
  const { camera }   = useThree();

  const { scene, animations } = useGLTF("/assets-model/Chef_Male.glb");
  const { actions }  = useAnimations(animations, characterRef);

  const animationStatus = useAnimationStore((s) => s.animationStatus);
  const [, getKeys]     = useKeyboardControls();
  const { spawnVFX }    = useVFX();

  const activeAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    const animName = ecctrlAnimationSet[animationStatus as keyof typeof ecctrlAnimationSet] || animationSet.idle;
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

  // ─── CAMERA CONTROLS (RPG STYLE) ───────────────────────────────────────────
  const mouse = useRef({ yaw: 0, pitch: 0.3 });
  const isRightClicking = useRef(false);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isRightClicking.current) return;
      
      const sensitivity = settingsRef.current.mouseSensitivity || 0.002;
      mouse.current.yaw -= e.movementX * sensitivity;
      mouse.current.pitch -= e.movementY * sensitivity;
      mouse.current.pitch = Math.max(-0.4, Math.min(1.1, mouse.current.pitch));
    };

    const preventContext = (e: MouseEvent) => {
        if (e.button === 2) e.preventDefault();
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 2) isRightClicking.current = true;
    };
    
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 2) isRightClicking.current = false;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('contextmenu', preventContext);
    
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('contextmenu', preventContext);
    };
  }, []);

  const isLeftClicking = useRef(false);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button === 0) isLeftClicking.current = true;
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) isLeftClicking.current = false;
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
    };
  }, []);

  const zoomTarget  = useRef(ZOOM_DEFAULT);
  const zoomActual  = useRef(ZOOM_DEFAULT);

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTarget.current += e.deltaY * 0.01 * ZOOM_SPEED;
      zoomTarget.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomTarget.current));
    };
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  const EYE_HEIGHT  = 1.6;
  const hasCamInit  = useRef(false);

  useFrame((_, delta) => {
    _charPos.copy(characterStatus.position as THREE.Vector3);

    const yaw   = mouse.current.yaw;
    const pitch = mouse.current.pitch;

    zoomActual.current = THREE.MathUtils.lerp(
      zoomActual.current,
      zoomTarget.current,
      Math.min(1, ZOOM_LERP * delta)
    );
    const CAMERA_DIST = zoomActual.current;

    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    _camDesired.set(
      _charPos.x - Math.sin(yaw) * cosPitch * CAMERA_DIST,
      _charPos.y + sinPitch * CAMERA_DIST + EYE_HEIGHT,
      _charPos.z - Math.cos(yaw) * cosPitch * CAMERA_DIST,
    );

    if (!hasCamInit.current) {
      _camPos.copy(_camDesired);
      _lookAt.set(_charPos.x, _charPos.y + EYE_HEIGHT, _charPos.z);
      hasCamInit.current = true;
    }

    _camPos.lerp(_camDesired, Math.min(1, 14 * delta));
    camera.position.copy(_camPos);

    _camTarget.set(_charPos.x, _charPos.y + EYE_HEIGHT, _charPos.z);
    _lookAt.lerp(_camTarget, Math.min(1, 18 * delta));
    camera.lookAt(_lookAt);

    useStore.getState().setPlayerPosition([_charPos.x, _charPos.y, _charPos.z]);
  }, -1);

  const lastShot  = useRef(0);
  const FIRE_RATE = 200;
  const combatMode = useStore(s => s.combatMode);

  useFrame(() => {
    const keys = getKeys();
    const now  = performance.now();

    if ((isLeftClicking.current || keys.action1) && now - lastShot.current > FIRE_RATE) {
      _charPos.copy(characterStatus.position as THREE.Vector3);
      camera.getWorldDirection(_camDir);

      _camDir.y = 0;
      _camDir.normalize();

      const origin = new THREE.Vector3().copy(_charPos);
      origin.y += 1.35;
      const fwd = new THREE.Vector3().copy(_camDir).multiplyScalar(0.7);
      origin.add(fwd);

      spawnVFX([origin.x, origin.y, origin.z], 'muzzle', '#ffaa00');

      const LOCK_RADIUS = 15.0;
      const AOE_RADIUS = 5.0;

      let targets: THREE.Object3D[] = [];
      scene.children.forEach((child) => {
         child.traverse((obj: THREE.Object3D) => {
             if (obj.userData && obj.userData.onHit) {
                 targets.push(obj);
             }
         });
      });

      let nearestTarget: THREE.Object3D | null = null;
      let minDistance = Infinity;
      
      targets.forEach(t => {
         const targetPos = new THREE.Vector3();
         t.getWorldPosition(targetPos);
         const dist = targetPos.distanceTo(_charPos);
         if (dist < LOCK_RADIUS && dist < minDistance) {
            minDistance = dist;
            nearestTarget = t;
         }
      });

      if (nearestTarget) {
         const nPos = new THREE.Vector3();
         const target = nearestTarget as THREE.Object3D;
         target.getWorldPosition(nPos);

         if (combatMode === 'SINGLE') {
            if (target.userData.onHit) target.userData.onHit();
            if (damageQueue?.current) {
               damageQueue.current.push({
                   value: 100 + Math.random() * 400,
                   position: [nPos.x, nPos.y + 1, nPos.z],
                   isCrit: Math.random() > 0.8,
                   isMagic: false,
                   color: '#ffaa00'
               });
            }
            spawnVFX([nPos.x, nPos.y + 1, nPos.z], 'spark', '#ff0000');
         } else if (combatMode === 'AOE') {
            targets.forEach(t => {
               const tPos = new THREE.Vector3();
               t.getWorldPosition(tPos);
               if (tPos.distanceTo(nPos) <= AOE_RADIUS) {
                  if (t.userData.onHit) t.userData.onHit();
                  if (damageQueue?.current) {
                     damageQueue.current.push({
                         value: 100 + Math.random() * 400,
                         position: [tPos.x, tPos.y + 1, tPos.z],
                         isCrit: Math.random() > 0.8,
                         isMagic: false,
                         color: '#ffaa00'
                     });
                  }
                  spawnVFX([tPos.x, tPos.y + 1, tPos.z], 'spark', '#ff0000');
               }
            });
         }
      }
      poolRef.current?.fire(origin, _camDir);
      lastShot.current = now;
    }
  });

  return (
    <>
      <ProjectilePool ref={poolRef} damageQueue={damageQueue} />

      <BVHEcctrl
        // debug={true}
        delay={0}
        position={[0, 15, 0]} 
        floatHeight={0.1}
        maxWalkSpeed={3}
        onPointerCancel={true}
        maxRunSpeed={5}
        turnSpeed={20}
        jumpVel={5}
      >
        <group ref={characterRef} dispose={null} position={[0, -0.65, 0]}>
          <primitive object={scene} />
        </group>
      </BVHEcctrl>
    </>
  );
};
