import { readFileSync } from "node:fs";

import { defineConfig } from "tsup";

const pkg = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  entry: { index: "src/index.ts" },
  outDir: "dist",
  format: ["esm"],
  target: "node20",
  bundle: true,
  noExternal: [/^@commit-analyzer\//],
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
  clean: true,
  sourcemap: true,
  minify: false,
  splitting: false,
  shims: false,
  dts: false,
  banner: { js: "#!/usr/bin/env node" },
});
