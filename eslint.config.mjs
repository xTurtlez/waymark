import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "design-handoff/**", "drizzle/**", "playwright-report/**", "test-results/**", "next-env.d.ts"],
  },
];

export default config;
