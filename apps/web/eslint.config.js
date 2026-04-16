import config from "@commit-analyzer/eslint-config/next";
import i18next from "eslint-plugin-i18next";

import localWeb from "./eslint-rules/index.js";

// Services (supabase, ts-rest, next/headers) may only be imported from
// features/*/server.ts, features/*/hooks.ts, app/auth/** route handlers,
// app/**/layout.tsx session guards, and components/providers/** (the
// QueryProvider needs tsr.ReactQueryProvider). See docs/06-frontend.md §11
// and ADR-0009.
const serviceImportBan = {
  patterns: [
    {
      group: [
        "@/lib/supabase",
        "@/lib/supabase/*",
        "@/lib/api/tsr",
        "@supabase/*",
        "@ts-rest/*",
        "next/headers",
      ],
      message:
        "Services (supabase, ts-rest, next/headers) may only be imported from features/*/server.ts, features/*/hooks.ts, app/auth/**, app/**/layout.tsx, or components/providers/**. See docs/06-frontend.md §11 and ADR-0009.",
    },
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
  ...config,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "local-web": localWeb },
    rules: {
      "local-web/namespace-match": "error",
      "local-web/no-cross-feature-imports": "error",
      "local-web/features-require-server-only": "error",
    },
  },
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/layout/**/*.{ts,tsx}",
    ],
    ignores: [
      "src/app/auth/**",
      "src/app/**/layout.tsx",
      "src/app/api/**",
    ],
    rules: {
      "no-restricted-imports": ["error", serviceImportBan],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Do not call `fetch` from app/** or components/**. Use a feature hook under @/features/<x>/hooks or a server loader under @/features/<x>/server.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.name='useQuery'] > ObjectExpression.arguments:first-child > Property[key.name='queryFn']",
          message:
            "Raw useQuery({ queryFn }) is not allowed in app/** or components/**. Move the query into a hook under @/features/<x>/hooks.",
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": ["warn", { mode: "jsx-text-only" }],
    },
  },
  {
    files: [
      "src/app/**/*.{ts,tsx}",
      "src/components/layout/**/*.{ts,tsx}",
      "src/features/**/components/**/*.{ts,tsx}",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-text-only",
          "jsx-attributes": {
            exclude: [
              "aria-label",
              "aria-labelledby",
              "aria-describedby",
              "aria-valuetext",
              "role",
              "title",
            ],
          },
        },
      ],
    },
  },
  {
    files: [
      "src/app/**/opengraph-image.tsx",
      "src/app/**/twitter-image.tsx",
      "src/app/**/icon.tsx",
      "src/app/**/apple-icon.tsx",
    ],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": "off",
    },
  },
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "test/boundary-violation-fixtures/**",
      "eslint-rules/**",
    ],
  },
];
