import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  bundle: true,
  noExternal: [/^@commit-analyzer\//],
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  shims: false,
  dts: false,
  banner: { js: "#!/usr/bin/env node" },
});
