import { UnitRuntimeData } from "@/src/core/domain/unit.types";

/**
 * High-performance Spatial Hash Grid for fast unit lookups.
 * Optimized for targeting AI to replace O(N^2) loops.
 */
/**
 * Zero-Allocation Spatial Hash Grid for ultra-fast unit lookups.
 * Designed to minimize GC pressure even with hundreds of units.
 */
export class SpatialHashGrid {
    private grid: Map<number, UnitRuntimeData[]>;
    private cellSize: number;
    private cellPool: UnitRuntimeData[][];
    private poolIdx: number = 0;

    constructor(cellSize: number = 5) {
        this.grid = new Map();
        this.cellSize = cellSize;
        // Pre-allocate arrays for cells to avoid GC churn
        this.cellPool = Array.from({ length: 400 }, () => []);
    }

    private getKey(x: number, z: number): number {
        const gx = Math.floor(x / this.cellSize);
        const gz = Math.floor(z / this.cellSize);
        return (gx + 1000) + ((gz + 1000) * 10000);
    }

    /**
     * Rebuilds the grid. Reuses the arrays in the pool.
     */
    private activeKeys: number[] = [];

    update(units: UnitRuntimeData[], activeIndices?: number[]) {
        // FIX: Clear used cells by tracking active keys instead of forEach
        for (let k = 0; k < this.activeKeys.length; k++) {
            const cell = this.grid.get(this.activeKeys[k]);
            if (cell) cell.length = 0;
        }
        this.activeKeys.length = 0;
        this.grid.clear();
        this.poolIdx = 0;

        if (activeIndices) {
            for (let k = 0; k < activeIndices.length; k++) {
                const i = activeIndices[k];
                const u = units[i];
                if (!u || !u.isActive || u.hp <= 0 || u.isDying) continue;
                this.insert(u);
            }
        } else {
            for (let i = 0; i < units.length; i++) {
                const u = units[i];
                if (!u.isActive || u.hp <= 0 || u.isDying) continue;
                this.insert(u);
            }
        }
    }

    private insert(u: UnitRuntimeData) {
        const key = this.getKey(u.position[0], u.position[2]);
        let cell = this.grid.get(key);
        if (!cell) {
            cell = this.cellPool[this.poolIdx++];
            if (!cell) {
                cell = [];
                this.cellPool.push(cell);
                this.poolIdx = this.cellPool.length;
            }
            this.grid.set(key, cell);
            this.activeKeys.push(key); // Track for fast clear
        }
        cell.push(u);
    }

    private resultBuffer: UnitRuntimeData[] = [];

    queryRadius(x: number, z: number, radius: number): UnitRuntimeData[] {
        this.resultBuffer.length = 0;
        const rsSq = radius * radius;
        
        const gxMin = Math.floor((x - radius) / this.cellSize);
        const gxMax = Math.floor((x + radius) / this.cellSize);
        const gzMin = Math.floor((z - radius) / this.cellSize);
        const gzMax = Math.floor((z + radius) / this.cellSize);

        for (let gx = gxMin; gx <= gxMax; gx++) {
            for (let gz = gzMin; gz <= gzMax; gz++) {
                const key = (gx + 1000) + ((gz + 1000) * 10000);
                const cell = this.grid.get(key);
                if (cell) {
                    for (let i = 0; i < cell.length; i++) {
                        const u = cell[i];
                        const dx = u.position[0] - x;
                        const dz = u.position[2] - z;
                        if (dx * dx + dz * dz <= rsSq) {
                            this.resultBuffer.push(u);
                        }
                    }
                }
            }
        }
        return this.resultBuffer;
    }
}

export const battleGrid = new SpatialHashGrid(12); // Slightly larger cells for better performance
if (typeof window !== 'undefined') (window as any).battleGrid = battleGrid;
