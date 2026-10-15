import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") } },
  test: {
    // DB tests share one database, so test files run one at a time.
    fileParallelism: false,
    projects: [
      {
        extends: true,
        test: { name: "unit", include: ["tests/unit/**/*.test.ts", "tests/rules/**/*.test.ts", "src/**/*.test.ts"], environment: "node" },
      },
      {
        extends: true,
        test: {
          name: "db",
          include: ["tests/db/**/*.test.ts"],
          environment: "node",
          testTimeout: 30_000,
        },
      },
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/server/**", "src/rules/**"],
      exclude: ["src/rules/types.ts"],
      // The tax engine must stay fully tested (brief §3: 100% branch coverage).
      thresholds: { "src/rules/**": { statements: 100, branches: 100, functions: 100, lines: 100 } },
    },
  },
});
