// Module boundary preset for apps/web (Next.js).
//
// Encodes the component inventory in docs/06-frontend.md §1–2 and the
// golden rules in docs/02-architecture-global.md §7: feature folders are
// sibling-isolated, ui primitives may not depend on features, and no web
// code may reach into apps/api (ADR-0002 bounded contexts).

import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

import base from "./base.js";

const elements = [
  { type: "app-route", pattern: "src/app" },
  { type: "ui", pattern: "src/components/ui" },
  {
    type: "feature",
    pattern: "src/components/*",
    capture: ["name"],
  },
  { type: "lib", pattern: "src/lib" },
  { type: "i18n", pattern: "src/i18n" },
];

const crossAppBan = {
  patterns: [
    {
      group: [
        "@commit-analyzer/api",
        "@commit-analyzer/api/*",
        "**/apps/api/*",
        "**/apps/api/**",
      ],
      message:
        "apps/web must not import from apps/api — see docs/02-architecture-global.md §7 rule 4.",
    },
  ],
};

export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { boundaries },
    settings: {
      "boundaries/include": [
        "src/app/**/*.{ts,tsx}",
        "src/components/**/*.{ts,tsx}",
        "src/lib/**/*.{ts,tsx}",
        "src/i18n/**/*.{ts,tsx}",
      ],
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
              from: { type: "app-route" },
              allow: { to: { type: ["feature", "ui", "lib", "i18n"] } },
            },
            {
              from: { type: "feature" },
              allow: { to: { type: ["ui", "lib", "i18n"] } },
            },
            { from: { type: "ui" }, allow: { to: { type: "lib" } } },
            { from: { type: "i18n" }, allow: { to: { type: "lib" } } },
          ],
        },
      ],
      "no-restricted-imports": ["error", crossAppBan],
    },
  },
];
