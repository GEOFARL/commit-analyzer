const SERVER_FILE_RE = /\/src\/features\/[^/]+\/server(?:\.[tj]sx?|\/index\.[tj]sx?)$/;

export default {
  meta: {
    type: "problem",
    docs: {
      description:
        'Require `import "server-only"` at the top of every features/*/server.ts so accidental client imports fail at build.',
    },
    schema: [],
    messages: {
      missing:
        'features/*/server.ts must start with `import "server-only"` so a client component importing it errors at build time.',
    },
  },
  create(context) {
    const filename = (context.filename ?? context.getFilename()).replace(
      /\\/g,
      "/",
    );
    if (!SERVER_FILE_RE.test(filename)) return {};

    return {
      Program(node) {
        const first = node.body[0];
        const hasServerOnly =
          first &&
          first.type === "ImportDeclaration" &&
          typeof first.source.value === "string" &&
          first.source.value === "server-only";
        if (!hasServerOnly) {
          context.report({ node: first ?? node, messageId: "missing" });
        }
      },
    };
  },
};
