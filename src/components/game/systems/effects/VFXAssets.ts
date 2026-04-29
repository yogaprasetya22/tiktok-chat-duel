import * as THREE from 'three';

const isBrowser = typeof window !== 'undefined';
const textureLoader = isBrowser ? new THREE.TextureLoader() : null;

// Helper to load and configure texture
const loadTex = (url: string) => {
    if (!textureLoader) return new THREE.Texture(); // SSR placeholder
    const tex = textureLoader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
};

export const VFX_TEXTURES = {
    // Mage - Animated Sequence (1-5)
    magic: [
        loadTex('/kenney_particle-pack/PNG (Transparent)/magic_01.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/magic_03.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/magic_02.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/magic_05.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/magic_04.png'),
    ],
    scorch: loadTex('/kenney_particle-pack/PNG (Transparent)/scorch_03.png'),
    scorch_mewah: loadTex('/kenney_particle-pack/PNG (Transparent)/scorch_02.png'),
    flare: loadTex('/kenney_particle-pack/PNG (Transparent)/flare_01.png'),
    
    // Marksman - Animated Muzzle (1-5)
    muzzles: [
        loadTex('/kenney_particle-pack/PNG (Transparent)/muzzle_01.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/muzzle_02.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/muzzle_03.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/muzzle_04.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/muzzle_05.png'),
    ],
    bullet: loadTex('/kenney_particle-pack/PNG (Transparent)/trace_06.png'),
    sparks: [
        loadTex('/kenney_particle-pack/PNG (Transparent)/spark_01.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/spark_02.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/spark_03.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/spark_04.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/spark_05.png'),
    ],
    
    // Tank / Impact - Animated Shockwaves
    shockwaves: [
        loadTex('/kenney_particle-pack/PNG (Transparent)/circle_01.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/circle_02.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/circle_03.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/circle_04.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/circle_05.png'),
    ],
    shockwave: loadTex('/kenney_particle-pack/PNG (Transparent)/circle_03.png'),
    dirt: loadTex('/kenney_particle-pack/PNG (Transparent)/dirt_03.png'),
    
    // Fighter - Animated Slashes
    fighterSlashes: [
        loadTex('/kenney_particle-pack/PNG (Transparent)/slash_01.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/slash_02.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/slash_03.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/slash_04.png'),
    ],
    slash: loadTex('/kenney_particle-pack/PNG (Transparent)/slash_01.png'),
    slash_alt: loadTex('/kenney_particle-pack/PNG (Transparent)/slash_04.png'),
    hitSpark: loadTex('/kenney_particle-pack/PNG (Transparent)/spark_02.png'),
    radiant: loadTex('/kenney_particle-pack/PNG (Transparent)/star_06.png'),
    
    // Assassin
    scratch: loadTex('/kenney_particle-pack/PNG (Transparent)/scratch_01.png'),
    slashes: [
        loadTex('/kenney_particle-pack/PNG (Transparent)/slash_01.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/slash_02.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/slash_03.png'),
        loadTex('/kenney_particle-pack/PNG (Transparent)/slash_04.png'),
    ],
    critical: loadTex('/kenney_particle-pack/PNG (Transparent)/star_05.png'),
    
    // Global
    smoke: loadTex('/kenney_particle-pack/PNG (Transparent)/smoke_04.png'),
    smoke_alt: loadTex('/kenney_particle-pack/PNG (Transparent)/smoke_01.png'),
    twirl: loadTex('/kenney_particle-pack/PNG (Transparent)/twirl_01.png'),
    star: loadTex('/kenney_particle-pack/PNG (Transparent)/star_01.png'),
    shield: loadTex('/kenney_particle-pack/PNG (Transparent)/circle_05.png'),
};
