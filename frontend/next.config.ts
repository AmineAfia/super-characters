import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  // Preserve trailing slashes for Wails compatibility
  trailingSlash: true,
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
