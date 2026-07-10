import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.resolve.alias["@/lib/firebase/admin"] = path.resolve(
        __dirname,
        "tests/mocks/admin-mock.ts"
      );
    }
    return config;
  },
  turbopack: {
    resolveAlias: {
      ...(process.env.NODE_ENV !== "production" ? {
        "@/lib/firebase/admin": "./tests/mocks/admin-mock.ts",
      } : {}),
    },
  },
};

export default nextConfig;
