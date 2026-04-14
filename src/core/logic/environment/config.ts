export interface EnvironmentAsset {
    id: string;
    modelPath: string;
    instanced?: boolean;
    defaultScale?: number;
    spread?: {
        minScale: number;
        maxScale: number;
        rotateX?: boolean;
        rotateY?: boolean;
        rotateZ?: boolean;
    };
}

export const ENVIRONMENT_ASSETS: Record<string, EnvironmentAsset> = {
    POHON_A: {
        id: "tree_pine",
        modelPath: "/models/env/tree_pine.glb",
        defaultScale: 1.5,
        spread: { minScale: 1.2, maxScale: 1.8, rotateY: true }
    },
    POHON_B: {
        id: "tree_oak",
        modelPath: "/models/env/tree_oak.glb",
        defaultScale: 1.2,
        spread: { minScale: 0.9, maxScale: 1.5, rotateY: true }
    },
    BATU_BESAR: {
        id: "rock_large",
        modelPath: "/models/env/rock_large.glb",
        defaultScale: 2.0,
        spread: { minScale: 1.5, maxScale: 2.5, rotateY: true, rotateZ: true }
    },
    RUMPUT: {
        id: "grass_tuft",
        modelPath: "/models/env/grass_tuft.glb",
        defaultScale: 0.8,
        spread: { minScale: 0.6, maxScale: 1.2, rotateY: true }
    }
};
