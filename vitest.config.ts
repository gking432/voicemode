import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

const r = (p: string) => resolve(__dirname, p);

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["packages/**/src/**/*.{test,spec}.ts"],
    coverage: {
      provider: "v8",
      include: ["packages/**/src/**/*.ts"],
      exclude: ["packages/**/src/**/*.{test,spec}.ts", "packages/**/src/index.ts"],
    },
  },
  resolve: {
    alias: {
      "@vco/shared": r("packages/shared/src/index.ts"),
      "@vco/db": r("packages/db/src/index.ts"),
      "@vco/project-adapters": r("packages/project-adapters/src/index.ts"),
      "@vco/agents": r("packages/agents/src/index.ts"),
      "@vco/orchestrator": r("packages/orchestrator/src/index.ts"),
    },
  },
});
