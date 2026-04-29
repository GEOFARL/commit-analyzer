#!/usr/bin/env node
// Builds the Next.js app with stub env vars, so Lighthouse can audit a
// production build without real Supabase/GitHub credentials.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { STUB_ENV } from "./stub-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_DIR = resolve(__dirname, "..");

const result = spawnSync("pnpm", ["exec", "next", "build"], {
  cwd: WEB_DIR,
  env: { ...process.env, ...STUB_ENV },
  stdio: "inherit",
});

process.exit(result.status ?? 1);
