#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
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

function listLocales() {
  return readdirSync(messagesDir).filter((entry) => {
    const full = join(messagesDir, entry);
    return statSync(full).isDirectory();
  });
}

function listNamespaces(locale) {
  return readdirSync(join(messagesDir, locale))
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""))
    .sort();
}

function loadNamespace(locale, ns) {
  const raw = readFileSync(join(messagesDir, locale, `${ns}.json`), "utf8");
  return JSON.parse(raw);
}

const locales = listLocales();

if (!locales.includes(BASE_LOCALE)) {
  console.error(`Base locale directory ${BASE_LOCALE}/ not found`);
  process.exit(1);
}

const baseNamespaces = listNamespaces(BASE_LOCALE);
let failed = false;

for (const locale of locales) {
  if (locale === BASE_LOCALE) continue;

  const nsList = listNamespaces(locale);
  const missingFiles = baseNamespaces.filter((ns) => !nsList.includes(ns));
  const extraFiles = nsList.filter((ns) => !baseNamespaces.includes(ns));

  if (missingFiles.length) {
    failed = true;
    console.error(
      `Locale ${locale}/ is missing namespace files: ${missingFiles
        .map((ns) => `${ns}.json`)
        .join(", ")}`,
    );
  }
  if (extraFiles.length) {
    failed = true;
    console.error(
      `Locale ${locale}/ has extra namespace files not in ${BASE_LOCALE}/: ${extraFiles
        .map((ns) => `${ns}.json`)
        .join(", ")}`,
    );
  }

  for (const ns of baseNamespaces) {
    if (missingFiles.includes(ns)) continue;
    const baseKeys = new Set(collectKeys(loadNamespace(BASE_LOCALE, ns)));
    const localeKeys = new Set(collectKeys(loadNamespace(locale, ns)));
    const missing = [...baseKeys].filter((k) => !localeKeys.has(k));
    const extra = [...localeKeys].filter((k) => !baseKeys.has(k));
    if (missing.length || extra.length) {
      failed = true;
      console.error(`${locale}/${ns}.json drift:`);
      if (missing.length) console.error(`  missing: ${missing.join(", ")}`);
      if (extra.length) console.error(`  extra:   ${extra.join(", ")}`);
    }
  }
}

if (failed) {
  console.error("\nMessage catalogs out of sync with base locale.");
  process.exit(1);
}

console.log(
  `Message catalogs in sync (${locales.join(", ")}, ${baseNamespaces.length} namespaces).`,
);
