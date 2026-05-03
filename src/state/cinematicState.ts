/**
 * Shared mutable state for the cinematic camera system.
 * Written by CameraDirector, read by environment components (Forest, etc.)
 * Using a plain object instead of React state to avoid re-renders.
 */
export const cinematicState = {
  isActive: false,
  focusX: 0,
  focusY: 1.5,
  focusZ: 0,
  // Dynamic camera configurations controllable via Leva
  angles: [
    { x: -24, y: 18, z: 24, name: 'Angle 1' },
    { x: 28, y: 20, z: -28, name: 'Angle 2' },
    { x: 32, y: 22, z: 32, name: 'Angle 3' },
    { x: 24, y: 18, z: 24, name: 'Angle 4' },
    { x: 0, y: 22, z: 30, name: 'Angle 5' },
    { x: -28, y: 20, z: -28, name: 'Angle 6' },
  ],
  siege: {
    defenderY: 22,
    defenderDist: 25,
    frontalY: 20,
    frontalDist: 30
  }
};
