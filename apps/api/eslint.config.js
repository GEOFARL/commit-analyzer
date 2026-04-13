import config from "@commit-analyzer/eslint-config/api";

export default [
  ...config,
  {
    ignores: ["dist/**", "test/boundary-violation-fixtures/**"],
  },
];
