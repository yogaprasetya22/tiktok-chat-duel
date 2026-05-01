import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    /* config options here */
    allowedDevOrigins: [
        "192.168.1.11",
        "192.168.0.55",
        "192.168.13.2",
        "192.168.1.12",
    ],
    // Set turbopack root to current directory
    turbopack: {
        // path.resolve() will use current working directory, which in dev mode is the project root
        root: path.resolve("."),
    },
    // Ensure that heavy three.js imports are optimized
    transpilePackages: [
        "three",
        "@react-three/fiber",
        "@react-three/drei",
        "r3f-perf",
    ],
    images: {
        remotePatterns: [
            { protocol: "https", hostname: "**.tiktokcdn.com" },
            { protocol: "http", hostname: "**.tiktokcdn.com" },
            { protocol: "https", hostname: "**.byteimg.com" },
            { protocol: "https", hostname: "**.tiktokcdn-us.com" },
            { protocol: "http", hostname: "**.tiktokcdn-us.com" },
            { protocol: "https", hostname: "**.ftcdn.net" },
        ],
    },
    experimental: {
        optimizePackageImports: ["three", "lucide-react", "@react-three/drei"],
    },
};

export default nextConfig;
