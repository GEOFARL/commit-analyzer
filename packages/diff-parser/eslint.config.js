import config from "@commit-analyzer/eslint-config/node";

export default [
  ...config,
  {
    ignores: ["dist/**", "test/**"],
  },
];
