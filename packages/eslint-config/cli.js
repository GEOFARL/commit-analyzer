// Module boundary preset for apps/cli.
//
// Layered architecture per docs/03-modules/E-cli.md and the golden rules
// in docs/02-architecture-global.md §7 (notably rule 4, the cross-app
// ban). Bounded contexts per docs/13-adrs/0002-cqrs-bounded-contexts.md:
// commands may not call sibling commands and CLI code may not reach
// into apps/api.

import boundaries from "eslint-plugin-boundaries";
import globals from "globals";

import base from "./base.js";

const elements = [
  { type: "entry", mode: "file", pattern: "index.ts" },
  {
    type: "commands",
    pattern: "src/commands/*",
    capture: ["name"],
  },
  { type: "services", pattern: "src/services" },
  { type: "lib", pattern: "src/lib" },
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
        "apps/cli must not import from apps/api — see docs/02-architecture-global.md §7 rule 4.",
    },
  ],
};

export default [
  ...base,
  {
    languageOptions: { globals: { ...globals.node } },
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*.ts"],
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
            { from: { type: "entry" }, allow: { to: { type: "commands" } } },
            {
              from: { type: "commands" },
              allow: { to: { type: ["services", "lib"] } },
            },
            { from: { type: "services" }, allow: { to: { type: "lib" } } },
          ],
        },
      ],
      "no-restricted-imports": ["error", crossAppBan],
    },
  },
];
