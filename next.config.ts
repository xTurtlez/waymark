import type { NextConfig } from "next";

/**
 * Static export so the app can be hosted on GitHub Pages (or any static host).
 * Everything runs in the browser for now, so no server is needed.
 * NEXT_PUBLIC_BASE_PATH is set by the deploy workflow to "/<repo-name>".
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  basePath,
  images: { unoptimized: true },
};

export default nextConfig;
