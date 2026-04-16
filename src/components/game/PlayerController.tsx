'use client';

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls, useAnimations, useGLTF } from '@react-three/drei';
import BVHEcctrl, { useAnimationStore, characterStatus } from 'bvhecctrl';
import * as THREE from 'three';
import { useVFX } from './systems/VFXManager';
import ProjectilePool, { ProjectilePoolHandle } from './systems/ProjectilePool';

// =============================================================================
//  PENJELASAN UNTUK PEMULA:
//
//  BVHEcctrl adalah "controller" yang mengurus:
//    ✅ Posisi karakter (via capsule physics)
//    ✅ Collision dengan environment (via StaticCollider di terrain)
//    ✅ Rotasi/putar karakter ke arah jalan (via turnSpeed)
//    ✅ Arah "maju" = ke arah mana camera menghadap
//
//  Kita TIDAK boleh mengubah rotation characterRef secara manual karena
//  itu akan konflik dengan BVHEcctrl dan merusak collision.
//
//  Yang kita urus sendiri:
//    ✅ Posisi & arah camera (offset dari karakter)
//    ✅ Menembak peluru
//    ✅ Sync animasi
// =============================================================================

const animationSet = {
  idle:    'Idle',
  walk:    'Walk',
  run:     'Run',
  jump:    'Jump',
  shoot:   'Shoot_OneHanded',
};

