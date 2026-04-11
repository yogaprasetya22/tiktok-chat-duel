'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, MapControls } from '@react-three/drei';
import { GPUComputationRenderer } from 'three-stdlib';
import { Perf } from 'r3f-perf';

const WIDTH = 64; 
const MAX_UNITS = WIDTH * WIDTH;

// =======================================================
// 1. SHADER UNTUK KALKULASI LOGIKA POSISI & VELOCITY
// =======================================================

const computePositionShader = `
  uniform float delta;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tmpPos = texture2D( texturePosition, uv );
    vec4 tmpVel = texture2D( textureVelocity, uv );

    vec3 pos = tmpPos.xyz;
    vec3 vel = tmpVel.xyz;

    pos += vel * delta;

    gl_FragColor = vec4( pos, 1.0 );
  }
`;

const computeVelocityShader = `
  uniform float delta;
  uniform vec3 enemyBasePos;

  // Simple pseudo-random function for noise
  float rand(vec2 co) {
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tmpPos = texture2D( texturePosition, uv );
    vec4 tmpVel = texture2D( textureVelocity, uv );

    vec3 pos = tmpPos.xyz;
    vec3 vel = tmpVel.xyz;

    // Steering Seek Logic
    vec3 dir = enemyBasePos - pos; 
    float dist = length(dir);
    
    // Smooth follow with individual speed variances
    float individualSpeed = 2.0 + rand(uv) * 4.0; 

    if(dist > 2.0) {
      // Seek target
      vec3 desiredVelocity = normalize(dir) * individualSpeed;
      // Add simple steering (lerp current vel to desired to prevent instant snaps)
      vel = mix(vel, desiredVelocity, delta * 2.0);
    } else {
      // Reached base - swarm around it
      vec3 orbitDir = vec3(-dir.z, 0.0, dir.x);
      vel = normalize(orbitDir) * 1.5;
    }

    gl_FragColor = vec4(vel, 1.0);
  }
`;



// =======================================================
// =======================================================
// HELPER BERSAMA
// =======================================================

import { FighterArmyGPU } from '../../components/game/armies/FighterArmyGPU';

// Dummy wrapper to simulate the battle system environment
function StandaloneFighterGPU() {
    const unitsMap = useRef(new Map());
    const settingsRef = useRef({ globalSpeedMultiplier: 1.0, unitScale: 1.0 } as any);
    const towerConfig = { player: { color: '#0066FF' }, enemy: { color: '#FF0033' } } as any;

    return <FighterArmyGPU unitsMap={unitsMap} towerConfig={towerConfig} settingsRef={settingsRef} />;
}

export default function SandboxGPUPage() {
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111' }}>
      <Canvas shadows camera={{ position: [0, 40, -10], fov: 45 }}>
        <Perf position="top-left" />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        
        {/* Lantai Lapangan Merah-Biru */}
        <mesh position={[0, -0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[100, 120]} />
          <meshStandardMaterial color="#2d3748" />
        </mesh>
        
        {/* Markas Musuh Target (Enemy Base) */}
        <mesh position={[0, 2, 50]}>
            <cylinderGeometry args={[3, 3, 4, 16]} />
            <meshStandardMaterial color="#ff0044" />
        </mesh>

        <StandaloneFighterGPU />
        <MapControls />
      </Canvas>
      <div style={{ position: 'absolute', top: 20, right: 20, color: 'white', fontFamily: 'sans-serif', background: 'rgba(0,0,0,0.5)', padding: '1rem', borderRadius: 8 }}>
          <h3>GPGPU Real Asset Sandbox</h3>
          <p>Units Active: <b>256 (16x16 GPU Texture)</b></p>
          <p>Simulation: <b>GLSL Shader with Extracted GLB Geometry</b></p>
      </div>
    </div>
  );
}
