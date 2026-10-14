import { defineConfig, devices } from "@playwright/test";

/**
 * E2E_MODE=live (default): the real app (`next start`) against a migrated,
 * seeded database. Run `npm run build` first.
 * E2E_MODE=demo: the static GitHub Pages export in `out/`, served under /waymark.
 * Run `NEXT_PUBLIC_BASE_PATH=/waymark npm run build:demo` first.
 */
const live = (process.env.E2E_MODE ?? "live") === "live";
const ci = !!process.env.CI;

export default defineConfig({
  testDir: live ? "e2e/live" : "e2e/demo",
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: live ? "http://localhost:3000" : "http://localhost:3001/waymark/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    // Flow tests change data, so they run once (desktop); everything else runs at phone width too.
    { name: "phone", testIgnore: /flow\.spec/, use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  webServer: live
    ? {
        command: "npx next start -p 3000",
        url: "http://localhost:3000/sign-in",
        reuseExistingServer: !ci,
        timeout: 120_000,
        // Many sign-ins in quick succession from one address.
        env: { WAYMARK_DEV_TOOLS: "1", AUTH_SIGNIN_LIMIT: process.env.E2E_SIGNIN_LIMIT ?? "200" },
      }
    : {
        command: "node e2e/serve-static.mjs",
        url: "http://localhost:3001/waymark/",
        reuseExistingServer: !ci,
        timeout: 30_000,
      },
});