// Pemetaan state ecctrl langsung ke nama animasi di GLB
const ecctrlAnimationSet = {
  IDLE:       animationSet.idle,
  WALK:       animationSet.walk,
  RUN:        animationSet.run,
  JUMP_START: animationSet.jump,
  JUMP_IDLE:  animationSet.jump,
  JUMP_FALL:  animationSet.jump,
  JUMP_LAND:  animationSet.idle,
  // action1 might be manual
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

// ─── Pre-allocated objects (zero GC / frame) ─────────────────────────────────
const _charPos    = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camPos     = new THREE.Vector3();
const _lookAt     = new THREE.Vector3();
const _camTarget  = new THREE.Vector3();
const _origin     = new THREE.Vector3();
const _camDir     = new THREE.Vector3();
const _fwd        = new THREE.Vector3();

// Zoom constants
const ZOOM_MIN     = 1.5;   // jarak minimum (shoulder cam)
const ZOOM_MAX     = 20.0;  // jarak maksimum (jauh)
const ZOOM_DEFAULT = 5.0;   // jarak awal
const ZOOM_SPEED   = 2.0;   // seberapa besar 1 scroll mengubah zoom
const ZOOM_LERP    = 10.0;  // kecepatan smooth zoom (makin besar = makin snappy)

export const PlayerController = ({ damageQueue }: { damageQueue?: React.RefObject<any[]> }) => {
  const poolRef      = useRef<ProjectilePoolHandle>(null);
  const characterRef = useRef<THREE.Group>(null);
  const { camera }   = useThree();

  const { scene, animations } = useGLTF("/assets-model/Chef_Male.glb");
  const { actions }  = useAnimations(animations, characterRef);

  const animationStatus = useAnimationStore((s) => s.animationStatus);
  const [, getKeys]     = useKeyboardControls();
  const { spawnVFX }    = useVFX();

  // ─── 1. SYNC ANIMASI (crossFade system) ──────────────────────────────────────
  // Gunakan ref untuk track animasi aktif agar bisa crossFade (bukan reset)
  // crossFadeTo: fade OUT animasi lama + fade IN animasi baru secara bersamaan
  // Hasilnya: transisi halus antar animasi (contoh: Jump → Idle tanpa snap)
  const activeAction = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    // BVHEcctrl uses uppercase status like "IDLE", "WALK", etc.
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

  // ─── 2. MOUSE LOOK ───────────────────────────────────────────────────────────
  //   yaw   = putar horizontal (kiri-kanan) — dikendalikan mouse X
  //   pitch = tilt vertikal (atas-bawah) — dikendalikan mouse Y
  const SENSITIVITY = 0.002;
  const mouse = useRef({ yaw: 0, pitch: 0.3 });

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!document.pointerLockElement) return;
      
      // YAW: mouse kanan (movementX +) → yaw berkurang → kamera orbit ke kanan ✓
      // PENTING: tanda MINUS agar tidak inverted!
      mouse.current.yaw -= e.movementX * SENSITIVITY;
      
      // movementY: negatif = mouse ke ATAS, positif = mouse ke BAWAH
      // pitch besar → kamera di atas  (mendongak)
      // pitch kecil → kamera di bawah (menunduk)
      // mouse ke atas (movementY -) → pitch harus BERTAMBAH → gunakan -= (minus negatif = tambah)
      mouse.current.pitch -= e.movementY * SENSITIVITY;
      mouse.current.pitch = Math.max(-0.4, Math.min(1.1, mouse.current.pitch));
    };

    const onMouseDown = () => {
      // Klik di mana saja → aktifkan pointer lock agar mouse terkunci
      if (!document.pointerLockElement) {
        document.querySelector('canvas')?.requestPointerLock();
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  // ─── Zoom (scroll wheel, style Roblox) ────────────────────────────────────
  // Semua disimpan di ref = zero re-render, sangat efisien
  const zoomTarget  = useRef(ZOOM_DEFAULT);  // target zoom yang ingin dicapai
  const zoomActual  = useRef(ZOOM_DEFAULT);  // zoom aktual (di-lerp setiap frame)

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); // cegah halaman scroll
      // deltaY positif = scroll ke bawah = zoom out (jarak tambah)
      // deltaY negatif = scroll ke atas  = zoom in  (jarak kurang)
      zoomTarget.current += e.deltaY * 0.01 * ZOOM_SPEED;
      // Clamp dalam batas min-max
      zoomTarget.current = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomTarget.current));
    };
    // { passive: false } wajib agar preventDefault() bisa jalan
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  // ─── Camera frame update (Priority -1) ────────────────────────────────────
  const EYE_HEIGHT  = 1.6;
  const hasCamInit  = useRef(false);

  useFrame((_, delta) => {
    _charPos.copy(characterStatus.position as THREE.Vector3);

    const yaw   = mouse.current.yaw;
    const pitch = mouse.current.pitch;

    // ─── Smooth zoom (Roblox style) ─────────────────────────────────────────
    // Lerp jarak aktual mendekati target setiap frame → gerakan zoom terasa halus
    zoomActual.current = THREE.MathUtils.lerp(
      zoomActual.current,
      zoomTarget.current,
      Math.min(1, ZOOM_LERP * delta)
    );
    const CAMERA_DIST = zoomActual.current;

    // ─── Posisi kamera TPS ──────────────────────────────────────────────────
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

  }, -1);

  // ─── 4. GAME LOGIC (shooting, dll) — Priority 0 (default) ───────────────────
  const lastShot  = useRef(0);
  const FIRE_RATE = 200; // ms antar tembakan

  useFrame(() => {
    if (!document.pointerLockElement) return;

    const keys = getKeys();
    const now  = performance.now();

    if (keys.action1 && now - lastShot.current > FIRE_RATE) {
      // Ambil posisi karakter terbaru
      _charPos.copy(characterStatus.position as THREE.Vector3);

      // Arah tembak = ke mana kamera menghadap (sudah benar karena camera update duluan)
      camera.getWorldDirection(_camDir);

      // Spawn peluru dari sekitar dada/bahu karakter
      _origin.copy(_charPos);
      _origin.y += 1.35;
      _fwd.copy(_camDir).multiplyScalar(0.7);
      _origin.add(_fwd);

      poolRef.current?.fire(_origin, _camDir);
      spawnVFX([_origin.x, _origin.y, _origin.z], 'muzzle', '#ffaa00');
      lastShot.current = now;
    }
  }); // priority default (0) — jalan setelah camera update (-1)

  return (
    <>
      <ProjectilePool ref={poolRef} damageQueue={damageQueue} />

      {/*
        BVHEcctrl — controller karakter
        
        Props collision:
          floatHeight    = tinggi karakter melayang di atas tanah
          maxSlope       = kemiringan tanah maksimum yang bisa didaki
        
        Props movement:
          maxWalkSpeed   = kecepatan jalan
          maxRunSpeed    = kecepatan lari (Shift)
          turnSpeed      = kecepatan karakter berbalik arah
          acceleration   = seberapa cepat karakter mencapai kecepatan max
          deceleration   = seberapa cepat karakter berhenti

        Props lompat:
          jumpVel        = kekuatan lompatan ke atas
          gravity        = gravitasi yang menarik karakter ke bawah
          fallGravityFactor = gravitasi ekstra saat jatuh (agar terasa berat)
          
        CATATAN: BVHEcctrl otomatis baca arah kamera untuk menentukan "maju"
        dan otomatis putar karakter ke arah jalan via turnSpeed.
        Kita TIDAK perlu (dan JANGAN) set rotation manual di characterRef.
      *)*/}
      <BVHEcctrl
        // debug={true}
        delay={0}
        position={[0, 5, 0]}   // spawn di atas tanah agar tidak jatuh menembus
        floatHeight={0.3}
        maxWalkSpeed={3}
        maxRunSpeed={5}
        turnSpeed={20}
        jumpVel={5}
      >
        <group ref={characterRef} dispose={null}>
          <primitive object={scene} />
        </group>
      </BVHEcctrl>
    </>
  );
};
