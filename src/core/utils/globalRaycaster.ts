import * as THREE from "three";

// Zero-allocation raycaster setup
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true; 
const origin = new THREE.Vector3();
const direction = new THREE.Vector3(0, -1, 0); // Downward

// Global list of meshes to raycast against
const colliders: THREE.Mesh[] = [];

export const registerCollider = (mesh: THREE.Mesh) => {
    if (!colliders.includes(mesh)) {
        colliders.push(mesh);
    }
};

export const unregisterCollider = (mesh: THREE.Mesh) => {
    const idx = colliders.indexOf(mesh);
    if (idx !== -1) {
        colliders.splice(idx, 1);
    }
};

export const getGroundHeight = (x: number, z: number, fallbackY: number): number => {
    if (colliders.length === 0) return fallbackY;

    // Start raycast from high above
    origin.set(x, 200, z);
    raycaster.set(origin, direction);

    const hits = raycaster.intersectObjects(colliders, false);
    if (hits.length > 0) {
        return hits[0].point.y;
    }

    return fallbackY;
};
