import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");

const apiFixtures = resolve(repoRoot, "apps/api/test/boundary-violation-fixtures");
const webFixtures = resolve(repoRoot, "apps/web/test/boundary-violation-fixtures");
const cliFixtures = resolve(repoRoot, "apps/cli/test/boundary-violation-fixtures");

const lint = async (cwd: string, file: string): Promise<string[]> => {
  const eslint = new ESLint({
    cwd,
    overrideConfigFile: resolve(cwd, "eslint.config.js"),
  });
  const abs = resolve(cwd, file);
  const results = await eslint.lintFiles([abs]);
  return results.flatMap((r) =>
    r.messages
      .map((m) => m.ruleId)
      .filter((id): id is string => typeof id === "string"),
  );
};

describe("module boundary rule fixtures", () => {
  it("api: sibling module import fails boundaries/dependencies", async () => {
    const rules = await lint(apiFixtures, "src/modules/beta/beta.ts");
    expect(rules).toContain("boundaries/dependencies");
  });

  it("web: ui importing layout feature fails boundaries/dependencies", async () => {
    const rules = await lint(webFixtures, "src/components/ui/button.tsx");
    expect(rules).toContain("boundaries/dependencies");
  });

  it("web: importing @commit-analyzer/api fails no-restricted-imports", async () => {
    const rules = await lint(webFixtures, "src/components/analytics/uses-api.tsx");
    expect(rules).toContain("no-restricted-imports");
  });

  it("cli: sibling command import fails boundaries/dependencies", async () => {
    const rules = await lint(cliFixtures, "src/commands/beta.ts");
    expect(rules).toContain("boundaries/dependencies");
  });
});
