import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    /* config options here */
    allowedDevOrigins: ["192.168.1.11", "192.168.0.55", "192.168.13.2"],
    // Set turbopack root to current directory
    turbopack: {
        // path.resolve() will use current working directory, which in dev mode is the project root
        root: path.resolve("."),
    },
    // Ensure that heavy three.js imports are optimized
    transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
    experimental: {
        optimizePackageImports: ["three", "lucide-react"],
    },
};

export default nextConfig;
