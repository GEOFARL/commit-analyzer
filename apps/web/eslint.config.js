import config from "@commit-analyzer/eslint-config/next";
import i18next from "eslint-plugin-i18next";


export default [
  ...config,
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    plugins: { i18next },
    rules: {
      "i18next/no-literal-string": ["warn", { mode: "jsx-text-only" }],
    },
  },
  {
    ignores: [
      ".next/**",
      "next-env.d.ts",
      "test/boundary-violation-fixtures/**",
    ],
  },
];
