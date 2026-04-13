import cli from "@commit-analyzer/eslint-config/cli";
import tseslint from "typescript-eslint";

export default [
  ...cli,
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["**/*.{ts,tsx}"],
  },
  {
    settings: { "boundaries/root-path": import.meta.dirname },
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: null,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
