import { createRequire } from "node:module";

import { encode } from "gpt-tokenizer";
import { describe, expect, it } from "vitest";

import {
  DIFF_TOKEN_BUDGET,
  parseAndStripDiff,
  renderParsedDiff,
  type ParsedDiff,
} from "./diff-strip.js";

type FixtureAssertions = {
  fileCount?: number;
  truncated?: boolean;
  maxTokens?: number;
  minTokens?: number;
  hasPath?: string[];
  hunkCountForPath?: Record<string, number>;
  isBinaryForPath?: Record<string, boolean>;
  piiMustContain?: string[];
  piiMustNotContain?: string[];
  summaryContains?: string[];
  anyFileHasOmittedHunks?: boolean;
  anyFileOmitted?: boolean;
};

type Fixture = {
  name: string;
  input: string;
  assertions: FixtureAssertions;
};

const require = createRequire(import.meta.url);
const fixtures = require(
  "../../../api/test/algorithms/fixtures/diff-parser/fixtures.json",
) as Fixture[];

function countTokens(text: string): number {
  return encode(text).length;
}

function fullRender(parsed: ParsedDiff): string {
  return `${renderParsedDiff(parsed)}\n---\n${parsed.summary}`;
}

function applyAssertions(parsed: ParsedDiff, a: FixtureAssertions): void {
  const rendered = fullRender(parsed);

  if (a.fileCount !== undefined) {
    expect(parsed.files).toHaveLength(a.fileCount);
  }
  if (a.truncated !== undefined) {
    expect(parsed.truncated).toBe(a.truncated);
  }
  if (a.maxTokens !== undefined) {
    expect(countTokens(renderParsedDiff(parsed))).toBeLessThanOrEqual(
      a.maxTokens,
    );
  }
  if (a.minTokens !== undefined) {
    expect(countTokens(renderParsedDiff(parsed))).toBeGreaterThanOrEqual(
      a.minTokens,
    );
  }
  if (a.hasPath) {
    const paths = parsed.files.map((f) => f.path);
    for (const p of a.hasPath) expect(paths).toContain(p);
  }
  if (a.hunkCountForPath) {
    for (const [path, count] of Object.entries(a.hunkCountForPath)) {
      const file = parsed.files.find((f) => f.path === path);
      expect(file, `file ${path}`).toBeDefined();
      expect(file?.hunks.length).toBe(count);
    }
  }
  if (a.isBinaryForPath) {
    for (const [path, expected] of Object.entries(a.isBinaryForPath)) {
      const file = parsed.files.find((f) => f.path === path);
      expect(file, `file ${path}`).toBeDefined();
      expect(file?.isBinary).toBe(expected);
    }
  }
  if (a.piiMustContain) {
    for (const token of a.piiMustContain) expect(rendered).toContain(token);
  }
  if (a.piiMustNotContain) {
    for (const token of a.piiMustNotContain)
      expect(rendered).not.toContain(token);
  }
  if (a.summaryContains) {
    for (const token of a.summaryContains)
      expect(parsed.summary).toContain(token);
  }
  if (a.anyFileHasOmittedHunks !== undefined) {
    const any = parsed.files.some((f) => f.omittedHunks > 0);
    expect(any).toBe(a.anyFileHasOmittedHunks);
  }
  if (a.anyFileOmitted !== undefined) {
    const any = parsed.files.some((f) => f.omitted);
    expect(any).toBe(a.anyFileOmitted);
  }
}

describe("cli diff-strip — parity with server on shared fixtures", () => {
  for (const fx of fixtures) {
    it(fx.name, () => {
      const parsed = parseAndStripDiff(fx.input);
      applyAssertions(parsed, fx.assertions);
      expect(countTokens(renderParsedDiff(parsed))).toBeLessThanOrEqual(
        DIFF_TOKEN_BUDGET,
      );
    });
  }
});

describe("cli diff-strip — renderParsedDiff stability", () => {
  it("small diff renders deterministically", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "index 1..2 100644",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1 +1 @@",
      "-a",
      "+b",
    ].join("\n");
    const once = renderParsedDiff(parseAndStripDiff(diff));
    const twice = renderParsedDiff(parseAndStripDiff(diff));
    expect(once).toBe(twice);
  });
});
