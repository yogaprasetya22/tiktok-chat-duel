import os
import re

# Configuration
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(PROJECT_ROOT, "public")
TEXTURES_DIR = os.path.join(PUBLIC_DIR, "Textures")
OUTPUT_FILE = os.path.join(PROJECT_ROOT, "src", "core", "logic", "environment", "assetRegistry.ts")

DIRECTORIES = {
    "kingdom": os.path.join(PUBLIC_DIR, "kingdom"),
    "assets-env": os.path.join(PUBLIC_DIR, "assets-env"),
    "assets-tree/converted": os.path.join(PUBLIC_DIR, "assets-tree", "converted")
}

def format_name(filename):
    name = os.path.splitext(filename)[0]
    name = re.sub(r'[-_]', ' ', name)
    return name.title()

def find_texture(folder, pattern):
    """Finds a file in folder (recursive) matching a keyword pattern."""
    for root, dirs, files in os.walk(folder):
        for f in files:
            if any(p in f.lower() for p in pattern):
                # Prefer .jpg or .png for browser compatibility
                if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                    return os.path.relpath(os.path.join(root, f), PUBLIC_DIR)
    return None

def generate_registry():
    lines = [
        "'use client';",
        "",
        "export interface AssetInfo {",
        "  name: string;",
        "  path: string;",
        "  category: 'kingdom' | 'env' | 'tree';",
        "}",
        "",
        "export interface MaterialInfo {",
        "  id: string;",
        "  name: string;",
        "  diffuse?: string;",
        "  normal?: string;",
        "  roughness?: string;",
        "  displacement?: string;",
        "}",
        "",
        "export const FULL_ASSET_LIBRARY: AssetInfo[] = ["
    ]

    # 1. Generate Asset Registry
    for category_slug, dir_path in DIRECTORIES.items():
        if not os.path.exists(dir_path):
            continue

        slug_to_label = {
            "kingdom": "kingdom",
            "assets-env": "env",
            "assets-tree/converted": "tree"
        }
        category_label = slug_to_label.get(category_slug, "env")
        lines.append(f"  // {category_label.upper()} Assets")
        
        files = sorted([f for f in os.listdir(dir_path) if f.endswith(('.glb', '.gltf'))])
        for filename in files:
            name = format_name(filename)
            path = f"/{category_slug}/{filename}"
            lines.append(f"  {{ name: \"{name}\", path: \"{path}\", category: '{category_label}' }},")
        lines.append("")

    lines.append("];")
    lines.append("")

    # 2. Generate Material Registry
    lines.append("export const FULL_MATERIAL_LIBRARY: MaterialInfo[] = [")
    if os.path.exists(TEXTURES_DIR):
        folders = sorted([f for f in os.listdir(TEXTURES_DIR) if os.path.isdir(os.path.join(TEXTURES_DIR, f))])
        for folder_name in folders:
            full_path = os.path.join(TEXTURES_DIR, folder_name)
            
            diff = find_texture(full_path, ['diff', 'color', 'albedo', 'basecolor'])
            nor = find_texture(full_path, ['nor', 'nrm'])
            rough = find_texture(full_path, ['rough', 'rgh'])
            disp = find_texture(full_path, ['disp', 'height'])
            
            if diff:
                name = format_name(folder_name)
                lines.append(f"  {{")
                lines.append(f"    id: \"{folder_name}\",")
                lines.append(f"    name: \"{name}\",")
                lines.append(f"    diffuse: \"/{diff}\",")
                if nor: lines.append(f"    normal: \"/{nor}\",")
                if rough: lines.append(f"    roughness: \"/{rough}\",")
                if disp: lines.append(f"    displacement: \"/{disp}\",")
                lines.append(f"  }},")

    lines.append("];")

    # Write to file
    with open(OUTPUT_FILE, "w") as f:
        f.write("\n".join(lines))
    
    print(f"Successfully generated asset and material registry at: {OUTPUT_FILE}")

if __name__ == "__main__":
    generate_registry()
