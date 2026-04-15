import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const baseLocaleDir = join(here, "..", "messages", "en");

function loadKnownNamespaces() {
  try {
    return new Set(
      readdirSync(baseLocaleDir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, "")),
    );
  } catch {
    return new Set();
  }
}

const knownNamespaces = loadKnownNamespaces();

const TRANSLATION_FNS = new Set(["useTranslations", "getTranslations"]);

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Ensure useTranslations/getTranslations namespace argument matches a file under apps/web/messages/en/.",
    },
    schema: [],
    messages: {
      unknown:
        'Unknown i18n namespace "{{ns}}". Expected one of: {{known}}. Add messages/en/{{ns}}.json + messages/uk/{{ns}}.json or fix the typo.',
      dynamic:
        "i18n namespace must be a string literal so it can be validated against messages/en/.",
    },
  },
  create(context) {
    if (knownNamespaces.size === 0) return {};

    function checkNamespaceNode(node) {
      if (node.type !== "Literal" || typeof node.value !== "string") {
        context.report({ node, messageId: "dynamic" });
        return;
      }
      const root = node.value.split(".")[0];
      if (!knownNamespaces.has(root)) {
        context.report({
          node,
          messageId: "unknown",
          data: {
            ns: root,
            known: [...knownNamespaces].sort().join(", "),
          },
        });
      }
    }

    return {
      CallExpression(node) {
        const callee = node.callee;
        const name =
          callee.type === "Identifier"
            ? callee.name
            : callee.type === "MemberExpression" &&
                callee.property.type === "Identifier"
              ? callee.property.name
              : null;
        if (!name || !TRANSLATION_FNS.has(name)) return;

        const arg = node.arguments[0];
        if (!arg) return;

        if (arg.type === "ObjectExpression") {
          const nsProp = arg.properties.find(
            (p) =>
              p.type === "Property" &&
              !p.computed &&
              ((p.key.type === "Identifier" && p.key.name === "namespace") ||
                (p.key.type === "Literal" && p.key.value === "namespace")),
          );
          if (!nsProp) return;
          checkNamespaceNode(nsProp.value);
          return;
        }

        checkNamespaceNode(arg);
      },
    };
  },
};
