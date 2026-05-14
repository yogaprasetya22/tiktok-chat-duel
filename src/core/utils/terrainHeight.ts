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
  baseDistance: number = 24
): number {
  const dist = Math.sqrt(x * x + z * z);
  let elevation = 0;
  
  if (environmentType === "STORM" || environmentType === "RAIN" || environmentType === "THUNDER" || environmentType === "CLEAR") {
    // StormEnvironment / Open World style
    const mask = THREE.MathUtils.smoothstep(dist, baseDistance + 10.0, baseDistance + 60.0);
    elevation += noise.noise(x * 0.008, z * 0.008) * 35.0;
    elevation += noise.noise(x * 0.025, z * 0.025) * 10.0;
    elevation += noise.noise(x * 0.08, z * 0.08) * 3.0;
    elevation *= mask;
  } else {
    // WhimsicalDiorama style
    const mask = THREE.MathUtils.smoothstep(dist, baseDistance + 15.0, baseDistance + 50.0);
    elevation += noise.noise(x * 0.015, z * 0.015) * 35.0;
    elevation += noise.noise(x * 0.04, z * 0.04) * 8.0;
    elevation *= mask;
  }

  return Math.max(elevation, 0.0);
}
