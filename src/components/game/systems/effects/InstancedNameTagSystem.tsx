'use client';
import React, { useRef, useMemo, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { UnitRuntimeData, WORLD_UNIT_POOL_SIZE } from '@/src/core/domain/unit.types';

interface NameTagProps {
    unitRegistry: React.RefObject<UnitRuntimeData[]>;
}

// Atlas Configuration
const ATLAS_SIZE = 1024; // Lower resolution to prevent texture upload stalls (from 16MB to 4MB)
const SLOT_SIZE = 64;
const SLOTS_PER_ROW = Math.floor(ATLAS_SIZE / SLOT_SIZE);

const NameTagMaterial = () => new THREE.ShaderMaterial({
    uniforms: {
        uAtlas: { value: null },
    },
    vertexShader: `
        attribute vec2 aUvOffset;
        attribute vec3 aColor;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vUv = (uv / ${SLOTS_PER_ROW.toFixed(1)}) + aUvOffset;
            vColor = aColor; 

            // Make it a Billboard
            vec4 mvPosition = viewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
            
            vec3 scale;
            scale.x = length(vec3(instanceMatrix[0][0], instanceMatrix[0][1], instanceMatrix[0][2]));
            scale.y = length(vec3(instanceMatrix[1][0], instanceMatrix[1][1], instanceMatrix[1][2]));
            
            mvPosition.xy += position.xy * scale.xy;
            gl_Position = projectionMatrix * mvPosition;
        }
    `,
    fragmentShader: `
        uniform sampler2D uAtlas;
        varying vec2 vUv;
        varying vec3 vColor;
        void main() {
            vec4 texColor = texture2D(uAtlas, vUv);
            if (texColor.a < 0.1) discard;
            gl_FragColor = texColor;
        }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
});

export function InstancedNameTagSystem({ unitRegistry }: NameTagProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);

    const canvasRef = useRef<HTMLCanvasElement>(null!);
    const ctxRef = useRef<CanvasRenderingContext2D>(null!);
    const textureRef = useRef<THREE.CanvasTexture>(null!);

    const userToSlotMap = useRef<Map<string, { u: number, v: number, ready: boolean }>>(new Map());
    const nextSlotIdx = useRef(0);
    const [isReady, setIsReady] = useState(false);

    const initResources = () => {
        if (isReady) return;
        const canvas = document.createElement('canvas');
        canvas.width = ATLAS_SIZE;
        canvas.height = ATLAS_SIZE;
        const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true })!;
        ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

        canvasRef.current = canvas;
        ctxRef.current = ctx;

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        textureRef.current = texture;

        setIsReady(true);
    };

    const uvOffsetArray = useMemo(() => new Float32Array(WORLD_UNIT_POOL_SIZE * 2), []);
    const attrsRef = useRef<{ uvOffset?: THREE.InstancedBufferAttribute }>({});

    useEffect(() => {
        if (!meshRef.current) return;
        const uvAttr = new THREE.InstancedBufferAttribute(uvOffsetArray, 2);
        uvAttr.setUsage(THREE.DynamicDrawUsage);
        meshRef.current.geometry.setAttribute('aUvOffset', uvAttr);
        attrsRef.current.uvOffset = uvAttr;
    }, [uvOffsetArray]);

    const drawUserToAtlas = (username: string, slotIdx: number, profileUrl?: string) => {
        const ctx = ctxRef.current;
        if (!ctx) return;

        const col = slotIdx % SLOTS_PER_ROW;
        const row = Math.floor(slotIdx / SLOTS_PER_ROW);

        const pxX = col * SLOT_SIZE;
        const pxY = row * SLOT_SIZE;
        ctx.clearRect(pxX, pxY, SLOT_SIZE, SLOT_SIZE);

        const cx = pxX + SLOT_SIZE / 2;

        if (profileUrl) {
            const img = new Image();
            img.crossOrigin = 'Anonymous';

            // Proxy image to bypass CORS
            const proxiedUrl = `https://wsrv.nl/?url=${encodeURIComponent(profileUrl)}&w=64&h=64&fit=cover`;
            img.src = proxiedUrl;

            img.onload = () => {
                ctx.save();
                ctx.beginPath();
                // Center the image in the 64x64 slot (cx, cy)
                const cy = pxY + SLOT_SIZE / 2;
                ctx.arc(cx, cy, 26, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, cx - 26, cy - 26, 52, 52);

                // Add a cute border
                ctx.lineWidth = 3;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();
                ctx.restore();

                textureRef.current.needsUpdate = true;
            };
        } else {
            // Draw default placeholder if no profile URL
            ctx.save();
            ctx.beginPath();
            const cy = pxY + SLOT_SIZE / 2;
            ctx.arc(cx, cy, 26, 0, Math.PI * 2);
            ctx.fillStyle = '#333333';
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();
            ctx.restore();
            textureRef.current.needsUpdate = true;
        }

        const u = col / SLOTS_PER_ROW;
        const v = 1.0 - ((row + 1) / SLOTS_PER_ROW);

        userToSlotMap.current.set(username, { u, v, ready: true });
    };

    useFrame((state) => {
        if (!unitRegistry.current) return;
        const units = unitRegistry.current;

        // Lazy init on first user detection
        let hasUsers = false;
        if (!isReady) {
            for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
                if (units[i]?.isActive && units[i]?.userName) {
                    hasUsers = true;
                    break;
                }
            }
            if (hasUsers) initResources();
            return; // Wait for next frame to start rendering with texture
        }

        if (!meshRef.current) return;
        const mesh = meshRef.current;
        const uvAttr = attrsRef.current.uvOffset;
        if (!uvAttr) return;

        let visibleCount = 0;
        const cameraPos = state.camera.position;
        const matrixArray = mesh.instanceMatrix.array as Float32Array;

        for (let i = 0; i < WORLD_UNIT_POOL_SIZE; i++) {
            const unit = units[i];

            if (!unit || !unit.isActive || !unit.userName || unit.hp <= 0) {
                continue;
            }

            // Dist check (Optimized Frustum)
            const dx = cameraPos.x - unit.position[0];
            const dz = cameraPos.z - unit.position[2];
            const dSq = dx * dx + dz * dz;
            if (dSq > 40 * 40) {
                continue;
            }

            let slotInfo = userToSlotMap.current.get(unit.userName);

            if (!slotInfo) {
                if (nextSlotIdx.current < SLOTS_PER_ROW * SLOTS_PER_ROW) {
                    const slot = nextSlotIdx.current++;
                    userToSlotMap.current.set(unit.userName, { u: 0, v: 0, ready: false });
                    drawUserToAtlas(unit.userName, slot, unit.profileImage);
                    slotInfo = userToSlotMap.current.get(unit.userName);
                }
            }

            if (slotInfo && slotInfo.ready) {
                const yOff = unit.isBoss ? 9.5 : 4.5; // Slightly lower since text is gone

                // Dynamic Index Packing: Write to contiguous buffer layout
                const offset = visibleCount * 16;
                const scale = unit.isBoss ? 6.0 : 4.0;

                matrixArray[offset + 0] = scale;
                matrixArray[offset + 1] = 0;
                matrixArray[offset + 2] = 0;
                matrixArray[offset + 3] = 0;

                matrixArray[offset + 4] = 0;
                matrixArray[offset + 5] = scale;
                matrixArray[offset + 6] = 0;
                matrixArray[offset + 7] = 0;

                matrixArray[offset + 8] = 0;
                matrixArray[offset + 9] = 0;
                matrixArray[offset + 10] = scale;
                matrixArray[offset + 11] = 0;

                matrixArray[offset + 12] = unit.position[0];
                matrixArray[offset + 13] = unit.position[1] + yOff;
                matrixArray[offset + 14] = unit.position[2];
                matrixArray[offset + 15] = 1;

                uvOffsetArray[visibleCount * 2] = slotInfo.u;
                uvOffsetArray[visibleCount * 2 + 1] = slotInfo.v;

                visibleCount++;
            }
        }

        // Extremely low draw call counts due to packing!
        mesh.count = visibleCount;
        mesh.instanceMatrix.needsUpdate = true;

        // Ensure UV arrays are refreshed for the packed indices
        if (visibleCount > 0) {
            uvAttr.needsUpdate = true;
        }

        if (mesh.material instanceof THREE.ShaderMaterial) {
            mesh.material.uniforms.uAtlas.value = textureRef.current;
        }
    });

    const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const material = useMemo(() => NameTagMaterial(), []);

    if (!isReady) return null;

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, WORLD_UNIT_POOL_SIZE]}
            frustumCulled={false}
            renderOrder={999}
        />
    );
}
