'use client';

import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';

const MAX_DAMAGE_LABELS = 80;

interface DamageLabel {
    id: number;
    value: string;
    position: THREE.Vector3;
    startTime: number;
    color: string;
    isCrit: boolean;
    offset: THREE.Vector3;
    velocity: THREE.Vector3;
}

export function DamageHUDBatcher({ damageQueue }: { damageQueue: React.RefObject<any[]> }) {
    const labelsRef = useRef<DamageLabel[]>([]);
    const textRefs = useRef<(any | null)[]>([]);
    const nextLabelIdx = useRef(0);

    // Initialize the pool
    useMemo(() => {
        labelsRef.current = Array.from({ length: MAX_DAMAGE_LABELS }, (_, i) => ({
            id: i,
            value: '',
            position: new THREE.Vector3(),
            startTime: -1,
            color: '#ffffff',
            isCrit: false,
            offset: new THREE.Vector3(),
            velocity: new THREE.Vector3()
        }));
    }, []);

    useFrame((state) => {
        const now = state.clock.elapsedTime;

        // 1. Drain the queue but limit per-frame work to avoid UI lock
        if (damageQueue.current && damageQueue.current.length > 0) {
            // If the queue is massive (spike), drop old ones to stay fresh
            if (damageQueue.current.length > 200) {
                damageQueue.current.splice(0, damageQueue.current.length - 80);
            }

            const processCount = Math.min(damageQueue.current.length, 12); // Max 12 new labels per frame
            for (let i = 0; i < processCount; i++) {
                const event = damageQueue.current.shift();
                if (!event) continue;

                const label = labelsRef.current[nextLabelIdx.current];
                label.value = `-${Math.round(event.value)}`;
                label.position.set(event.position[0], event.position[1], event.position[2]);
                label.startTime = now;
                label.color = event.isCrit ? '#ffcc00' : '#ffffff';
                label.isCrit = event.isCrit;
                
                // Random pop direction
                const angle = Math.random() * Math.PI * 2;
                const spread = 2;
                label.velocity.set(
                    Math.cos(angle) * spread,
                    5 + Math.random() * 3, // Upwards pop
                    Math.sin(angle) * spread
                );
                label.offset.set(0, 0, 0);

                // Update text component immediately for visibility
                const text = textRefs.current[nextLabelIdx.current];
                if (text) {
                    text.text = label.value;
                    text.color = label.color;
                    text.fontSize = label.isCrit ? 0.9 : 0.45;
                    text.visible = true;
                }

                nextLabelIdx.current = (nextLabelIdx.current + 1) % MAX_DAMAGE_LABELS;
            }
        }

        // 2. Animate and Cleanup
        const DURATION = 1.0;
        for (let i = 0; i < MAX_DAMAGE_LABELS; i++) {
            const label = labelsRef.current[i];
            const text = textRefs.current[i];
            if (!text || label.startTime === -1) continue;

            const elapsed = now - label.startTime;
            if (elapsed > DURATION) {
                text.visible = false;
                label.startTime = -1;
                continue;
            }

            // Physics-ish movement
            const t = elapsed;
            label.offset.x = label.velocity.x * t;
            label.offset.y = label.velocity.y * t - 9.8 * t * t * 0.5; // Gravity
            label.offset.z = label.velocity.z * t;

            text.position.set(
                label.position.x + label.offset.x,
                label.position.y + label.offset.y + 1.5, // Base height offset
                label.position.z + label.offset.z
            );

            // Billboard effect
            text.quaternion.copy(state.camera.quaternion);

            // Fade out
            const fade = Math.pow(1 - (elapsed / DURATION), 2);
            text.fillOpacity = fade;
            text.strokeOpacity = fade;
            
            // Pop scale
            const scale = elapsed < 0.15 ? (elapsed / 0.15) * 1.2 : Math.max(0.6, 1.2 - (elapsed - 0.15) * 0.5);
            text.scale.setScalar(label.isCrit ? scale * 1.5 : scale);
        }
    });

    return (
        <group>
            {Array.from({ length: MAX_DAMAGE_LABELS }).map((_, i) => (
                <Text
                    key={`dmg-${i}`}
                    ref={(el) => { textRefs.current[i] = el; }}
                    visible={false}
                    fontSize={0.45}
                    color="white"
                    outlineWidth={0.05}
                    outlineColor="black"
                    anchorX="center"
                    anchorY="middle"
                    renderOrder={10}
                >
                    {''}
                </Text>
            ))}
        </group>
    );
}
