import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Preserve trailing slashes for Wails compatibility
  trailingSlash: true,
};

export default nextConfig;
