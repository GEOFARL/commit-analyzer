// Module boundary preset for apps/web (Next.js).
//
// Encodes the component inventory in docs/06-frontend.md §1–2 and the
// golden rules in docs/02-architecture-global.md §7: feature folders live
// under src/features/* and are sibling-isolated (enforced by the local
// `local-web/no-cross-feature-imports` rule), ui primitives may not depend
// on features, and no web code may reach into apps/api (ADR-0002).

import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

import base from "./base.js";

const elements = [
  { type: "app-route", pattern: "src/app" },
  { type: "ui", pattern: "src/components/ui" },
  { type: "shared-components", pattern: "src/components/shared" },
  { type: "layout-chrome", pattern: "src/components/layout" },
  { type: "providers", pattern: "src/components/providers" },
  {
    type: "feature",
    pattern: "src/features/*",
    capture: ["name"],
    mode: "folder",
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
        "src/features/**/*.{ts,tsx}",
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
              allow: {
                to: {
                  type: [
                    "feature",
                    "ui",
                    "shared-components",
                    "layout-chrome",
                    "providers",
                    "lib",
                    "i18n",
                  ],
                },
              },
            },
            {
              from: { type: "feature" },
              allow: {
                to: {
                  type: ["feature", "ui", "shared-components", "lib", "i18n"],
                },
              },
            },
            {
              from: { type: "providers" },
              allow: { to: { type: ["ui", "lib", "i18n"] } },
            },
            {
              from: { type: "layout-chrome" },
              allow: {
                to: { type: ["ui", "lib", "i18n", "layout-chrome"] },
              },
            },
            {
              from: { type: "shared-components" },
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
