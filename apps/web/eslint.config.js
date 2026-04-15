import config from "@commit-analyzer/eslint-config/next";
import i18next from "eslint-plugin-i18next";

import localI18n from "./eslint-rules/index.js";


export default [
  ...config,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "local-i18n": localI18n },
    rules: {
      "local-i18n/namespace-match": "error",
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
