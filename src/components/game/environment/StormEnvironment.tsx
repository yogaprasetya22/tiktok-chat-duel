/**
 * StormEnvironment — Open World Edition (Physics Stabilized)
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { Environment, useTexture } from "@react-three/drei";
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from "three-mesh-bvh";
import { StaticCollider, characterStatus } from "bvhecctrl";

import * as THREE from "three";
import { useStore } from "@/src/state/useStore";
import { useEditorStore } from "@/src/state/useEditorStore";
import { getTerrainElevation } from "@/src/core/utils/terrainHeight";
import { FULL_MATERIAL_LIBRARY } from "@/src/core/logic/environment/assetRegistry";
import { useVFX } from "../systems/VFXManager";
import { PainterlyShaderUtils } from "../systems/effects/PainterlyMaterials";
import { registerCollider, unregisterCollider } from "@/src/core/utils/globalRaycaster";

// Add BVH support to THREE with any cast to avoid lint errors
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

const TerrainMaterial = new THREE.ShaderMaterial({
  uniforms: {
    baseColor: { value: new THREE.Color("#3d5c36") },
    peakColor: { value: new THREE.Color("#95b58b") },
    rockColor: { value: new THREE.Color("#5a5e52") },
    uMap: { value: null },
    uUseMap: { value: 0.0 },
    uPaintMap: { value: null },
    uUsePaint: { value: 0.0 },
    uBrushTex: { value: null },
    uUseBrushTex: { value: 0.0 },
  },
  vertexShader: `
    varying float vElevation;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vElevation = position.z;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying float vElevation;
    varying vec2 vUv;
    uniform vec3 baseColor;
    uniform vec3 peakColor;
    uniform vec3 rockColor;
    uniform sampler2D uMap;
    uniform float uUseMap;
    uniform sampler2D uPaintMap;
    uniform float uUsePaint;
    uniform sampler2D uBrushTex;
    uniform float uUseBrushTex;
    
    ${PainterlyShaderUtils.brushstrokeNoise}
    ${PainterlyShaderUtils.toonMix}

    void main() {
      float strokes = brushstrokes(vUv * 80.0, 0.35);
      float t = smoothstep(0.0, 35.0, vElevation) + strokes * 0.08;
      vec3 mountainColor = toonMix(baseColor, peakColor, t * 1.5);

      float rockMask = smoothstep(22.0, 35.0, vElevation);
      mountainColor = mix(mountainColor, rockColor, rockMask * 0.6);

      // Texture Mask: Apply PBR texture only to the floor (0m - 15m)
      vec3 floorTex = texture2D(uMap, vUv * 30.0).rgb;
      float floorMask = smoothstep(12.0, 5.0, vElevation); 
      
      vec3 finalColor = mix(mountainColor, floorTex, floorMask * uUseMap);

      // Paint Layer: Overlays painted paths/colors or textures
      vec4 paint = texture2D(uPaintMap, vUv);
      
      if (uUseBrushTex > 0.5) {
        // Texture Splatting mode
        vec3 brushTex = texture2D(uBrushTex, vUv * 40.0).rgb;
        finalColor = mix(finalColor, brushTex, paint.a * uUsePaint);
      } else {
        // Solid Color Tint mode (Multiply)
        vec3 tintedColor = finalColor * paint.rgb * 1.5;
        finalColor = mix(finalColor, tintedColor, paint.a * uUsePaint);
      }

      float road = smoothstep(6.0, 3.0, abs(vUv.x - 0.5) * 150.0);
      finalColor = mix(finalColor, vec3(0.5, 0.45, 0.4), road * 0.4 * floorMask);

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `,
});

let globalIsSculptLoaded = false;
const globalSculptHeights = new Float32Array(256 * 256);

const TERRAIN_SIZE = 1500;
const GROUND_Y     = -0.3;
const EMPTY_TEXTURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

const Terrain = ({ baseDistance, potatoMode, debug, onReady, onSculptLoaded }: {
  baseDistance: number;
  potatoMode?: boolean;
  debug?: boolean;
  onReady?: () => void;
  onSculptLoaded?: () => void;
}) => {
  const { 
    terrainConfig, 
    terrainMaterialId, 
    terrainColor, 
    paintMode, 
    brushSize, 
    brushColor, 
    setPaintData,
    paintData,
    brushTextureId,
    brushStrength,
    brushRotation,
    brushMaskId,
    terrainMode,
    sculptTool,
    sculptData,
    setSculptData,
    brushHoverPos,
  } = useEditorStore();

  const ringColor = useMemo(() => {
    if (terrainMode === 'paint') return '#6366f1'; // Glowing Indigo
    switch (sculptTool) {
      case 'raise': return '#10b981'; // Glowing Emerald
      case 'lower': return '#f43f5e'; // Glowing Rose
      case 'smooth': return '#0ea5e9'; // Glowing Sky Blue
      case 'flatten': return '#f59e0b'; // Glowing Amber
      default: return '#6366f1';
    }
  }, [terrainMode, sculptTool]);

  const matInfo = FULL_MATERIAL_LIBRARY.find(m => m.id === terrainMaterialId);
  const brushInfo = FULL_MATERIAL_LIBRARY.find(m => m.id === brushTextureId);

  // Load Brush Texture
  const brushTex = useTexture(brushInfo?.diffuse || EMPTY_TEXTURE, (t: any) => {
    if (t instanceof THREE.Texture) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.anisotropy = 16;
    }
  });

  // Initialize Painting Canvas
  const [paintCanvas] = useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    return canvas;
  });

  // Initialize Sculpting Canvas (representing height displacement offsets)
  const [sculptCanvas] = useState(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#808080'; // Middle-gray = 0 offset
      ctx.fillRect(0, 0, 256, 256);
    }
    return canvas;
  });

  const sculptHeightsRef = useRef<Float32Array>(globalSculptHeights);
  const [sculptTrigger, setSculptTrigger] = useState(0);
  const [isSculptLoaded, setIsSculptLoaded] = useState(globalIsSculptLoaded);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        
        // Commit final state to store once drawing stroke has finished!
        if (terrainMode === 'paint') {
          const dataUrl = paintCanvas.toDataURL('image/png');
          setPaintData(dataUrl);
        } else if (terrainMode === 'sculpt') {
          const dataUrl = sculptCanvas.toDataURL('image/png');
          setSculptData(dataUrl);
          setSculptTrigger(prev => prev + 1);
        }
      }
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [terrainMode, paintCanvas, sculptCanvas, setPaintData, setSculptData]);
  
  const paintTexture = useMemo(() => {
    const tex = new THREE.CanvasTexture(paintCanvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }, [paintCanvas]);

  // Load / Clear paint data
  useEffect(() => {
    const ctx = paintCanvas.getContext('2d');
    if (!ctx) return;

    if (!paintData) {
      // Clear canvas if no data
      ctx.clearRect(0, 0, 1024, 1024);
      paintTexture.needsUpdate = true;
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, 1024, 1024);
      ctx.drawImage(img, 0, 0);
      paintTexture.needsUpdate = true;
    };
    img.src = paintData;
  }, [paintCanvas, paintTexture, paintData]);

  // Load / Clear sculpt data
  useEffect(() => {
    const ctx = sculptCanvas.getContext('2d');
    if (!ctx) return;

    if (!sculptData) {
      // Fill canvas with middle-gray (representing 0 displacement)
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, 256, 256);
      
      const heights = sculptHeightsRef.current;
      heights.fill(0);
      if (typeof window !== 'undefined') {
        (window as any).sculptHeights = heights;
      }
      setSculptTrigger(prev => prev + 1);
      globalIsSculptLoaded = true;
      setIsSculptLoaded(true);
      onSculptLoaded?.();
      return;
    }

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, 256, 256);
      ctx.drawImage(img, 0, 0);
      
      // Update heights cache
      const imgData = ctx.getImageData(0, 0, 256, 256).data;
      const heights = sculptHeightsRef.current;
      for (let i = 0; i < 256 * 256; i++) {
        const rValue = imgData[i * 4];
        heights[i] = ((rValue - 128) / 128) * 35; // maxDisplacement = 35 meters
      }
      if (typeof window !== 'undefined') {
        (window as any).sculptHeights = heights;
      }
      setSculptTrigger(prev => prev + 1);
      globalIsSculptLoaded = true;
      setIsSculptLoaded(true);
      onSculptLoaded?.();
    };
    img.src = sculptData;
  }, [sculptCanvas, sculptData]);

  const handlePaint = useCallback((uv: THREE.Vector2, isShiftPressed: boolean = false) => {
    if (!paintMode) return;
    
    if (terrainMode === 'paint') {
      const ctx = paintCanvas.getContext('2d');
      if (ctx) {
        const x = uv.x * 1024;
        const y = (1 - uv.y) * 1024;
        
        ctx.save();
        ctx.globalAlpha = brushStrength;
        ctx.translate(x, y);
        ctx.rotate((brushRotation * Math.PI) / 180);
        ctx.fillStyle = brushColor;
        ctx.strokeStyle = brushColor;
        
        switch (brushMaskId) {
          case 'softCircle': {
            const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, brushSize);
            grad.addColorStop(0, brushColor);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, brushSize, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'hardCircle':
            ctx.beginPath();
            ctx.arc(0, 0, brushSize, 0, Math.PI * 2);
            ctx.fill();
            break;
          case 'star': {
            ctx.beginPath();
            const spikes = 8;
            const outerRadius = brushSize;
            const innerRadius = brushSize * 0.4;
            let r = -Math.PI / 2;
            const angleStep = Math.PI / spikes;
            ctx.moveTo(0, -outerRadius);
            for (let i = 0; i < spikes; i++) {
              ctx.lineTo(Math.cos(r) * outerRadius, Math.sin(r) * outerRadius);
              r += angleStep;
              ctx.lineTo(Math.cos(r) * innerRadius, Math.sin(r) * innerRadius);
              r += angleStep;
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'hexagon': {
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
              const angle = (Math.PI / 3) * i;
              const sx = Math.cos(angle) * brushSize;
              const sy = Math.sin(angle) * brushSize;
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            ctx.fill();
            break;
          }
          case 'starOutline': {
            ctx.strokeStyle = brushColor;
            ctx.lineWidth = brushSize * 0.3;
            ctx.beginPath();
            ctx.arc(0, 0, brushSize * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            break;
          }
          case 'square':
            ctx.fillRect(-brushSize, -brushSize, brushSize * 2, brushSize * 2);
            break;
          default:
            break;
        }
        
        ctx.restore();
        paintTexture.needsUpdate = true;
      }
    } else if (terrainMode === 'sculpt') {
      const ctx = sculptCanvas.getContext('2d');
      if (ctx) {
        const x = uv.x * 256;
        const y = (1 - uv.y) * 256;
        const scaledBrushSize = brushSize * (256 / 1024);
        
        if (sculptTool === 'smooth') {
          const r = Math.ceil(scaledBrushSize);
          const startX = Math.max(0, Math.floor(x - r));
          const startY = Math.max(0, Math.floor(y - r));
          const width = Math.min(256 - startX, Math.ceil(r * 2));
          const height = Math.min(256 - startY, Math.ceil(r * 2));
          
          if (width > 0 && height > 0) {
            const imgData = ctx.getImageData(startX, startY, width, height);
            const data = imgData.data;
            const originalData = new Uint8ClampedArray(data);
            
            for (let dy = 0; dy < height; dy++) {
              for (let dx = 0; dx < width; dx++) {
                const px = startX + dx;
                const py = startY + dy;
                const dist = Math.hypot(px - x, py - y);
                if (dist <= scaledBrushSize) {
                  let sum = 0;
                  let count = 0;
                  for (let ny = -2; ny <= 2; ny++) {
                    for (let nx = -2; nx <= 2; nx++) {
                      const gX = Math.max(0, Math.min(width - 1, dx + nx));
                      const gY = Math.max(0, Math.min(height - 1, dy + ny));
                      const idx = (gY * width + gX) * 4;
                      sum += originalData[idx];
                      count++;
                    }
                  }
                  const avg = Math.round(sum / count);
                  const destIdx = (dy * width + dx) * 4;
                  
                  // Blending factor based on brush strength
                  const factor = brushStrength;
                  data[destIdx] = Math.round(originalData[destIdx] * (1 - factor) + avg * factor);
                  data[destIdx + 1] = data[destIdx];
                  data[destIdx + 2] = data[destIdx];
                }
              }
            }
            ctx.putImageData(imgData, startX, startY);
          }
        } else {
          ctx.save();
          ctx.globalAlpha = brushStrength;
          ctx.translate(x, y);
          ctx.rotate((brushRotation * Math.PI) / 180);
          
          const color = 
            (sculptTool === 'raise' && !isShiftPressed) || (sculptTool === 'lower' && isShiftPressed) ? '#ffffff' : 
            (sculptTool === 'lower' && !isShiftPressed) || (sculptTool === 'raise' && isShiftPressed) ? '#000000' : 
            '#808080'; // flatten to sea-level (neutral 0)
            
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          
          switch (brushMaskId) {
            case 'softCircle': {
              const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, scaledBrushSize);
              grad.addColorStop(0, color);
              grad.addColorStop(1, 'transparent');
              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.arc(0, 0, scaledBrushSize, 0, Math.PI * 2);
              ctx.fill();
              break;
            }
            case 'hardCircle':
              ctx.beginPath();
              ctx.arc(0, 0, scaledBrushSize, 0, Math.PI * 2);
              ctx.fill();
              break;
            case 'star': {
              ctx.beginPath();
              const spikes = 8;
              const outerRadius = scaledBrushSize;
              const innerRadius = scaledBrushSize * 0.4;
              let r = -Math.PI / 2;
              const angleStep = Math.PI / spikes;
              ctx.moveTo(0, -outerRadius);
              for (let i = 0; i < spikes; i++) {
                ctx.lineTo(Math.cos(r) * outerRadius, Math.sin(r) * outerRadius);
                r += angleStep;
                ctx.lineTo(Math.cos(r) * innerRadius, Math.sin(r) * innerRadius);
                r += angleStep;
              }
              ctx.closePath();
              ctx.fill();
              break;
            }
            case 'hexagon': {
              ctx.beginPath();
              for (let i = 0; i < 6; i++) {
                const angle = (Math.PI / 3) * i;
                const sx = Math.cos(angle) * scaledBrushSize;
                const sy = Math.sin(angle) * scaledBrushSize;
                if (i === 0) ctx.moveTo(sx, sy);
                else ctx.lineTo(sx, sy);
              }
              ctx.closePath();
              ctx.fill();
              break;
            }
            case 'starOutline': {
              ctx.strokeStyle = color;
              ctx.lineWidth = scaledBrushSize * 0.3;
              ctx.beginPath();
              ctx.arc(0, 0, scaledBrushSize * 0.7, 0, Math.PI * 2);
              ctx.stroke();
              break;
            }
            case 'square':
              ctx.fillRect(-scaledBrushSize, -scaledBrushSize, scaledBrushSize * 2, scaledBrushSize * 2);
              break;
            default:
              break;
          }
          
          ctx.restore();
        }
        
        const imgData = ctx.getImageData(0, 0, 256, 256).data;
        const heights = sculptHeightsRef.current;
        for (let i = 0; i < 256 * 256; i++) {
          const rValue = imgData[i * 4];
          heights[i] = ((rValue - 128) / 128) * 35; // maxDisplacement = 35 meters
        }
        
        if (typeof window !== 'undefined') {
          (window as any).sculptHeights = heights;
        }
        
        // Imperative update of vertices in PlaneGeometry
        const geo = meshRef.current?.geometry as THREE.BufferGeometry;
        if (geo) {
          const pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vy = pos.getY(i);
            const procElevation = getTerrainElevation(vx, vy, "STORM", baseDistance, terrainConfig, true);
            
            const u = (vx + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
            const v = (vy + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
            const px = Math.max(0, Math.min(255, Math.round(u * 255)));
            const py = Math.max(0, Math.min(255, Math.round((1 - v) * 255)));
            const idx = py * 256 + px;
            const sculptOffset = heights[idx] || 0;
            
            pos.setZ(i, procElevation + sculptOffset);
          }
          pos.needsUpdate = true;
          geo.computeVertexNormals();
          if ((geo as any).boundsTree) {
            (geo as any).boundsTree.refit();
          }
        }
      }
    }
  }, [
    paintMode, 
    terrainMode, 
    sculptTool, 
    brushSize, 
    brushColor, 
    brushStrength, 
    brushRotation, 
    brushMaskId, 
    paintCanvas, 
    paintTexture, 
    sculptCanvas, 
    baseDistance, 
    terrainConfig
  ]);

  // Safely construct texture paths to avoid 'undefined' or empty string loading
  const texturePaths = useMemo(() => {
    const p: Record<string, string> = { map: matInfo?.diffuse || EMPTY_TEXTURE };
    if (matInfo?.normal) p.normalMap = matInfo.normal;
    if (matInfo?.roughness) p.roughnessMap = matInfo.roughness;
    if (matInfo?.displacement) p.displacementMap = matInfo.displacement;
    return p;
  }, [matInfo]);

  // Load textures if selected
  const textures = useTexture(texturePaths as any, (tex: any) => {
    const applySettings = (t: THREE.Texture) => {
      if (!t) return;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(30, 30);
      t.anisotropy = 16;
    };

    if (tex instanceof THREE.Texture) {
      applySettings(tex);
    } else if (tex && typeof tex === 'object') {
      Object.values(tex).forEach((t: any) => {
        if (t instanceof THREE.Texture) applySettings(t);
      });
    }
  });

  // Update uniforms when textures or colors load
  useEffect(() => {
    const tex = textures as any;
    if (tex.map) {
      TerrainMaterial.uniforms.uMap.value = tex.map;
      TerrainMaterial.uniforms.uUseMap.value = matInfo ? 1.0 : 0.0;
    } else {
      TerrainMaterial.uniforms.uUseMap.value = 0.0;
    }
    
    TerrainMaterial.uniforms.baseColor.value.set(terrainColor);
    TerrainMaterial.uniforms.uPaintMap.value = paintTexture;
    TerrainMaterial.uniforms.uUsePaint.value = 1.0;
    
    // Update brush texture uniforms
    TerrainMaterial.uniforms.uBrushTex.value = brushTex;
    TerrainMaterial.uniforms.uUseBrushTex.value = brushInfo ? 1.0 : 0.0;
  }, [textures, matInfo, terrainColor, paintTexture, brushTex, brushInfo]);

  const terrainGeo = useMemo(() => {
    const segs = potatoMode ? 64 : 128;
    const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segs, segs);
    const pos = geo.attributes.position;
    const heights = sculptHeightsRef.current;
    
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        
        // Procedural noise height (without sculpt offset)
        const procElevation = getTerrainElevation(x, y, "STORM", baseDistance, terrainConfig, true);
        
        // Map 3D coordinate on plane to 0-255 canvas index
        const u = (x + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
        const v = (y + TERRAIN_SIZE / 2) / TERRAIN_SIZE;
        
        const px = Math.max(0, Math.min(255, Math.round(u * 255)));
        const py = Math.max(0, Math.min(255, Math.round((1 - v) * 255)));
        const idx = py * 256 + px;
        const sculptOffset = heights[idx] || 0;
        
        pos.setZ(i, procElevation + sculptOffset);
    }
    geo.computeVertexNormals();
    (geo as any).computeBoundsTree({ maxDepth: 64, maxLeafSize: 5 });
    return geo;
  }, [baseDistance, potatoMode, terrainConfig, sculptTrigger]);

  // Signal parent that terrain BVH is ready (1 frame after mount)
  useEffect(() => {
    const id = requestAnimationFrame(() => onReady?.());
    return () => cancelAnimationFrame(id);
  }, [terrainGeo, onReady]);

  const meshRef = useRef<THREE.Mesh>(null!);
  
  useEffect(() => {
    if (meshRef.current) {
      registerCollider(meshRef.current);
      return () => unregisterCollider(meshRef.current);
    }
  }, [terrainGeo]);

  if (!isSculptLoaded) return null;

  return (
    <>
      <mesh 
        ref={meshRef}
        name="terrain"
        geometry={terrainGeo} 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, GROUND_Y, 0]} 
        receiveShadow={!potatoMode}
        onPointerDown={(e: any) => {
          if (paintMode && e.button === 0) {
            e.stopPropagation();
            isDrawingRef.current = true;
            if (e.uv) handlePaint(e.uv, e.shiftKey);
          }
        }}
        onPointerMove={(e: any) => {
          if (paintMode) {
            e.stopPropagation();
            if (e.buttons === 1) {
              isDrawingRef.current = true;
              if (e.uv) handlePaint(e.uv, e.shiftKey);
            }
          }
        }}
      >
        <primitive object={TerrainMaterial} attach="material" wireframe={debug} />
      </mesh>

      {paintMode && brushHoverPos && (
        <mesh 
          position={[brushHoverPos[0], brushHoverPos[1] + 0.15, brushHoverPos[2]]} 
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[
            Math.max(0.1, brushSize * (1500 / 1024) - 0.7), 
            brushSize * (1500 / 1024) + 0.7, 
            64
          ]} />
          <meshBasicMaterial 
            color={ringColor} 
            transparent 
            opacity={0.85} 
            side={THREE.DoubleSide} 
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
};






export const StormEnvironment = ({ baseDistance = 24, potatoMode = false, debug = false, onReady }: {
  baseDistance?: number;
  potatoMode?: boolean;
  debug?: boolean;
  onReady?: () => void;
}) => {
  const weather    = useStore(s => s.weather);
  const gameState  = useStore(s => s.gameState);
  const isSetup    = gameState === "SETUP";
  const { spawnVFX } = useVFX();
  const [terrainLoaded, setTerrainLoaded] = useState(false);

  useEffect(() => {
    globalIsSculptLoaded = false;
    globalSculptHeights.fill(0);
  }, []);

  useFrame(state => {
    if (isSetup || potatoMode) return;
    if (state.clock.elapsedTime % 0.25 < 0.025) {
      if (characterStatus && characterStatus.position) {
          const px = characterStatus.position.x;
          const pz = characterStatus.position.z;
          if (weather === "CLEAR") {
            spawnVFX([px + (Math.random()-0.5)*60, 1+Math.random()*5, pz + (Math.random()-0.5)*60], "dust-mote", "#ffffff");
          } else if (weather === "THUNDER") {
            spawnVFX([px + (Math.random()-0.5)*80, 0.5, pz + (Math.random()-0.5)*80], "environment-mist", "#a855f7");
          }
      }
    }
  });

  // DISABLED: Weather rotation hidden to maintain permanent daytime
  /*
  useEffect(() => {
    if (isSetup) return;
    const cycle = () => {
      const opts = ["CLEAR","RAIN","STORM","THUNDER"] as const;
      setWeather(opts[Math.floor(Math.random() * opts.length)]);
      setTimeout(cycle, 20000 + Math.random() * 30000);
    };
    const t = setTimeout(cycle, 60000);
    return () => clearTimeout(t);
  }, [setWeather, isSetup]);
  */



  if (potatoMode) {
    return (
      <group>
        <color attach="background" args={["#c8d8f0"]} />
        <hemisphereLight intensity={1.5} groundColor="#556655" />
        <ambientLight intensity={0.8} />
        <Terrain baseDistance={baseDistance} potatoMode />
      </group>
    );
  }

  const fogNear = 120;
  const fogFar  = 1200;
  const fogColor = "#c8dff0";

  return (
    <group>
      <Environment 
        files="/qwantani_sunset_1k.exr"
        background
        blur={0}
      />
      <hemisphereLight intensity={1.0} color="#ffffff" groundColor="#445544" />
      <ambientLight intensity={0.8} />

      <directionalLight
        position={[10, 100, 10]}
        intensity={2.5}

        castShadow={!isSetup}
        shadow-mapSize={[512, 512]}
        shadow-bias={-0.0001}


        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />

      {terrainLoaded ? (
        <StaticCollider 
          debug={debug}
          restitution={0}
          friction={1}
          BVHOptions={{
            strategy: 1, // SAH
            maxDepth: 64,
            maxLeafSize: 5,
            verbose: false
          } as any}
        >
          <Terrain baseDistance={baseDistance} debug={debug} onReady={onReady} onSculptLoaded={() => setTerrainLoaded(true)} />
        </StaticCollider>
      ) : (
        <group visible={false}>
          <Terrain baseDistance={baseDistance} debug={debug} onSculptLoaded={() => setTerrainLoaded(true)} />
        </group>
      )}
      
      {/* Rain and Lightning disabled for permanent daytime */}
      <fog attach="fog" args={[fogColor, fogNear, fogFar]} />
    </group>
  );
};
