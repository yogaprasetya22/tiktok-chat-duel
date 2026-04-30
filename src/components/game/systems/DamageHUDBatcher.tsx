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

// Colors
const C_WHITE  = new THREE.Color('#e8f0ff');
const C_CRIT   = new THREE.Color('#ff4400');
const C_GOLD   = new THREE.Color('#ffd700');
const C_MAGIC  = new THREE.Color('#cc44ff');
const C_HEAL   = new THREE.Color('#22ff88');

// ─── ATLAS ───────────────────────────────────────────────────────────────────
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

        // Thick black outline
        ctx.shadowColor   = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur    = 8;
        ctx.shadowOffsetY = 5;
        ctx.strokeStyle = '#000';
        ctx.lineWidth   = 28;
        ctx.strokeText(ch, cx, cy);

        ctx.shadowColor = 'transparent';

        // Inner dark border
        ctx.strokeStyle = '#1a0500';
        ctx.lineWidth   = 14;
        ctx.strokeText(ch, cx, cy);

        // Gradient fill (warm white → gold)
        const g = ctx.createLinearGradient(cx, cy - 40, cx, cy + 40);
        g.addColorStop(0,   '#ffffff');
        g.addColorStop(0.4, '#fff4e0');
        g.addColorStop(1,   '#cc9933');
        ctx.fillStyle = g;
        ctx.fillText(ch, cx, cy);

        // Top shine
        const shine = ctx.createLinearGradient(cx, cy - 40, cx, cy);
        shine.addColorStop(0, 'rgba(255,255,255,0.7)');
        shine.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = shine;
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
    numDigits:   number;       // how many digit chars
    numChars:    number;       // total chars written (digits + optional CRIT!)
    // per-char data (max STRIDE entries)
    charIdx: Uint8Array;      // atlas index per slot
    localX:  Float32Array;    // x offset (camera-right space)
    localY:  Float32Array;    // y offset (camera-up space)
}

function makeEvt(): Evt {
    return {
        alive: false, startTime: 0, duration: 1, wx: 0, wy: 0, wz: 0,
        vx: 0, vy: 0, vz: 0, isCrit: false, isMagic: false, isHeal: false,
        numDigits: 0, numChars: 0,
        charIdx: new Uint8Array(STRIDE),
        localX:  new Float32Array(STRIDE),
        localY:  new Float32Array(STRIDE),
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
            varying vec2  vUv;
            varying float vOp;
            varying float vCrit;
            #ifdef USE_INSTANCING_COLOR
            varying vec3 vCol;
            #endif
            void main() {
                float c = mod(aCharIdx, ${ATLAS_COLS}.0);
                float r = floor(aCharIdx / ${ATLAS_COLS}.0);
                vUv  = vec2((c + uv.x) / ${ATLAS_COLS}.0,
                            1.0 - (r + 1.0 - uv.y) / ${ATLAS_ROWS}.0);
                vOp  = aOpacity;
                vCrit = aCrit;
                #ifdef USE_INSTANCING_COLOR
                vCol = instanceColor;
                #endif
                gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform sampler2D uAtlas;
            uniform float     uTime;
            varying vec2  vUv;
            varying float vOp;
            varying float vCrit;
            #ifdef USE_INSTANCING_COLOR
            varying vec3 vCol;
            #endif
            void main() {
                vec4 t = texture2D(uAtlas, vUv);
                if (t.a < 0.05) discard;
                vec3 c = t.rgb;
                #ifdef USE_INSTANCING_COLOR
                c *= vCol;
                #endif
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

    useEffect(() => {
        const m = meshRef.current;
        if (!m) return;
        for (let i = 0; i < MAX_INST; i++) m.setMatrixAt(i, _hide);
        m.geometry.setAttribute('aCharIdx', new THREE.InstancedBufferAttribute(aCharIdx, 1));
        m.geometry.setAttribute('aOpacity', new THREE.InstancedBufferAttribute(aOpacity, 1));
        m.geometry.setAttribute('aCrit',    new THREE.InstancedBufferAttribute(aCrit,    1));
        m.instanceMatrix.needsUpdate = true;
    }, [aCharIdx, aOpacity, aCrit]);

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
                const SW  = isCrit ? 0.9 : 0.7;
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

                // Physics
                const dx = (Math.random() - 0.5) * (isCrit ? 2.0 : 0.9);
                const dz = (Math.random() - 0.5) * 0.4;
                const vy = isCrit ? 8.5 : 5.2;

                e.alive     = true;
                e.startTime = now;
                e.duration  = isCrit ? 1.55 : 1.0;
                e.wx = ev.position[0]; e.wy = ev.position[1] + 2.0; e.wz = ev.position[2];
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
                if      (t < 0.07) s = t / 0.07 * 3.0;
                else if (t < 0.18) s = 3.0 - (t - 0.07) / 0.11 * 1.3;
                else               s = 1.7 - Math.min((t - 0.18) / 0.5, 1) * 0.4;
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

            // Color
            let baseCol: THREE.Color;
            if      (e.isHeal)  baseCol = C_HEAL;
            else if (e.isMagic) baseCol = C_MAGIC;
            else if (e.isCrit)  baseCol = (Math.floor(t * 16) % 2 === 0) ? C_GOLD : C_CRIT;
            else                baseCol = C_WHITE;

            const SW = e.isCrit ? 0.9 : 0.7;

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

                if (isLbl) _col.copy((Math.floor(t * 10) % 2 === 0) ? C_GOLD : C_WHITE);
                else       _col.copy(baseCol);
                m.setColorAt(si, _col);
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
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
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