import next from "@commit-analyzer/eslint-config/next";
import tseslint from "typescript-eslint";

export default [
  ...next,
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
