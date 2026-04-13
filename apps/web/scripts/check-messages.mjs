#!/usr/bin/env node
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(__dirname, "..", "messages");

const BASE_LOCALE = "en";

function collectKeys(obj, prefix = "") {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      keys.push(...collectKeys(v, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

function load(locale) {
  const raw = readFileSync(join(messagesDir, `${locale}.json`), "utf8");
  return JSON.parse(raw);
}

const catalogs = readdirSync(messagesDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(/\.json$/, ""));

if (!catalogs.includes(BASE_LOCALE)) {
  console.error(`Base locale ${BASE_LOCALE}.json not found`);
  process.exit(1);
}

const baseKeys = collectKeys(load(BASE_LOCALE));
let failed = false;

for (const locale of catalogs) {
  if (locale === BASE_LOCALE) continue;
  const keys = collectKeys(load(locale));
  const missing = baseKeys.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !baseKeys.includes(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`Catalog ${locale}.json drift:`);
    if (missing.length) console.error(`  missing: ${missing.join(", ")}`);
    if (extra.length) console.error(`  extra:   ${extra.join(", ")}`);
  }
}

if (failed) {
  console.error("\nMessage catalogs out of sync with base locale.");
  process.exit(1);
}

console.log(`Message catalogs in sync (${catalogs.join(", ")}).`);
