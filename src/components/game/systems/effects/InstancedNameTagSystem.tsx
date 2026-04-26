'use client';
import React, { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { UnitRuntimeData, WORLD_UNIT_POOL_SIZE } from '@/src/core/domain/unit.types';

interface NameTagProps {
    unitRegistry: React.RefObject<UnitRuntimeData[]>;
}

// ─── Atlas Config ─────────────────────────────────────────────────────────────
// 512×512 atlas, 32×32 slots = 256 possible unique users in GPU VRAM = 1MB only
const ATLAS_SIZE = 512;
const SLOT_SIZE = 32;
const SLOTS_PER_ROW = ATLAS_SIZE / SLOT_SIZE; // = 16

// ─── Billboard Shader: renders texture atlas UV on a flat plane facing camera ──
const BillboardMaterial = (atlas: THREE.CanvasTexture) => new THREE.ShaderMaterial({
    uniforms: { uAtlas: { value: atlas } },
    vertexShader: `
        attribute vec2 aUv;
        varying vec2 vUv;
        void main() {
            vUv = aUv;
            // True billboard: extract position from instanceMatrix, then offset local vertices
            vec3 worldPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
            float sc = instanceMatrix[0][0]; // uniform scale stored in m00
            vec4 camPos = viewMatrix * vec4(worldPos, 1.0);
            camPos.xy += position.xy * sc;
            gl_Position = projectionMatrix * camPos;
        }
    `,
    fragmentShader: `
        uniform sampler2D uAtlas;
        varying vec2 vUv;
        void main() {
            vec4 col = texture2D(uAtlas, vUv);
            // Discard pixels outside the circle (UV center = 0.5,0.5)
            vec2 d = vUv - 0.5;
            // Scale d back to local slot space
            if (length(d * float(${SLOTS_PER_ROW})) > 0.45) discard;
            if (col.a < 0.05) discard;
            gl_FragColor = col;
        }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
});

// ─── Main Component ───────────────────────────────────────────────────────────
export function InstancedNameTagSystem({ unitRegistry }: NameTagProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);

    // Canvas atlas — created once
    const canvas = useMemo(() => {
        const c = document.createElement('canvas');
        c.width = ATLAS_SIZE;
        c.height = ATLAS_SIZE;
        return c;
    }, []);

    const ctx = useMemo(() => canvas.getContext('2d', { alpha: true })!, [canvas]);

    const texture = useMemo(() => {
        const t = new THREE.CanvasTexture(canvas);
        t.minFilter = THREE.LinearFilter;
        t.magFilter = THREE.LinearFilter;
        t.generateMipmaps = false;
        t.flipY = false;
        return t;
    }, [canvas]);

    // Slot management (ref-based, zero GC)
    const userSlots = useRef<Map<string, { u: number; v: number }>>(new Map());
    const nextSlot = useRef(0);

    // Per-instance UV attribute (u,v of slot bottom-left in atlas 0..1)
    const uvArray = useMemo(() => new Float32Array(WORLD_UNIT_POOL_SIZE * 2), []);
    const uvAttr = useMemo(() => {
        const a = new THREE.InstancedBufferAttribute(uvArray, 2);
        a.setUsage(THREE.DynamicDrawUsage);
        return a;
    }, [uvArray]);

    // Geometry: flat unit quad, UV covers [0,0]→[1,1] (one full slot)
    const geometry = useMemo(() => {
        const g = new THREE.PlaneGeometry(1, 1);
        // Remap UV to [0,0]→[1/SLOTS_PER_ROW, 1/SLOTS_PER_ROW] (one slot)
        const uv = g.attributes.uv as THREE.BufferAttribute;
        const slotUV = 1 / SLOTS_PER_ROW;
        for (let i = 0; i < uv.count; i++) {
            uv.setXY(i, uv.getX(i) * slotUV, uv.getY(i) * slotUV);
        }
        g.setAttribute('aUv', new THREE.InstancedBufferAttribute(uvArray, 2));
        return g;
    }, [uvArray]);

    const material = useMemo(() => BillboardMaterial(texture), [texture]);

    // ─── Draw single user slot to canvas (async non-blocking) ─────────────────
    const drawSlot = (slot: number, profileUrl?: string) => {
        const col = slot % SLOTS_PER_ROW;
        const row = Math.floor(slot / SLOTS_PER_ROW);
        const px = col * SLOT_SIZE;
        const py = row * SLOT_SIZE;
        const cx = px + SLOT_SIZE / 2;
        const cy = py + SLOT_SIZE / 2;
        const r = SLOT_SIZE / 2 - 1;

        const drawCircle = (img?: ImageBitmap) => {
            ctx.clearRect(px, py, SLOT_SIZE, SLOT_SIZE);
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.clip();
            if (img) {
                ctx.drawImage(img, px, py, SLOT_SIZE, SLOT_SIZE);
            } else {
                // Fallback: team-colored circle (drawn in useFrame based on unit.type)
                const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
                grad.addColorStop(0, '#aaccff');
                grad.addColorStop(1, '#0044cc');
                ctx.fillStyle = grad;
                ctx.fill();
            }
            // White border
            ctx.restore();
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, r - 0.5, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(255,255,255,0.9)';
            ctx.stroke();
            ctx.restore();
            texture.needsUpdate = true;
        };

        if (!profileUrl) {
            drawCircle();
            return;
        }

        // Use createImageBitmap — fully async, never blocks main thread
        const proxied = `https://wsrv.nl/?url=${encodeURIComponent(profileUrl)}&w=${SLOT_SIZE}&h=${SLOT_SIZE}&fit=cover&output=webp`;
        fetch(proxied)
            .then(r => r.blob())
            .then(b => createImageBitmap(b, { resizeWidth: SLOT_SIZE, resizeHeight: SLOT_SIZE }))
            .then(drawCircle)
            .catch(() => drawCircle()); // fallback on error
    };

    // Sync uvAttr to geometry when mesh mounts
    useEffect(() => {
        if (!meshRef.current) return;
        meshRef.current.geometry.setAttribute('aUv', uvAttr);
    }, []); // eslint-disable-line

    // ─── useFrame: pure matrix+UV packing, zero canvas work ──────────────────
    useFrame((state) => {
        if (!meshRef.current || !unitRegistry.current) return;

        const units = unitRegistry.current;
        const mesh = meshRef.current;
        const mat = mesh.instanceMatrix.array as Float32Array;
        const cam = state.camera.position;
        let n = 0;

        for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
            const u = units[i];
            if (!u || !u.isActive || u.hp <= 0) continue;

            const dx = cam.x - u.position[0];
            const dz = cam.z - u.position[2];
            if (dx * dx + dz * dz > 40 * 40) continue;

            // Ensure user has a slot (draw async, render immediately with placeholder)
            let slot = userSlots.current.get(u.userName || i.toString());
            if (!slot) {
                const idx = nextSlot.current;
                if (idx >= SLOTS_PER_ROW * SLOTS_PER_ROW) continue; // atlas full
                nextSlot.current++;
                const sc = 1 / SLOTS_PER_ROW;
                const col = idx % SLOTS_PER_ROW;
                const rw = Math.floor(idx / SLOTS_PER_ROW);
                slot = { u: col * sc, v: rw * sc };
                userSlots.current.set(u.userName || i.toString(), slot);
                // Fire async draw (non-blocking)
                drawSlot(idx, u.profileImage);
            }

            const yOff = u.isBoss ? 8.0 : 3.8;
            const scale = u.isBoss ? 2.0 : 1.0;
            const o = n * 16;

            // Compact scale-only matrix (billboard shader reads worldPos from [3][x])
            mat[o + 0] = scale; mat[o + 1] = 0; mat[o + 2] = 0; mat[o + 3] = 0;
            mat[o + 4] = 0; mat[o + 5] = scale; mat[o + 6] = 0; mat[o + 7] = 0;
            mat[o + 8] = 0; mat[o + 9] = 0; mat[o + 10] = scale; mat[o + 11] = 0;
            mat[o + 12] = u.position[0];
            mat[o + 13] = u.position[1] + yOff;
            mat[o + 14] = u.position[2];
            mat[o + 15] = 1;

            // UV: bottom-left corner of slot in atlas space
            uvArray[n * 2 + 0] = slot.u;
            uvArray[n * 2 + 1] = slot.v;
            n++;
        }

        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        if (n > 0) uvAttr.needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, WORLD_UNIT_POOL_SIZE]}
            frustumCulled={false}
            renderOrder={10}
        />
    );
}
