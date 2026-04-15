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
  { type: "shared", pattern: "src/shared" },
  {
    type: "module",
    pattern: "src/modules/*",
    capture: ["name"],
  },
];

// Controllers and services should contain exactly one class and the imports
// it needs — nothing else. Constants, interfaces, type aliases, mappers, and
// helper functions belong in sibling files (`*.constants.ts`, `*.types.ts`,
// `*.mappers.ts`) so the class stays easy to scan and the helpers are
// independently testable/reusable.
const noTopLevelHelpers = (kind) => ({
  "no-restricted-syntax": [
    "error",
    {
      selector: "Program > VariableDeclaration",
      message: `${kind} must stay thin. Move constants to a sibling *.constants.ts file.`,
    },
    {
      selector: "Program > ExportNamedDeclaration > VariableDeclaration",
      message: `${kind} must stay thin. Move constants to a sibling *.constants.ts file.`,
    },
    {
      selector: "Program > FunctionDeclaration",
      message: `${kind} must stay thin. Move helpers to a sibling *.mappers.ts or dedicated helper file.`,
    },
    {
      selector: "Program > ExportNamedDeclaration > FunctionDeclaration",
      message: `${kind} must stay thin. Move helpers to a sibling *.mappers.ts or dedicated helper file.`,
    },
    {
      selector: "Program > TSInterfaceDeclaration",
      message: `${kind} must stay thin. Move interfaces to a sibling *.types.ts file.`,
    },
    {
      selector: "Program > ExportNamedDeclaration > TSInterfaceDeclaration",
      message: `${kind} must stay thin. Move interfaces to a sibling *.types.ts file.`,
    },
    {
      selector: "Program > TSTypeAliasDeclaration",
      message: `${kind} must stay thin. Move type aliases to a sibling *.types.ts file.`,
    },
    {
      selector: "Program > ExportNamedDeclaration > TSTypeAliasDeclaration",
      message: `${kind} must stay thin. Move type aliases to a sibling *.types.ts file.`,
    },
  ],
});

const thinControllerRules = noTopLevelHelpers("Controllers");
const thinServiceRules = noTopLevelHelpers("Services");

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
              allow: { to: { type: ["app", "common", "shared", "module"] } },
            },
            {
              from: { type: "module" },
              allow: { to: { type: ["common", "shared"] } },
            },
            // Auth primitives (guards, decorators, SUPABASE_CLIENT provider)
            // are infrastructure-style cross-cutting concerns; allow any
            // module to import from modules/auth/ so every JWT-protected
            // controller can reuse the same guard + @CurrentUser().
            {
              from: { type: "module" },
              allow: {
                to: { type: "module", captured: { name: "auth" } },
              },
            },
            {
              from: { type: "shared" },
              allow: { to: { type: "common" } },
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.controller.ts"],
    rules: thinControllerRules,
  },
  {
    files: ["**/*.service.ts"],
    rules: thinServiceRules,
  },
];
