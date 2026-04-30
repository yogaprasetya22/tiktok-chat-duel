'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useVFX } from './VFXManager';

/**
 * DamageHUDBatcher v8 — SIMPLE & OPTIMAL
 *
 * Architecture (zero ring-buffer bugs):
 * - Hard cap of MAX_EVENTS (10) popups on screen.
 * - Each event owns a FIXED block of slots: event[i] → slots[i*STRIDE ... i*STRIDE+STRIDE-1]
 * - No dynamic ring-buffer → no out-of-bounds possible.
 * - Zero heap allocation in render loop.
 * - Camera-space billboarding.
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const MAX_EVENTS = 10;        // Max popups on screen at once
const STRIDE     = 14;        // Slots per event: 8 digits + "CRIT!"(5) + 1 spare
const MAX_INST   = MAX_EVENTS * STRIDE;

const ATLAS_COLS = 6;
const ATLAS_ROWS = 3;
// Atlas layout:
// Row 0: '0' '1' '2' '3' '4' '5'  (idx 0-5)
// Row 1: '6' '7' '8' '9' '!' '-'  (idx 6-11)
// Row 2: 'C' 'R' 'I' 'T' '!' ' '  (idx 12-17)

const CRIT_LABEL = [12, 13, 14, 15, 16]; // C R I T !

function digitIdx(d: number): number {
    return d < 6 ? d : 6 + (d - 6); // 0→0 ... 9→9
}

// ─── ZERO-ALLOC MATH OBJECTS ─────────────────────────────────────────────────
const _dummy = new THREE.Object3D();
const _v3    = new THREE.Vector3();
const _right = new THREE.Vector3();
const _up    = new THREE.Vector3();
const _col   = new THREE.Color();
const _hide  = new THREE.Matrix4().makeScale(0, 0, 0);
const _dbuf  = new Uint8Array(8);

// Colors (only magic/heal are fixed; normal/crit use team color)
const C_MAGIC  = new THREE.Color('#dd66ff');
const C_HEAL   = new THREE.Color('#00ffaa');
// Scratch color — reused every frame, never allocated in loop
const _teamScratch = new THREE.Color();

// ─── ATLAS ───────────────────────────────────────────────────────────────────
// Pure white fill — instanceColor does all the tinting at runtime.
function buildAtlas(): THREE.CanvasTexture {
    const S = 128;
    const cvs = document.createElement('canvas');
    cvs.width  = S * ATLAS_COLS;
    cvs.height = S * ATLAS_ROWS;
    const ctx  = cvs.getContext('2d')!;

    const chars = ['0','1','2','3','4','5','6','7','8','9','!','-','C','R','I','T','!'];

    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    chars.forEach((ch, i) => {
        const col = i % ATLAS_COLS;
        const row = Math.floor(i / ATLAS_COLS);
        const cx  = col * S + S / 2;
        const cy  = row * S + S / 2;

        ctx.font      = '900 82px "Arial Black",Impact,sans-serif';
        ctx.lineJoin  = 'round';
        ctx.miterLimit = 2;

        // Thin pure black outline only (for contrast, no color border)
        ctx.shadowColor   = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur    = 6;
        ctx.shadowOffsetY = 3;
        ctx.strokeStyle   = '#000';
        ctx.lineWidth     = 12; // Thinner border requested by user
        ctx.strokeText(ch, cx, cy);
        ctx.shadowColor   = 'transparent';

        // Pure white fill — instanceColor tints this at runtime
        ctx.fillStyle = '#ffffff';
        ctx.fillText(ch, cx, cy);
    });

    const tex = new THREE.CanvasTexture(cvs);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    return tex;
}

// ─── EVENT STRUCT ────────────────────────────────────────────────────────────
interface Evt {
    alive:     boolean;
    startTime: number;
    duration:  number;
    wx: number; wy: number; wz: number;
    vx: number; vy: number; vz: number;
    isCrit:  boolean;
    isMagic: boolean;
    isHeal:  boolean;
    numDigits: number;
    numChars:  number;
    charIdx:   Uint8Array;
    localX:    Float32Array;
    localY:    Float32Array;
    teamColor: THREE.Color;  // pre-allocated, set at spawn from ev.color
}

function makeEvt(): Evt {
    return {
        alive: false, startTime: 0, duration: 1, wx: 0, wy: 0, wz: 0,
        vx: 0, vy: 0, vz: 0, isCrit: false, isMagic: false, isHeal: false,
        numDigits: 0, numChars: 0,
        charIdx:   new Uint8Array(STRIDE),
        localX:    new Float32Array(STRIDE),
        localY:    new Float32Array(STRIDE),
        teamColor: new THREE.Color('#ffffff'),
    };
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export function DamageHUDBatcher({ damageQueue }: { damageQueue: React.RefObject<any[]> }) {
    const meshRef      = useRef<THREE.InstancedMesh>(null!);
    const { spawnVFX } = useVFX();

    // Fixed pool: MAX_EVENTS slots, each pre-allocated
    const evts      = useMemo(() => Array.from({ length: MAX_EVENTS }, makeEvt), []);
    const evtActive = useRef<boolean[]>(Array(MAX_EVENTS).fill(false));
    const evtPtr    = useRef(0); // ring pointer for next event slot

    const atlas    = useMemo(() => buildAtlas(), []);
    const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);
    const uTime    = useMemo(() => ({ value: 0 }), []);

    const material = useMemo(() => new THREE.ShaderMaterial({
        uniforms: { uAtlas: { value: atlas }, uTime },
        vertexShader: /* glsl */`
            attribute float aCharIdx;
            attribute float aOpacity;
            attribute float aCrit;
            attribute vec3  aCol;
            
            varying vec2  vUv;
            varying float vOp;
            varying float vCrit;
            varying vec3  vCol;
            
            void main() {
                float c = mod(aCharIdx, ${ATLAS_COLS}.0);
                float r = floor(aCharIdx / ${ATLAS_COLS}.0);
                vUv  = vec2((c + uv.x) / ${ATLAS_COLS}.0,
                            1.0 - (r + 1.0 - uv.y) / ${ATLAS_ROWS}.0);
                vOp  = aOpacity;
                vCrit = aCrit;
                vCol  = aCol;
                
                gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform sampler2D uAtlas;
            uniform float     uTime;
            
            varying vec2  vUv;
            varying float vOp;
            varying float vCrit;
            varying vec3  vCol;
            
            void main() {
                vec4 t = texture2D(uAtlas, vUv);
                if (t.a < 0.05) discard;
                
                vec3 c = t.rgb * vCol;
                
                // Shimmer for crits
                if (vCrit > 0.5) {
                    float w = pow(sin(vUv.x * 10.0 - uTime * 8.0) * 0.5 + 0.5, 3.0) * 0.5;
                    c = mix(c, vec3(1.0, 0.95, 0.4), w * t.a);
                }
                gl_FragColor = vec4(c, t.a * vOp);
            }
        `,
        transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }), [atlas, uTime]);

    const aCharIdx = useMemo(() => new Float32Array(MAX_INST), []);
    const aOpacity = useMemo(() => new Float32Array(MAX_INST), []);
    const aCrit    = useMemo(() => new Float32Array(MAX_INST), []);
    const aCol     = useMemo(() => new Float32Array(MAX_INST * 3), []);

    useEffect(() => {
        const m = meshRef.current;
        if (!m) return;
        for (let i = 0; i < MAX_INST; i++) m.setMatrixAt(i, _hide);
        m.geometry.setAttribute('aCharIdx', new THREE.InstancedBufferAttribute(aCharIdx, 1));
        m.geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(aOpacity, 1));
        m.geometry.setAttribute('aCrit',    new THREE.InstancedBufferAttribute(aCrit,    1));
        m.geometry.setAttribute('aCol',     new THREE.InstancedBufferAttribute(aCol,     3));
        
        m.instanceMatrix.needsUpdate = true;
    }, [aCharIdx, aOpacity, aCrit, aCol]);

    useFrame((state) => {
        const now  = state.clock.elapsedTime;
        const m    = meshRef.current;
        if (!m || !m.geometry.attributes.aCharIdx) return;

        uTime.value = now;

        // ── SPAWN ─────────────────────────────────────────────────────────────
        if (damageQueue.current && damageQueue.current.length > 0) {
            // Crits first so they always claim a slot
            damageQueue.current.sort((a, b) => (b.isCrit ? 1 : 0) - (a.isCrit ? 1 : 0));

            while (damageQueue.current.length > 0) {
                const ev = damageQueue.current.shift()!;

                // LOD: skip basic if queue is still huge
                if (!ev.isCrit && damageQueue.current.length > 15) continue;

                const isCrit  = !!ev.isCrit;
                const isMagic = !!ev.isMagic;
                const isHeal  = !!ev.isHeal;

                // Extract digits
                let val = Math.max(0, Math.round(ev.value));
                let dc  = 0;
                if (val === 0) { _dbuf[0] = 0; dc = 1; }
                else { while (val > 0 && dc < 8) { _dbuf[dc++] = val % 10; val = (val / 10) | 0; } }

                const hasCritLabel = isCrit;
                const totalChars   = dc + (hasCritLabel ? 5 : 0);

                // Grab the next event slot (ring, overwrites oldest)
                const ei  = evtPtr.current;
                evtPtr.current = (evtPtr.current + 1) % MAX_EVENTS;

                const e = evts[ei];

                // If overwriting a live event, hide its instances
                if (e.alive) {
                    const base = ei * STRIDE;
                    for (let s = 0; s < e.numChars; s++) {
                        m.setMatrixAt(base + s, _hide);
                        aOpacity[base + s] = 0;
                    }
                }

                // Layout params
                const SW  = isCrit ? 0.65 : 0.6;
                const GAP = SW * (isCrit ? 0.58 : 0.50);
                const numW = dc * GAP;

                // Write digit chars
                for (let c = 0; c < dc; c++) {
                    const d = _dbuf[dc - 1 - c]; // MSB first
                    e.charIdx[c] = digitIdx(d);
                    e.localX[c]  = (c * GAP) - numW * 0.5 + GAP * 0.5;
                    e.localY[c]  = 0;
                }

                // Write "CRIT!" chars above
                if (hasCritLabel) {
                    const critW = 5 * GAP;
                    const critY = SW * 1.55;
                    for (let c = 0; c < 5; c++) {
                        e.charIdx[dc + c] = CRIT_LABEL[c];
                        e.localX[dc + c]  = (c * GAP) - critW * 0.5 + GAP * 0.5;
                        e.localY[dc + c]  = critY;
                    }
                }

                // Parse team color from event — boost to full brightness via HSL
                e.teamColor.set(ev.color ?? '#ffffff');
                {
                    // Ensure max lightness so it's vivid against dark background
                    const hsl = { h: 0, s: 0, l: 0 };
                    e.teamColor.getHSL(hsl);
                    e.teamColor.setHSL(hsl.h, Math.max(hsl.s, 0.85), Math.max(hsl.l, 0.72));
                }

                // Physics
                const dx = (Math.random() - 0.5) * (isCrit ? 2.0 : 0.9);
                const dz = (Math.random() - 0.5) * 0.4;
                const vy = isCrit ? 8.5 : 5.2;

                e.alive     = true;
                e.startTime = now;
                e.duration  = isCrit ? 1.55 : 1.0;
                e.wx = ev.position[0]; e.wy = ev.position[1] + (isCrit ? 4.0 : 2.8); e.wz = ev.position[2];
                e.vx = dx; e.vy = vy; e.vz = dz;
                e.isCrit = isCrit; e.isMagic = isMagic; e.isHeal = isHeal;
                e.numDigits = dc;
                e.numChars  = totalChars;
                evtActive.current[ei] = true;

                if (isCrit) {
                    spawnVFX(ev.position, 'critical-hit', '#ffcc00');
                    spawnVFX(ev.position, 'shockwave', '#fff5cc');
                }

                // Only spawn one per frame to avoid stutter
                break;
            }
        }

        // ── ANIMATE ───────────────────────────────────────────────────────────
        const camQ = state.camera.quaternion;
        _right.set(1, 0, 0).applyQuaternion(camQ);
        _up.set(0, 1, 0).applyQuaternion(camQ);

        for (let ei = 0; ei < MAX_EVENTS; ei++) {
            const e    = evts[ei];
            const base = ei * STRIDE;

            if (!e.alive) {
                // Ensure hidden (idempotent)
                continue;
            }

            const t  = now - e.startTime;
            const tn = t / e.duration;

            // Expire
            if (tn >= 1.0) {
                e.alive = false;
                evtActive.current[ei] = false;
                for (let s = 0; s < e.numChars; s++) {
                    m.setMatrixAt(base + s, _hide);
                    aOpacity[base + s] = 0;
                }
                continue;
            }

            // World position
            const gravity = e.isCrit ? 5.0 : 9.0;
            const gx = e.wx + e.vx * t;
            const gy = e.wy + e.vy * t - 0.5 * gravity * t * t;
            const gz = e.wz + e.vz * t;

            // Scale
            let s: number;
            if (e.isCrit) {
                if      (t < 0.07) s = t / 0.07 * 2.0;
                else if (t < 0.18) s = 2.0 - (t - 0.07) / 0.11 * 0.6;
                else               s = 1.4 - Math.min((t - 0.18) / 0.5, 1) * 0.4;
            } else {
                if      (t < 0.06) s = t / 0.06 * 1.8;
                else if (t < 0.15) s = 1.8 - (t - 0.06) / 0.09 * 0.8;
                else               s = 1.0 - Math.min((t - 0.15) / 0.5, 1) * 0.25;
            }

            // Opacity: ramp in, hold, fade out
            const opacity = tn < 0.07
                ? tn / 0.07
                : tn < 0.6
                ? 1.0
                : 1.0 - (tn - 0.6) / 0.4;

            // Jitter for crits
            let jx = 0, jy = 0;
            if (e.isCrit && t < 0.18) {
                const j = (1 - t / 0.18) * 0.15;
                jx = (Math.random() - 0.5) * j;
                jy = (Math.random() - 0.5) * j;
            }

            // Color — always team color (boosted at spawn), magic/heal override
            let baseCol: THREE.Color;
            if      (e.isHeal)  baseCol = C_HEAL;
            else if (e.isMagic) baseCol = C_MAGIC;
            else {
                // Use team color. For crits, briefly flash white then team color.
                if (e.isCrit && t < 0.12 && Math.floor(t * 20) % 2 === 0) {
                    _teamScratch.set(1, 1, 1); // white flash on impact
                } else {
                    _teamScratch.copy(e.teamColor);
                }
                baseCol = _teamScratch;
            }

            const SW = e.isCrit ? 0.65 : 0.6;

            for (let c = 0; c < e.numChars; c++) {
                const si   = base + c;
                const isLbl = e.localY[c] > 0;
                const sc   = isLbl ? s * 0.68 : s;

                _v3.set(gx, gy, gz)
                   .addScaledVector(_right, e.localX[c] * s + jx)
                   .addScaledVector(_up,    e.localY[c] * s + jy);

                _dummy.position.copy(_v3);
                _dummy.quaternion.copy(camQ);
                _dummy.scale.setScalar(sc * SW);
                _dummy.updateMatrix();
                m.setMatrixAt(si, _dummy.matrix);

                aOpacity[si]  = opacity;
                aCharIdx[si]  = e.charIdx[c];
                aCrit[si]     = e.isCrit ? 1.0 : 0.0;

                _col.copy(baseCol);
                
                aCol[si * 3]     = _col.r;
                aCol[si * 3 + 1] = _col.g;
                aCol[si * 3 + 2] = _col.b;
            }

            // Hide unused slots in this event's block
            for (let c = e.numChars; c < STRIDE; c++) {
                aOpacity[base + c] = 0;
            }
        }

        m.instanceMatrix.needsUpdate = true;
        (m.geometry.attributes.aCharIdx as THREE.InstancedBufferAttribute).needsUpdate = true;
        (m.geometry.attributes.aOpacity as THREE.InstancedBufferAttribute).needsUpdate = true;
        (m.geometry.attributes.aCrit    as THREE.InstancedBufferAttribute).needsUpdate = true;
        (m.geometry.attributes.aCol     as THREE.InstancedBufferAttribute).needsUpdate = true;
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, MAX_INST]}
            frustumCulled={false}
            renderOrder={999}
        />
    );
}