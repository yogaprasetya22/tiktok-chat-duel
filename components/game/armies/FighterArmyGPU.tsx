'use client';

import * as THREE from 'three';
import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { GPUComputationRenderer, mergeBufferGeometries } from 'three-stdlib';
import { useStore } from '../../../hooks/useStore';
import { ENEMY_BASE_Z, PLAYER_BASE_Z } from '../../../hooks/battle/constants';
import type { TowerConfig, SimulationSettings } from '../../../hooks/battle/types';

// GPGPU Setup: 16x16 Texture = 256 Fighters dirender secara pararel di GPU
const POOL_WIDTH = 16; 
const POOL_SIZE = POOL_WIDTH * POOL_WIDTH; 

interface FighterArmyGPUProps {
  unitsMap: React.RefObject<Map<string, any>>;
  towerConfig: TowerConfig;
  settingsRef: React.RefObject<SimulationSettings>;
}


// Shader Update AI Kejar Mengejar
const computeVelocityShader = `
  uniform float delta;
  uniform float time;

  // Mencari musuh terdekat dengan memindai separuh tekstur yang berlawanan
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tmpPos = texture2D( texturePosition, uv );
    vec4 tmpVel = texture2D( textureVelocity, uv );

    vec3 pos = tmpPos.xyz;
    vec3 vel = tmpVel.xyz;
    float health = tmpPos.w;
    float team = tmpVel.w; // 0.0 = Player, 1.0 = Enemy

    if (health <= 0.0) {
        gl_FragColor = vec4(0.0, -1.0, 0.0, team); // Mati, turun ke bawah tanah
        return;
    }

    vec3 targetDir = vec3(0.0);
    float minDist = 1000.0;
    bool foundTarget = false;

    // SC SCANNING: Scan lawan (Player scan Enemy, Enemy scan Player)
    // Untuk efisiensi di demo ini kita scan area texture lawan
    float startY = (team < 0.5) ? 0.5 : 0.0; 
    float endY = (team < 0.5) ? 1.0 : 0.5;

    for (float y = 0.0; y < 1.0; y += 0.0625) { // 1/16 = 0.0625
      for (float x = 0.0; x < 1.0; x += 0.0625) {
        vec2 enemyUV = vec2(x + 0.03125, y + 0.03125);
        vec4 enemyPosInfo = texture2D(texturePosition, enemyUV);
        vec4 enemyVelInfo = texture2D(textureVelocity, enemyUV);
        
        // Cek apakah itu lawan dan masih hidup
        if (abs(enemyVelInfo.w - team) > 0.5 && enemyPosInfo.w > 0.0) {
            float d = distance(pos, enemyPosInfo.xyz);
            if (d < minDist) {
                minDist = d;
                targetDir = enemyPosInfo.xyz - pos;
                foundTarget = true;
            }
        }
      }
    }

    float speed = 4.0;
    if (foundTarget) {
        if (minDist > 1.2) {
            // Chase
            vel = mix(vel, normalize(targetDir) * speed, delta * 5.0);
        } else {
            // Attack: Stay and "damage" happens in position shader
            vel = mix(vel, vec3(0.0), delta * 10.0);
        }
    } else {
        // No target, move to center
        vec3 centerDir = vec3(0.0, 0.0, 0.0) - pos;
        vel = mix(vel, normalize(centerDir + 0.1) * 2.0, delta * 2.0);
    }

    gl_FragColor = vec4(vel, team);
  }
`;

const computePositionShader = `
  uniform float delta;
  
  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 tmpPos = texture2D( texturePosition, uv );
    vec4 tmpVel = texture2D( textureVelocity, uv );

    vec3 pos = tmpPos.xyz;
    vec3 vel = tmpVel.xyz;
    float health = tmpPos.w;
    float team = tmpVel.w;

    if (health > 0.0) {
        pos += vel * delta;
        
        // LOGIKA DAMAGE: Jika sangat dekat dengan musuh mana pun, kurangi HP
        // (Sederhana: scan musuh lagi untuk simulasi tabrakan/damage)
        for (float y = 0.0; y < 1.0; y += 0.125) { 
          for (float x = 0.0; x < 1.0; x += 0.125) {
            vec2 enemyUV = vec2(x + 0.06, y + 0.06);
            vec4 ePos = texture2D(texturePosition, enemyUV);
            vec4 eVel = texture2D(textureVelocity, enemyUV);
            if (abs(eVel.w - team) > 0.5 && ePos.w > 0.0) {
                if (distance(pos, ePos.xyz) < 1.5) {
                    health -= delta * 0.5; // Damage per frame
                }
            }
          }
        }
    } else {
        pos.y = mix(pos.y, -5.0, delta * 2.0); // Tenggelam jika mati
    }

    gl_FragColor = vec4( pos, health );
  }
`;

