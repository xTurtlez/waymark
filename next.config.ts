import type { NextConfig } from "next";

/**
 * Two builds from one codebase:
 * - live (default): the real product on Vercel, backed by Postgres.
 * - demo (WAYMARK_MODE=demo): static export of the v1 prototype with seeded,
 *   browser-only data, for the public GitHub Pages demo.
 * Mode-specific files are named `*.live.tsx` / `*.demo.tsx`; shared screens
 * are plain `*.tsx`.
 */
const demo = process.env.WAYMARK_MODE === "demo";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  pageExtensions: demo ? ["demo.tsx", "demo.ts", "tsx", "ts"] : ["live.tsx", "live.ts", "tsx", "ts"],
  env: { NEXT_PUBLIC_WAYMARK_MODE: demo ? "demo" : "live" },
  ...(demo
    ? { output: "export" as const, trailingSlash: true, basePath, images: { unoptimized: true } }
    : {
        serverExternalPackages: ["postgres"],
        async headers() {
          return [{ source: "/:path*", headers: securityHeaders }];
        },
      }),
};

export default nextConfig;
