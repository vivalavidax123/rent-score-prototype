import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle (.next/standalone) for the Docker image.
  // Has no effect on Vercel deploys.
  output: "standalone",
};

export default nextConfig;
