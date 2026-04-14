'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVFX } from './VFXManager';

/**
 * DamageHUDBatcher v4 — ULTIMATE EDITION (Highly Optimized + Juicy FX)
 * 
 * Features:
 * - Selective Index Pooling: Zero-overhead looping (only processes active sprites).
 * - "Mobile Legend" Visuals: Bold gradients, heavy outlines, vibrant colors.
 * - Juice: Screen-space shaking for crits, explosive pops, organic drifting.
 * - Draw Call Optimization: Uses mesh.count to only draw what's necessary.
 */

const MAX_DAMAGE_SPRITES = 360; 
const DURATION = 0.95;          
const SPRITE_SIZE = 0.65;        
const CRIT_SCALE_MULT = 1.6;   

// Atlas Map: -, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, C, R, I, T, !
const CHAR_MAP: Record<string, number> = {
    '-': 0, '0': 1, '1': 2, '2': 3, '3': 4, '4': 5,
    '5': 6, '6': 7, '7': 8, '8': 9, '9': 10,
    'C': 11, 'R': 12, 'I': 13, 'T': 14, '!': 15,
};
const ATLAS_COLS = 8;
const ATLAS_ROWS = 2;

interface SpriteSlot {
    id: number;
    active: boolean;
    startTime: number;
    baseX: number;
    baseY: number;
    baseZ: number;
    velX: number;
    velY: number;
    velZ: number;
    isCrit: boolean;
    isMagic: boolean;
    charIdx: number; 
    digitOffset: number; 
}

const _dummy = new THREE.Object3D();
const _hideMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(0, -999, 0),
    new THREE.Quaternion(),
    new THREE.Vector3(0, 0, 0)
);

/**
 * Creates a premium "Triple-Layer" gaming atlas.
 */
