// Module boundary preset for apps/api (NestJS).
//
// Enforces the golden rules in docs/02-architecture-global.md §7 and the
// bounded contexts defined in docs/13-adrs/0002-cqrs-bounded-contexts.md.
// Cross-module imports are banned: modules talk via the CQRS bus or
// @repo/contracts, never by reaching into a sibling module's folder.

import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

import base from "./base.js";

const elements = [
  {
    type: "app",
    mode: "file",
    pattern: "{index,main,bootstrap,app.module}.ts",
  },
  { type: "common", pattern: "src/common" },
  {
    type: "module",
    pattern: "src/modules/*",
    capture: ["name"],
  },
];

export default [
  ...base,
  {
    languageOptions: { globals: { ...globals.node } },
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*.ts"],
      "boundaries/ignore": ["**/*.test.ts", "**/*.spec.ts"],
      "boundaries/elements": elements,
    },
    rules: {
      "boundaries/no-unknown": "error",
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          rules: [
            {
              from: { type: "app" },
              allow: { to: { type: ["app", "common", "module"] } },
            },
            {
              from: { type: "module" },
              allow: { to: { type: "common" } },
            },
          ],
        },
      ],
    },
  },
];
