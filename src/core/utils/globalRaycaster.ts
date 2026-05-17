import * as THREE from "three";

// Zero-allocation raycaster setup
const raycaster = new THREE.Raycaster();
raycaster.firstHitOnly = true; 
const origin = new THREE.Vector3();
const direction = new THREE.Vector3(0, -1, 0); // Downward

// Global list of meshes to raycast against
export const colliders: THREE.Mesh[] = [];
if (typeof window !== 'undefined') (window as any).globalColliders = colliders;

export const registerCollider = (obj: THREE.Object3D) => {
    if (!obj) return;
    obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            if (!colliders.includes(mesh)) {
                colliders.push(mesh);
            }
        }
    });
};

export const unregisterCollider = (obj: THREE.Object3D) => {
    if (!obj) return;
    obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
            const idx = colliders.indexOf(child as THREE.Mesh);
            if (idx !== -1) {
                colliders.splice(idx, 1);
            }
        }
    });
};

export const getGroundHeight = (x: number, z: number, fallbackY: number): number => {
    if (colliders.length === 0) return fallbackY;

    // Start raycast from high above
    origin.set(x, 200, z);
    raycaster.set(origin, direction);

    const hits = raycaster.intersectObjects(colliders, false);
    if (hits.length > 0) {
        // Prioritize hitting the terrain mesh directly to avoid snapping to trees or high obstacles
        const terrainHit = hits.find(h => h.object.name === "terrain");
        if (terrainHit) {
            return terrainHit.point.y;
        }
        return hits[0].point.y;
    }

    return fallbackY;
};

if (typeof window !== 'undefined') (window as any).getGroundHeight = getGroundHeight;
