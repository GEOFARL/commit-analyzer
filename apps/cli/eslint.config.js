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
];
