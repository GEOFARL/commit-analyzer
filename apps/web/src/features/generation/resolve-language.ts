import type { Extension } from "@codemirror/state";
import type { LanguageKey } from "@commit-analyzer/diff-parser";

const cache = new Map<LanguageKey, Promise<Extension>>();

export function loadLanguageExtension(key: LanguageKey): Promise<Extension> {
  let pending = cache.get(key);
  if (pending) return pending;
  pending = (async (): Promise<Extension> => {
    switch (key) {
      case "typescript": {
        const m = await import("@codemirror/lang-javascript");
        return m.javascript({ typescript: true });
      }
      case "tsx": {
        const m = await import("@codemirror/lang-javascript");
        return m.javascript({ typescript: true, jsx: true });
      }
      case "javascript": {
        const m = await import("@codemirror/lang-javascript");
        return m.javascript();
      }
      case "jsx": {
        const m = await import("@codemirror/lang-javascript");
        return m.javascript({ jsx: true });
      }
      case "json": {
        const m = await import("@codemirror/lang-json");
        return m.json();
      }
      case "python": {
        const m = await import("@codemirror/lang-python");
        return m.python();
      }
      case "markdown": {
        const m = await import("@codemirror/lang-markdown");
        return m.markdown();
      }
      case "css": {
        const m = await import("@codemirror/lang-css");
        return m.css();
      }
      case "html": {
        const m = await import("@codemirror/lang-html");
        return m.html();
      }
      case "yaml": {
        const m = await import("@codemirror/lang-yaml");
        return m.yaml();
      }
    }
  })();
  cache.set(key, pending);
  return pending;
}
