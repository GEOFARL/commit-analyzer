import { describe, expect, it } from "vitest";

import { extensionToLanguageKey } from "./language-key.js";

describe("extensionToLanguageKey", () => {
  it.each([
    ["src/auth.ts", "typescript"],
    ["src/auth.mts", "typescript"],
    ["src/auth.cts", "typescript"],
    ["src/page.tsx", "tsx"],
    ["src/util.js", "javascript"],
    ["src/util.mjs", "javascript"],
    ["src/util.cjs", "javascript"],
    ["src/page.jsx", "jsx"],
    ["tsconfig.json", "json"],
    ["eslint.jsonc", "json"],
    ["scripts/build.py", "python"],
    ["README.md", "markdown"],
    ["styles.css", "css"],
    ["index.html", "html"],
    ["legacy.htm", "html"],
    ["pnpm-workspace.yaml", "yaml"],
    ["ci/workflow.yml", "yaml"],
  ] as const)("maps %s → %s", (path, key) => {
    expect(extensionToLanguageKey(path)).toBe(key);
  });

  it("is case-insensitive on the extension", () => {
    expect(extensionToLanguageKey("Page.TSX")).toBe("tsx");
    expect(extensionToLanguageKey("app.JSON")).toBe("json");
  });

  it("returns null for unknown extensions", () => {
    expect(extensionToLanguageKey("bin/program.exe")).toBeNull();
    expect(extensionToLanguageKey("Dockerfile.prod")).toBeNull();
  });

  it("returns null when the path has no extension", () => {
    expect(extensionToLanguageKey("Dockerfile")).toBeNull();
    expect(extensionToLanguageKey("LICENSE")).toBeNull();
    expect(extensionToLanguageKey("")).toBeNull();
  });

  it("treats dotfiles as having no extension", () => {
    expect(extensionToLanguageKey(".env")).toBeNull();
    expect(extensionToLanguageKey(".gitignore")).toBeNull();
  });

  it("uses only the filename portion, not the directory", () => {
    expect(extensionToLanguageKey("src.ts/README")).toBeNull();
    expect(extensionToLanguageKey("deep/nested/path/util.py")).toBe("python");
  });
});
