/**
 * PlayerECS — Zero-GC Player State Store
 *
 * Menggantikan useState/useRef yang tersebar di PlayerController.
 * Semua state disimpan dalam TypedArrays (SAB-friendly), tidak ada GC pressure.
 * Satu instance global — dibaca langsung dari useFrame tanpa closure capture.
 */

// ─── COMPONENT BUFFERS ──────────────────────────────────────────────────────
// Index 0 = player slot (only 1 player, no need for multi-entity array)

export const PlayerInput = {
  forward:  new Int8Array(1),   // 0|1
  backward: new Int8Array(1),
  leftward: new Int8Array(1),
  rightward:new Int8Array(1),
  run:      new Int8Array(1),
  jump:     new Int8Array(1),
  action1:  new Int8Array(1),
  mouseX:   new Float32Array(1),  // accumulated delta since last frame
  mouseY:   new Float32Array(1),
  playerPosition: new Float32Array(3), // [x, y, z] Zero-GC tracking
};

export const PlayerCamera = {
  yaw:   new Float32Array(1),    // current yaw in radians
  pitch: new Float32Array(1),    // current pitch in radians
  zoom:  new Float32Array(1),    // current zoom distance
  zoomTarget: new Float32Array(1),
};

export const PlayerCombat = {
  lastShotTime: new Float64Array(1),  // performance.now()
  isLeftClick:  new Int8Array(1),
};

export const PlayerFlags = {
  paused:   new Int8Array(1),   // 1 = paused (BVH not ready)
  envReady: new Int8Array(1),   // 1 = terrain BVH registered
};

// Initialize defaults
PlayerCamera.pitch[0] = 0.3;
PlayerCamera.zoom[0]  = 5.0;
PlayerCamera.zoomTarget[0] = 5.0;

// ─── SYSTEM FUNCTIONS (pure, called from useFrame) ──────────────────────────

const ZOOM_MIN  = 1.5;
const ZOOM_MAX  = 20.0;
const ZOOM_LERP = 10.0;

/** Apply zoom wheel delta (called from event listener, not render loop) */
export function applyZoomDelta(delta: number) {
  const next = PlayerCamera.zoomTarget[0] + delta * 0.01 * 2.0;
  PlayerCamera.zoomTarget[0] = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, next));
}

/** Rotate camera yaw/pitch by mouse delta (called from event listener) */
export function applyMouseDelta(dx: number, dy: number, sensitivity: number) {
  PlayerCamera.yaw[0]   -= dx * sensitivity;
  PlayerCamera.pitch[0] -= dy * sensitivity;
  PlayerCamera.pitch[0]  = Math.max(-0.4, Math.min(1.1, PlayerCamera.pitch[0]));
}

/** Lerp zoom each frame (call from useFrame) */
export function tickZoom(delta: number) {
  PlayerCamera.zoom[0] = lerp(
    PlayerCamera.zoom[0],
    PlayerCamera.zoomTarget[0],
    Math.min(1, ZOOM_LERP * delta)
  );
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
