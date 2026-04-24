export const LANGUAGE_KEYS = [
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "json",
  "python",
  "markdown",
  "css",
  "html",
  "yaml",
] as const;

export type LanguageKey = (typeof LANGUAGE_KEYS)[number];

const EXTENSION_MAP: Readonly<Record<string, LanguageKey>> = {
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  json: "json",
  jsonc: "json",
  py: "python",
  md: "markdown",
  markdown: "markdown",
  css: "css",
  html: "html",
  htm: "html",
  yaml: "yaml",
  yml: "yaml",
};

export function extensionToLanguageKey(path: string): LanguageKey | null {
  if (!path) return null;
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  const base = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = base.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  return EXTENSION_MAP[ext] ?? null;
}