export function FighterArmyGPU({ unitsMap, towerConfig, settingsRef }: FighterArmyGPUProps) {
  const { gl } = useThree();
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);
  
  const gpuComputeRef = useRef<any>(null);
  const positionVariableRef = useRef<any>(null);
  const velocityVariableRef = useRef<any>(null);

  // Load Model 3D Asli
  const f1 = useGLTF('/assets-model/Knight_Golden_Female.glb') as any;

  // --- BAKE ANIMATIONS INTO TEXTURE ---
  const [animationTexture, setAnimationTexture] = React.useState<THREE.DataTexture | null>(null);
  const animInfo = useRef({ totalFrames: 0, boneCount: 0, fps: 30 });

  // Shared Uniforms agar semua bagian tubuh (Head, Body, dll) sinkron otomatis
  const sharedUniforms = useMemo(() => ({
    texturePosition: { value: null as THREE.Texture | null },
    textureVelocity: { value: null as THREE.Texture | null },
    animationTexture: { value: null as THREE.Texture | null },
    animMetadata: { value: new THREE.Vector4(0, 0, 0, 0) }, // x: totalFrames, y: boneCount, z: fps
    time: { value: 0 }
  }), []);

  // Ekstrak bagian-bagian tubuh secara terpisah (Jangan di-merge agar animasinya akurat)
  const bodyParts = useMemo(() => {
    if (!f1.scene) return [];
    
    const parts: any[] = [];
    let leadSkinnedMesh: THREE.SkinnedMesh | null = null;

    f1.scene.updateMatrixWorld(true);
    f1.scene.traverse((child: any) => {
      if (child.isMesh && child.geometry) {
        const g = child.geometry.clone();
        // Berikan skala global di sini agar seragam
        g.scale(1.5, 1.5, 1.5);
        // Terapkan matrix posisi asli bagian tubuh tersebut (tangan tetap di tangan, kepala tetap di kepala)
        g.applyMatrix4(child.matrixWorld);
        
        if (child.isSkinnedMesh) {
            if (!leadSkinnedMesh) leadSkinnedMesh = child;
            parts.push({ geometry: g, isSkinned: true });
        } else {
            parts.push({ geometry: g, isSkinned: false });
        }
      }
    });

    // Jalankan Baking jika ada Skinned Mesh
    if (leadSkinnedMesh && f1.animations && !animationTexture) {
        const baked = bakeAnimations(leadSkinnedMesh, f1.animations);
        setAnimationTexture(baked.texture);
        animInfo.current = { totalFrames: baked.totalFrames, boneCount: baked.boneCount, fps: 30 };
        sharedUniforms.animMetadata.value.set(baked.totalFrames, baked.boneCount, 30, 0);
    }

    return parts;
  }, [f1]);

  useEffect(() => {
    if (!gl) return;
    const gpuCompute = new GPUComputationRenderer(POOL_WIDTH, POOL_WIDTH, gl);

    const dtPosition = gpuCompute.createTexture();
    const dtVelocity = gpuCompute.createTexture();

    // Spawn Team 1 (Blue) di Z negatif, Team 2 (Red) di Z positif
    const posData = dtPosition.image.data as Float32Array;
    const velData = dtVelocity.image.data as Float32Array;
    
    if (posData && velData) {
      for (let i = 0; i < posData.length; i += 4) {
        const isEnemy = (i / 4.0) >= (POOL_SIZE / 2.0) ? 1.0 : 0.0;
        
        posData[i + 0] = (Math.random() - 0.5) * 40; // X
        posData[i + 1] = 0;                          // Y 
        posData[i + 2] = (isEnemy > 0.5 ? 40 : -40) + (Math.random() * 10); // Z
        posData[i + 3] = 1.0; // Health

        velData[i + 0] = 0;
        velData[i + 1] = 0;
        velData[i + 2] = 0;
        velData[i + 3] = isEnemy; // Team ID
      }
    }

    const velocityVariable = gpuCompute.addVariable("textureVelocity", computeVelocityShader, dtVelocity);
    const positionVariable = gpuCompute.addVariable("texturePosition", computePositionShader, dtPosition);

    gpuCompute.setVariableDependencies(velocityVariable, [positionVariable, velocityVariable]);
    gpuCompute.setVariableDependencies(positionVariable, [positionVariable, velocityVariable]);

    positionVariable.material.uniforms["delta"] = { value: 0.0 };
    velocityVariable.material.uniforms["delta"] = { value: 0.0 };
    velocityVariable.material.uniforms["time"] = { value: 0.0 };

    gpuCompute.init();

    gpuComputeRef.current = gpuCompute;
    positionVariableRef.current = positionVariable;
    velocityVariableRef.current = velocityVariable;
  }, [gl]);

  useFrame((state, delta) => {
    const gpuCompute = gpuComputeRef.current;
    if (!gpuCompute) return;

    positionVariableRef.current.material.uniforms.delta.value = delta;
    velocityVariableRef.current.material.uniforms.delta.value = delta;

    // EKSEKUSI GPGPU
    gpuCompute.compute();

    // Ambil texture hasil komputasi
    const positionTexture = gpuCompute.getCurrentRenderTarget(positionVariableRef.current).texture;
    const velocityTexture = gpuCompute.getCurrentRenderTarget(velocityVariableRef.current).texture;

    // Update shared uniforms sekali saja, akan otomatis berefek ke semua material
    sharedUniforms.texturePosition.value = positionTexture;
    sharedUniforms.textureVelocity.value = velocityTexture;
    sharedUniforms.time.value = state.clock.elapsedTime;
    if (animationTexture) {
      sharedUniforms.animationTexture.value = animationTexture;
    }
  });

  // Shader Injeksi VAT (Vertex Animation Texture)
  const onBeforeCompile = (shader: any, isSkinned: boolean) => {
    shader.uniforms.texturePosition = sharedUniforms.texturePosition;
    shader.uniforms.textureVelocity = sharedUniforms.textureVelocity;
    shader.uniforms.animationTexture = sharedUniforms.animationTexture;
    shader.uniforms.animMetadata = sharedUniforms.animMetadata;
    shader.uniforms.time = sharedUniforms.time;

    shader.vertexShader = `
      uniform sampler2D texturePosition;
      uniform sampler2D textureVelocity;
      uniform sampler2D animationTexture;
      uniform vec4 animMetadata; // x: totalFrames, y: boneCount
      uniform float time;
      varying float vTeam;
      varying float vHealth;

      mat4 getBoneMatrix(float boneIdx, float frame) {
          float totalFrames = animMetadata.x;
          float boneCount = animMetadata.y;
          if (totalFrames < 1.0) return mat4(1.0); // Fallback jika belum siap
          
          float pixelX = (boneIdx * 4.0 + 0.5) / (boneCount * 4.0);
          float pixelY = (frame + 0.5) / totalFrames;
          
          return mat4(
              texture2D(animationTexture, vec2(pixelX, pixelY)),
              texture2D(animationTexture, vec2(pixelX + 1.0/(boneCount*4.0), pixelY)),
              texture2D(animationTexture, vec2(pixelX + 2.0/(boneCount*4.0), pixelY)),
              texture2D(animationTexture, vec2(pixelX + 3.0/(boneCount*4.0), pixelY))
          );
      }
      
      attribute vec4 skinIndex;
      attribute vec4 skinWeight;

      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      vec2 uvCoords = vec2(
          mod(float(gl_InstanceID), ${POOL_WIDTH.toFixed(1)}) + 0.5,
          floor(float(gl_InstanceID) / ${POOL_WIDTH.toFixed(1)}) + 0.5
      ) / ${POOL_WIDTH.toFixed(1)};

      vec4 posInfo = texture2D(texturePosition, uvCoords);
      vec4 velInfo = texture2D(textureVelocity, uvCoords);
      vTeam = velInfo.w;
      vHealth = posInfo.w;

      float speed = length(velInfo.xyz);
      float startFrame = (speed > 0.5) ? 0.0 : 31.0; 
      float frameCount = 30.0;
      float frame = mod(time * 30.0 + float(gl_InstanceID), frameCount) + startFrame;

      vec3 transformed = position;

      ${isSkinned ? `
      mat4 boneMatX = getBoneMatrix(skinIndex.x, frame);
      mat4 boneMatY = getBoneMatrix(skinIndex.y, frame);
      mat4 boneMatZ = getBoneMatrix(skinIndex.z, frame);
      mat4 boneMatW = getBoneMatrix(skinIndex.w, frame);

      vec4 skinned = (boneMatX * vec4(position, 1.0)) * skinWeight.x +
                     (boneMatY * vec4(position, 1.0)) * skinWeight.y +
                     (boneMatZ * vec4(position, 1.0)) * skinWeight.z +
                     (boneMatW * vec4(position, 1.0)) * skinWeight.w;
      transformed = skinned.xyz;
      ` : ''}

      // 1. ROTASI: Arah hadap
      vec3 vDir = velInfo.xyz;
      if (length(vDir) > 0.01) {
          float angle = atan(vDir.x, vDir.z);
          float s = sin(angle); float c = cos(angle);
          mat3 rotY = mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
          transformed = rotY * transformed;
      }
      
      // 2. TRANSLASI: Posisi GPGPU
      transformed += posInfo.xyz;
      `
    );

    // Ganti warna di Fragment Shader berdasarkan Team
    shader.fragmentShader = `
      varying float vTeam;
      varying float vHealth;
      ${shader.fragmentShader}
    `.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `
        vec3 teamColor = (vTeam < 0.5) ? vec3(0.1, 0.4, 1.0) : vec3(1.0, 0.1, 0.2);
        // Efek Flash putih jika HP rendah/mati
        if (vHealth <= 0.0) teamColor = vec3(0.3);
        vec4 diffuseColor = vec4( teamColor, opacity );
        `
    );
  };

  return (
    <group ref={groupRef}>
      {bodyParts.map((part: any, i: number) => (
        <instancedMesh key={i} args={[part.geometry, undefined, POOL_SIZE]} frustumCulled={false}>
          <meshStandardMaterial 
            color={towerConfig.player.color} 
            onBeforeCompile={(s: any) => onBeforeCompile(s, part.isSkinned)}
            roughness={0.7}
          />
        </instancedMesh>
      ))}
    </group>
  );
}

