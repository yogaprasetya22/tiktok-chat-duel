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
};
