import * as THREE from 'three';

/**
 * Shared GLSL snippets for painterly effects
 */
export const PainterlyShaderUtils = {
    // Simplex Noise for Mountains
    snoise: `
        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        float snoise(vec2 v){
            const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
            vec2 i  = floor(v + dot(v, C.yy) );
            vec2 x0 = v -   i + dot(i, C.xx);
            vec2 i1;
            i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
            vec4 x12 = x0.xyxy + C.xxzz;
            x12.xy -= i1;
            i = mod(i, 289.0);
            vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
            vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
            m = m*m ; m = m*m ;
            vec3 x = 2.0 * fract(p * C.www) - 1.0;
            vec3 h = abs(x) - 0.5;
            vec3 ox = floor(x + 0.5);
            vec3 a0 = x - ox;
            m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
            vec3 g;
            g.x  = a0.x  * x0.x  + h.x  * x0.y;
            g.yz = a0.yz * x12.xz + h.yz * x12.yw;
            return 130.0 * dot(m, g);
        }
    `,
    // A stylized noise function to simulate brushstrokes
    brushstrokeNoise: `
        float hash(vec2 p) {
            p = fract(p * vec2(123.34, 456.21));
            p += dot(p, p + 45.32);
            return fract(p.x * p.y);
        }

        float painterlyNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            
            float a = hash(i);
            float b = hash(i + vec2(1.0, 0.0));
            float c = hash(i + vec2(0.0, 1.0));
            float d = hash(i + vec2(1.0, 1.0));
            
            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float brushstrokes(vec2 p, float scale) {
            float n = 0.0;
            n += painterlyNoise(p * scale);
            n += painterlyNoise(p * scale * 2.1) * 0.5;
            n += painterlyNoise(p * scale * 4.3) * 0.25;
            return n / 1.75;
        }
    `,
    // Toon Shading Mix
    toonMix: `
        vec3 toonMix(vec3 c1, vec3 c2, float t) {
            // Apply distinct bands for cartoon look
            float stepped = floor(t * 4.0) / 3.0;
            return mix(c1, c2, clamp(stepped, 0.0, 1.0));
        }
    `
};

// --- 1. RAINY/CYAN WATER MATERIAL ---
export const PainterlyWaterMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        color1: { value: new THREE.Color("#00f5d4") }, // Bright Cyan
        color2: { value: new THREE.Color("#00bbaf") }, // Deep Teal
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        uniform float time;

        void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            
            // Subtle wave distortion for diorama feel
            float wave = sin(worldPos.x * 0.2 + time * 1.5) * 0.1;
            wave += cos(worldPos.z * 0.15 + time * 1.2) * 0.08;
            worldPos.y += wave;
            
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        uniform float time;
        uniform vec3 color1;
        uniform vec3 color2;

        ${PainterlyShaderUtils.brushstrokeNoise}
        ${PainterlyShaderUtils.toonMix}

        void main() {
            // Animated painterly texture
            float strokes = brushstrokes(vWorldPos.xz + time * 0.1, 0.5);
            float highlights = brushstrokes(vWorldPos.xz - time * 0.2, 2.0);
            
            vec3 color = toonMix(color2, color1, strokes);
            color += highlights * 0.15; // Foam/Highlights
            
            // Fresnel-like edge fade
            float edge = smoothstep(200.0, 100.0, length(vWorldPos.xz));
            
            gl_FragColor = vec4(color, edge * 0.9);
        }
    `,
    transparent: true,
});

// --- 2. GOLDEN ISLAND & CARTOON MOUNTAINS MATERIAL ---
export const PainterlyTerrainMaterial = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        sandColor: { value: new THREE.Color("#fca311") },
        rockColor: { value: new THREE.Color("#d00000") },
        mountainColor: { value: new THREE.Color("#432818") }, // Warm brown for cartoon hills
        baseDist: { value: 24.0 },
    },
    vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vElevation;
        uniform float baseDist;

        ${PainterlyShaderUtils.snoise}

        void main() {
            vUv = uv;
            vec3 pos = position;

            // Mountain Generation (Simplex Noise mask)
            float dist = length(pos.xy);
            float mask = smoothstep(baseDist + 15.0, baseDist + 50.0, dist); 
            
            float elevation = snoise(pos.xy * 0.015) * 35.0;
            // elevation += snoise(pos.xy * 0.04) * 8.0;
            // elevation *= mask;
            
            // pos.z += max(elevation, 0.0);
            vElevation = pos.z;

            vec4 worldPos = modelMatrix * vec4(pos, 1.0);
            vWorldPos = worldPos.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
    `,
    fragmentShader: `
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying float vElevation;
        uniform vec3 sandColor;
        uniform vec3 rockColor;
        uniform vec3 mountainColor;

        ${PainterlyShaderUtils.brushstrokeNoise}
        ${PainterlyShaderUtils.toonMix}

        void main() {
            float strokes = brushstrokes(vWorldPos.xz * 1.5 + vElevation * 0.5, 0.8);
            
            // Mix colors based on elevation and strokes with TOON banding
            float mixFactor = clamp(vElevation * 0.1 + strokes * 0.25, 0.0, 1.0);
            vec3 baseColor = mix(sandColor, rockColor, clamp(vElevation * 0.2, 0.0, 1.0));
            
            vec3 color = toonMix(baseColor, mountainColor, mixFactor);
            
            // Subtly darken edges with toon steps
            color *= (0.8 + 0.2 * floor(strokes * 3.0) / 3.0);
            
            gl_FragColor = vec4(color, 1.0);
        }
    `,
});

