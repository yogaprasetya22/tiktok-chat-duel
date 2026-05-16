import { SimplexNoise } from "three-stdlib";
import * as THREE from "three";

// Simple seeded random for SimplexNoise
const createSeededRandom = (seed: string) => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    return {
        random: () => {
            h = (Math.imul(1103515245, h) + 12345) & 0x7fffffff;
            return (h >>> 0) / 0x80000000;
        }
    };
};

const noise = new SimplexNoise(createSeededRandom("SEAL_M_STABLE_SEED") as any);

export function getTerrainElevation(
  x: number, 
  z: number, 
  environmentType: "STORM" | "DIORAMA" | string, 
  baseDistance: number = 24,
  config?: { height: number, scale: number, seed: number }
): number {
  const dist = Math.sqrt(x * x + z * z);
  let elevation = 0;
  
  const h = config?.height ?? 35.0;
  const s = config?.scale ?? 1.0;
  const seed = config?.seed ?? 0;

  if (environmentType === "STORM" || environmentType === "RAIN" || environmentType === "THUNDER" || environmentType === "CLEAR") {
    // StormEnvironment / Open World style
    const mask = THREE.MathUtils.smoothstep(dist, baseDistance + 10.0, baseDistance + 60.0);
    // Apply dynamic config to the main noise layers
    elevation += noise.noise((x + seed) * 0.008 * s, (z + seed) * 0.008 * s) * h;
    elevation += noise.noise((x + seed) * 0.025 * s, (z + seed) * 0.025 * s) * (h * 0.3);
    elevation += noise.noise((x + seed) * 0.08 * s, (z + seed) * 0.08 * s) * (h * 0.1);
    elevation *= mask;
  } else {
    // WhimsicalDiorama style
    const mask = THREE.MathUtils.smoothstep(dist, baseDistance + 15.0, baseDistance + 50.0);
    elevation += noise.noise((x + seed) * 0.015 * s, (z + seed) * 0.015 * s) * h;
    elevation += noise.noise((x + seed) * 0.04 * s, (z + seed) * 0.04 * s) * (h * 0.2);
    elevation *= mask;
  }

  return Math.max(elevation, 0.0);
}