// --- UTILITY: BAKE ANIMATIONS TO TEXTURE ---
function bakeAnimations(mesh: THREE.SkinnedMesh, animations: THREE.AnimationClip[]) {
    const skeleton = mesh.skeleton;
    const boneCount = skeleton.bones.length;
    const fps = 30;
    
    // Kita ambil 2 animasi pertama (misal: Walk dan Attack) @ 1 detik masing-masing
    const totalFrames = 60; 
    const data = new Float32Array(boneCount * 4 * totalFrames * 4);
    
    const mixer = new THREE.AnimationMixer(mesh);
    const actions = animations.map(clip => {
        const action = mixer.clipAction(clip);
        action.play();
        return action;
    });

    for (let f = 0; f < totalFrames; f++) {
        mixer.setTime(f / fps);
        // Force update skeleton
        mesh.updateMatrixWorld(true);
        skeleton.update();
        
        const boneMatrices = skeleton.boneMatrices; 
        if (boneMatrices) {
            for (let b = 0; b < boneCount; b++) {
                const offset = (f * boneCount * 4 + b * 4) * 4;
                for (let m = 0; m < 16; m++) {
                    data[offset + m] = boneMatrices[b * 16 + m];
                }
            }
        }
    }

    const texture = new THREE.DataTexture(data, boneCount * 4, totalFrames, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return { texture, totalFrames, boneCount };
}

useGLTF.preload('/assets-model/Knight_Golden_Female.glb');
