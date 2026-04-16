const FEATURE_PATH_RE = /\/src\/features\/([^/]+)\//;
const FEATURE_IMPORT_RE = /^@\/features\/([^/]+)(?:\/|$)/;
const RELATIVE_FEATURE_RE = /(?:^|\/)features\/([^/]+)(?:\/|$)/;

function getCurrentFeature(filename) {
  const m = FEATURE_PATH_RE.exec(filename.replace(/\\/g, "/"));
  return m ? m[1] : null;
}

function getImportedFeature(source) {
  const alias = FEATURE_IMPORT_RE.exec(source);
  if (alias) return alias[1];
  const rel = RELATIVE_FEATURE_RE.exec(source);
  return rel ? rel[1] : null;
}

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow imports between sibling features under apps/web/src/features/*. Share via @/lib or hoist.",
    },
    schema: [],
    messages: {
      crossFeature:
        'Cross-feature import: features/{{from}} cannot import from features/{{to}}. Share via @/lib/* or hoist to a cross-feature module.',
    },
  },
  create(context) {
    const filename = context.filename ?? context.getFilename();
    const current = getCurrentFeature(filename);
    if (!current) return {};

    function check(node, source) {
      if (typeof source !== "string") return;
      const target = getImportedFeature(source);
      if (!target || target === current) return;
      context.report({
        node,
        messageId: "crossFeature",
        data: { from: current, to: target },
      });
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === "Literal") check(node, node.source.value);
      },
    };
  },
};
