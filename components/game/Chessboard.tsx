'use client';

import React from 'react';
import * as THREE from 'three';

export function Chessboard() {
  const width = 8;
  const length = 44; 

  return (
    <group position={[0, -0.45, 0]}>
      {/* Stone Path Base */}
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial 
          color="#2a2a2a" 
          roughness={0.8} 
          metalness={0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Dirt/Grass Grid */}
      <gridHelper 
        args={[length, 44, "#333333", "#1a1a1a"]} 
        rotation-x={-Math.PI / 2} 
        position-y={0.01} 
      />

      {/* Primary Parallel Lanes (Column Guides) */}
      <group position-y={0.02}>
        {/* Central Lane Indicator */}
        <mesh position={[0, 0, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.02, length]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.1} />
        </mesh>

        {/* Column Divider Lines */}
        <mesh position={[1.5, 0, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.01, length]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
        </mesh>
        <mesh position={[-1.5, 0, 0]} rotation-x={-Math.PI / 2}>
          <planeGeometry args={[0.01, length]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.05} />
        </mesh>

        {/* Team Bases Indicators (Softer for Daylight) */}
        <mesh position={[0, 0.01, 20]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[4, 32]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.15} />
        </mesh>
        <mesh position={[0, 0.01, -20]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[4, 32]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.15} />
        </mesh>
      </group>
    </group>
  );
}
