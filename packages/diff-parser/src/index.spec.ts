import { createRequire } from "node:module";

import { encode } from "gpt-tokenizer";
import { describe, expect, it } from "vitest";

import {
  DIFF_TOKEN_BUDGET,
  parseAndStripDiff,
  renderParsedDiff,
  type ParsedDiff,
} from "./index.js";

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
const fixtures = require("../test/fixtures.json") as Fixture[];

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

describe("parseAndStripDiff — fixtures", () => {
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

describe("parseAndStripDiff — truncation behaviour", () => {
  function makeFile(path: string, hunks: number, hunkBodyLines = 3): string {
    const header =
      `diff --git a/${path} b/${path}\n` +
      `index abc..def 100644\n` +
      `--- a/${path}\n` +
      `+++ b/${path}\n`;
    const body: string[] = [];
    for (let h = 0; h < hunks; h += 1) {
      body.push(
        `@@ -${h * 100 + 1},${hunkBodyLines} +${h * 100 + 1},${hunkBodyLines} @@`,
      );
      for (let l = 0; l < hunkBodyLines; l += 1) {
        body.push(` ${path}-hunk${h}-context-line${l}-${"x".repeat(30)}`);
      }
      body.push(`-${path}-hunk${h}-removed-${"y".repeat(30)}`);
      body.push(`+${path}-hunk${h}-added-${"z".repeat(30)}`);
    }
    return header + body.join("\n");
  }

  it("binary file survives dropMiddleHunks when other files push over budget", () => {
    const binary =
      "diff --git a/img.png b/img.png\nindex 1..2 100644\nBinary files a/img.png and b/img.png differ";
    const big = makeFile("big.ts", 200, 5);
    const parsed = parseAndStripDiff(`${binary}\n${big}`);
    expect(parsed.truncated).toBe(true);
    const bin = parsed.files.find((f) => f.path === "img.png");
    expect(bin?.isBinary).toBe(true);
    expect(bin?.omittedHunks).toBe(0);
    expect(bin?.hunks).toHaveLength(0);
  });

  it("under budget → no truncation", () => {
    const diff = makeFile("small.ts", 1);
    const parsed = parseAndStripDiff(diff);
    expect(parsed.truncated).toBe(false);
    expect(parsed.files[0]?.omittedHunks).toBe(0);
  });

  it("over budget via many hunks → drops middle hunks first, keeps first+last", () => {
    const diff = makeFile("huge.ts", 200, 5);
    const parsed = parseAndStripDiff(diff);
    expect(parsed.truncated).toBe(true);
    expect(parsed.files).toHaveLength(1);
    const file = parsed.files[0]!;
    if (!file.omitted) {
      expect(file.hunks.length).toBeLessThanOrEqual(2);
      expect(file.omittedHunks).toBeGreaterThan(0);
    }
    expect(countTokens(renderParsedDiff(parsed))).toBeLessThanOrEqual(
      DIFF_TOKEN_BUDGET,
    );
  });

  it("over budget across many single-hunk files → iterates all candidates and drops smallest first", () => {
    const parts: string[] = [];
    // 20 single-hunk files in descending body size so the smallest candidate
    // appears LAST — forces the inner "t < smallestTokens" swap branch on every
    // file-drop iteration. dropMiddleHunks can't help (each file has 1 hunk).
    for (let n = 0; n < 20; n += 1) {
      const size = 24 - n;
      parts.push(makeFile(`file-${n}.ts`, 1, size));
    }
    const parsed = parseAndStripDiff(parts.join("\n"));
    expect(parsed.truncated).toBe(true);
    expect(countTokens(renderParsedDiff(parsed))).toBeLessThanOrEqual(
      DIFF_TOKEN_BUDGET,
    );
    const omittedPaths = parsed.files
      .filter((f) => f.omitted)
      .map((f) => f.path);
    expect(omittedPaths.length).toBeGreaterThan(0);
    expect(parsed.summary).toContain(`[file omitted: ${omittedPaths[0]}]`);
    // Smallest file (file-19.ts, 5 body lines) must be dropped before larger ones.
    expect(omittedPaths).toContain("file-19.ts");
  });

  it("single huge file whose first+last hunks still blow the budget → file is omitted and budget held", () => {
    const diff = makeFile("lone-giant.ts", 3, 600);
    const parsed = parseAndStripDiff(diff);
    expect(parsed.truncated).toBe(true);
    expect(countTokens(renderParsedDiff(parsed))).toBeLessThanOrEqual(
      DIFF_TOKEN_BUDGET,
    );
    expect(parsed.files[0]?.omitted).toBe(true);
    expect(parsed.summary).toContain("[file omitted: lone-giant.ts]");
  });

  it("budget is a hard upper bound on every fixture", () => {
    for (const fx of fixtures) {
      const parsed = parseAndStripDiff(fx.input);
      const tokens = countTokens(renderParsedDiff(parsed));
      expect(tokens, fx.name).toBeLessThanOrEqual(DIFF_TOKEN_BUDGET);
    }
  });

  it("truncated:false iff no hunks and no files dropped", () => {
    const parsed = parseAndStripDiff(makeFile("untouched.ts", 2, 2));
    expect(parsed.truncated).toBe(false);
    expect(parsed.files[0]?.omittedHunks).toBe(0);
    expect(parsed.files[0]?.omitted).toBe(false);
  });
});

describe("parseAndStripDiff — edge cases", () => {
  it("empty input → zero files, empty summary", () => {
    const parsed = parseAndStripDiff("");
    expect(parsed.files).toHaveLength(0);
    expect(parsed.summary).toBe("");
    expect(parsed.truncated).toBe(false);
  });

  it("input without any diff --git header is ignored", () => {
    const parsed = parseAndStripDiff("just text\nmore text\n");
    expect(parsed.files).toHaveLength(0);
  });

  it("renderParsedDiff serialises omitted files to marker lines", () => {
    const parsed: ParsedDiff = {
      files: [
        {
          path: "gone.ts",
          headerLines: [],
          hunks: [],
          omittedHunks: 0,
          isBinary: false,
          omitted: true,
        },
      ],
      summary: "[file omitted: gone.ts]",
      truncated: true,
    };
    expect(renderParsedDiff(parsed)).toBe("[file omitted: gone.ts]");
  });

  it("summary lists all file paths one per line", () => {
    const parsed = parseAndStripDiff(
      [
        "diff --git a/a.ts b/a.ts",
        "index 1..2 100644",
        "--- a/a.ts",
        "+++ b/a.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
        "diff --git a/b.ts b/b.ts",
        "index 3..4 100644",
        "--- a/b.ts",
        "+++ b/b.ts",
        "@@ -1 +1 @@",
        "-a",
        "+b",
      ].join("\n"),
    );
    expect(parsed.summary).toBe("a.ts\nb.ts");
  });
});
