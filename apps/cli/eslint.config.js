import config from "@commit-analyzer/eslint-config/cli";

export default [
  ...config,
  {
    ignores: [
      "dist/**",
      "test/boundary-violation-fixtures/**",
      "tsup.config.ts",
    ],
  },
  {
    files: ["src/**/*.spec.ts"],
    rules: {
      "boundaries/dependencies": "off",
      "boundaries/no-unknown": "off",
      "boundaries/no-unknown-files": "off",
    },
  },
];
