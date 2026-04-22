import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@commit-analyzer/diff-parser": fileURLToPath(
        new URL("./src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**"],
      exclude: ["src/**/*.spec.ts"],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
});
