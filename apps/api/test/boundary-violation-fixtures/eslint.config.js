import api from "@commit-analyzer/eslint-config/api";
import tseslint from "typescript-eslint";

export default [
  ...api,
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