function createDigitAtlas(): THREE.CanvasTexture {
    const cellSize = 128; 
    const canvas = document.createElement('canvas');
    canvas.width = cellSize * ATLAS_COLS;
    canvas.height = cellSize * ATLAS_ROWS;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const chars = ['-', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', 'R', 'I', 'T', '!'];

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chars.forEach((char, i) => {
        const col = i % ATLAS_COLS;
        const row = Math.floor(i / ATLAS_COLS);
        const cx = col * cellSize + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;

        ctx.font = '900 86px "Impact", "Arial Black", sans-serif';
        
        // 1. Bottom Glow / Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        // 2. Thick Outer Stroke
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 16;
        ctx.strokeText(char, cx, cy);
        
        // Reset shadow for inner layers
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // 3. Middle Highlight Stroke
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeText(char, cx, cy);

        // 4. Main Vibrant Gradient Fill
        const grad = ctx.createLinearGradient(cx, cy - 40, cx, cy + 40);
        grad.addColorStop(0, '#ffffff'); // Top
        grad.addColorStop(1, '#e2e8f0'); // Sightly tinted bottom
        ctx.fillStyle = grad;
        ctx.fillText(char, cx, cy);
    });

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
}

export function DamageHUDBatcher({ damageQueue }: { damageQueue: React.RefObject<any[]> }) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const { spawnVFX } = useVFX();
    
    // Core Pools
    const slots = useMemo(() => Array.from({ length: MAX_DAMAGE_SPRITES }, (_, i) => ({
        id: i, active: false, startTime: -1,
        baseX: 0, baseY: 0, baseZ: 0,
        velX: 0, velY: 0, velZ: 0,
        isCrit: false, isMagic: false,
        charIdx: 0, digitOffset: 0,
    } as SpriteSlot)), []);
    
    const activeIndices = useRef<number[]>([]);
    const nextSlotRef = useRef(0);

    const atlas = useMemo(() => createDigitAtlas(), []);
    const geometry = useMemo(() => new THREE.PlaneGeometry(SPRITE_SIZE, SPRITE_SIZE * 1.2), []);

    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uAtlas: { value: atlas },
                uAtlasCols: { value: ATLAS_COLS },
                uAtlasRows: { value: ATLAS_ROWS },
            },
            vertexShader: `
                attribute float aCharIdx;
                attribute float aOpacity;
                varying vec2 vUv;
                varying float vOpacity;
                void main() {
                    float col = mod(aCharIdx, ${ATLAS_COLS}.0);
                    float row = floor(aCharIdx / ${ATLAS_COLS}.0);
                    vUv = vec2(col * (1.0/${ATLAS_COLS}.0) + uv.x * (1.0/${ATLAS_COLS}.0), 1.0 - ((row + 1.0) * (1.0/${ATLAS_ROWS}.0) - uv.y * (1.0/${ATLAS_ROWS}.0)));
                    vOpacity = aOpacity;
                    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D uAtlas;
                varying vec2 vUv;
                varying float vOpacity;
                void main() {
                    vec4 texColor = texture2D(uAtlas, vUv);
                    if (texColor.a < 0.1) discard;
                    gl_FragColor = vec4(texColor.rgb, texColor.a * vOpacity);
                }
            `,
            transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
        });
    }, [atlas]);

    const charIdxAttr = useMemo(() => new Float32Array(MAX_DAMAGE_SPRITES), []);
    const opacityAttr = useMemo(() => new Float32Array(MAX_DAMAGE_SPRITES), []);

    useEffect(() => {
        if (meshRef.current) {
            for (let i = 0; i < MAX_DAMAGE_SPRITES; i++) {
                meshRef.current.setMatrixAt(i, _hideMatrix);
                meshRef.current.setColorAt(i, new THREE.Color('#ffffff'));
            }
            meshRef.current.geometry.setAttribute('aCharIdx', new THREE.InstancedBufferAttribute(charIdxAttr, 1));
            meshRef.current.geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(opacityAttr, 1));
            meshRef.current.instanceMatrix.needsUpdate = true;
        }
    }, [charIdxAttr, opacityAttr]);

    const colors = {
        phys: new THREE.Color('#ffffff'),
        crit: new THREE.Color('#ff0000'),
        critHighlight: new THREE.Color('#ffff00'),
        magic: new THREE.Color('#bf00ff'),
    };

    useFrame((state) => {
        const now = state.clock.elapsedTime;
        const mesh = meshRef.current;
        if (!mesh || !mesh.geometry.attributes.aCharIdx) return;

        // 1. Process New Damage Events
        if (damageQueue.current && damageQueue.current.length > 0) {
            const batch = Math.min(damageQueue.current.length, 16);
            for (let p = 0; p < batch; p++) {
                const event = damageQueue.current.shift();
                if (!event) continue;

                const rawVal = Math.round(event.value);
                const text = event.isCrit ? `${rawVal}CRIT` : `${rawVal}!`;
                const chars = text.split('');
                const charGap = SPRITE_SIZE * 0.42;
                const totalW = chars.length * charGap;

                // Physics: Upward explode with random horizontal spray
                const angle = Math.random() * Math.PI * 2;
                const force = event.isCrit ? 3.0 : 1.8;
                const vx = Math.cos(angle) * force;
                const vy = event.isCrit ? 7.5 : 5.0;
                const vz = Math.sin(angle) * force;

                // Sync: Trigger explosive VFX for Critical Hits
                if (event.isCrit) {
                    spawnVFX(event.position, 'critical-hit', '#ffcc00');
                    spawnVFX(event.position, 'shockwave', '#ffffff');
                } else if (event.value > 100) {
                   spawnVFX(event.position, 'spark', event.color || '#ffffff');
                }

                for (let c = 0; c < chars.length; c++) {
                    const charCode = CHAR_MAP[chars[c]];
                    if (charCode === undefined) continue;

                    const idx = nextSlotRef.current;
                    const slot = slots[idx];
                    
                    if (!slot.active) activeIndices.current.push(idx);
                    
                    slot.active = true;
                    slot.startTime = now;
                    slot.baseX = event.position[0];
                    slot.baseY = event.position[1] + 1.8;
                    slot.baseZ = event.position[2];
                    slot.velX = vx;
                    slot.velY = vy;
                    slot.velZ = vz;
                    slot.isCrit = event.isCrit;
                    slot.isMagic = event.isMagic;
                    slot.charIdx = charCode;
                    slot.digitOffset = (c * charGap) - totalW * 0.5;

                    nextSlotRef.current = (nextSlotRef.current + 1) % MAX_DAMAGE_SPRITES;
                }
            }
        }

        // 2. Optimized Animation Loop (Selective Update)
        const camQ = state.camera.quaternion;
        const charAttr = mesh.geometry.attributes.aCharIdx as THREE.InstancedBufferAttribute;
        const opacityAttrBuf = mesh.geometry.attributes.aOpacity as THREE.InstancedBufferAttribute;
        
        const remaining: number[] = [];

        for (const idx of activeIndices.current) {
            const slot = slots[idx];
            const elapsed = now - slot.startTime;

            if (elapsed > DURATION) {
                slot.active = false;
                mesh.setMatrixAt(idx, _hideMatrix);
                opacityAttr[idx] = 0;
                continue;
            }

            remaining.push(idx);
            const t = elapsed;
            
            // "Juicy" Pop-Bounce Motion
            let px = slot.baseX + slot.velX * t + slot.digitOffset;
            let py = slot.baseY + slot.velY * t - 16.0 * t * t * 0.5; // High gravity for snappy feel
            let pz = slot.baseZ + slot.velZ * t;

            // Crit Shake (Sinusoidal screen-space jitter)
            if (slot.isCrit && t < 0.3) {
                const shake = Math.sin(t * 60) * 0.12 * (1.0 - t/0.3);
                px += shake;
                py += shake;
            }

            // High-Impact Scale Curve
            let s = 1.0;
            if (t < 0.1) {
                s = (t / 0.1) * 2.0; // Oversize pop
            } else if (t < 0.25) {
                s = 2.0 - ((t - 0.1) / 0.15) * 1.0; // Settle bounce
            } else {
                s = 1.0 - ((t - 0.25) / (DURATION - 0.25)) * 0.4; // Fade shrink
            }

            const finalScale = s * (slot.isCrit ? CRIT_SCALE_MULT : 1.0) * SPRITE_SIZE;

            _dummy.position.set(px, py, pz);
            _dummy.quaternion.copy(camQ);
            _dummy.scale.setScalar(finalScale);
            _dummy.updateMatrix();
            mesh.setMatrixAt(idx, _dummy.matrix);

            // Per-instance Color/Alpha
            opacityAttr[idx] = Math.max(0, Math.pow(1.0 - t / DURATION, 2.0));
            charIdxAttr[idx] = slot.charIdx;

            if (slot.isCrit) {
                // Flash between red and gold during the "hit" moment
                mesh.setColorAt(idx, (Math.floor(t * 30) % 2 === 0) ? colors.critHighlight : colors.crit);
            } else if (slot.isMagic) {
                mesh.setColorAt(idx, colors.magic);
            } else {
                mesh.setColorAt(idx, colors.phys);
            }
        }

        activeIndices.current = remaining;

        mesh.instanceMatrix.needsUpdate = true;
        charAttr.needsUpdate = true;
        opacityAttrBuf.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, MAX_DAMAGE_SPRITES]}
            frustumCulled={false}
            renderOrder={999}
        />
    );
}