// --- 5. PAINTERLY GRASS MATERIAL ---
export const PainterlyGrassMaterial = new THREE.ShaderMaterial({
  uniforms: {
    time: { value: 0 },
    color1: { value: new THREE.Color("#4a7c44") }, // Deep Green
    color2: { value: new THREE.Color("#9ef01a") }, // Lime Green
  },
  vertexShader: `
    uniform float time;
    varying vec2 vUv;
    varying float vY;

    void main() {
      vUv = uv;
      vY = position.y;
      vec4 worldPos = instanceMatrix * vec4(position, 1.0);
      
      // Sway animation
      float wind = sin(time * 2.0 + worldPos.x * 0.1 + worldPos.z * 0.05) * 0.4;
      if (position.y > 0.0) {
        worldPos.x += wind * position.y;
        worldPos.z += wind * position.y;
      }
      
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying float vY;
    uniform vec3 color1;
    uniform vec3 color2;
    uniform float time;

    ${PainterlyShaderUtils.brushstrokeNoise}
    ${PainterlyShaderUtils.toonMix}

    void main() {
      // OPTIMIZATION: Use a simple gradient + time-based flicker instead of expensive brushstrokes
      vec3 color = mix(color1, color2, vY + 0.5);
      // Subtle light variation based on UV
      color *= (0.9 + 0.1 * sin(vUv.x * 10.0 + time));
      gl_FragColor = vec4(color, 1.0);
    }
  `,
  side: THREE.DoubleSide,
});




// --- 4. UTILITY: APPLY PAINTERLY STYLE TO ANY MATERIAL ---
export const applyPainterlyStyle = (material: THREE.Material) => {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.time = { value: 0 };
        
        shader.vertexShader = `
            varying vec3 vWorldPos;
            varying vec3 vPainterlyNormal;
            ${shader.vertexShader}
        `.replace(
            '#include <worldpos_vertex>',
            `
            #include <worldpos_vertex>
            vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vPainterlyNormal = normalize(normalMatrix * normal);
            `
        );

        shader.fragmentShader = `
            uniform float time;
            varying vec3 vWorldPos;
            varying vec3 vPainterlyNormal;
            ${PainterlyShaderUtils.brushstrokeNoise}
            ${shader.fragmentShader}
        `.replace(
            '#include <color_fragment>',
            `
            #include <color_fragment>
            float strokes = brushstrokes(vWorldPos.xz * 15.0 + vWorldPos.y * 5.0, 0.4);
            diffuseColor.rgb *= (0.85 + 0.3 * strokes);
            `
        ).replace(
            '#include <opaque_fragment>',
            `
            #include <opaque_fragment>
            // Subtle rim light / saturator for readability + Shield Aura
            vec3 normalVec = normalize(vPainterlyNormal);
            float rim = 1.0 - max(0.0, dot(normalVec, vec3(0.0, 0.0, 1.0)));
            
            // Pulse effect for shield
            float pulse = (0.8 + 0.2 * sin(time * 4.0));
            
            // Apply color from emissive (which we use for rarity)
            vec3 shieldCol = emissive; 
            float shieldLower = pow(rim, 4.0);
            float shieldUpper = pow(rim, 1.5) * 0.6;
            
            gl_FragColor.rgb += shieldCol * (shieldLower + shieldUpper) * pulse * 3.5;
            
            // Standard readability rim
            gl_FragColor.rgb += pow(rim, 4.0) * gl_FragColor.rgb * 0.2;
            `
        );
        
        material.userData.painterlyShader = shader;
    };
};



