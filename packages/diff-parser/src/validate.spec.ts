import { describe, expect, it } from "vitest";

import { validateUnifiedDiff } from "./validate.js";

const simpleGitDiff = [
  "diff --git a/src/auth.ts b/src/auth.ts",
  "index e69de29..b6fc4c6 100644",
  "--- a/src/auth.ts",
  "+++ b/src/auth.ts",
  "@@ -0,0 +1,3 @@",
  "+export const signIn = async () => {",
  "+  return api.post('/auth');",
  "+};",
].join("\n");

const pureUnifiedDiff = [
  "--- a/one.txt",
  "+++ b/one.txt",
  "@@ -1,2 +1,2 @@",
  "-hello",
  "+world",
  " tail",
].join("\n");

const twoFileDiff = [
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
  "@@ -1,2 +1,2 @@",
  "-x",
  "+y",
  " z",
].join("\n");

describe("validateUnifiedDiff — valid inputs", () => {
  it("accepts a minimal git-style unified diff", () => {
    const res = validateUnifiedDiff(simpleGitDiff);
    expect(res.valid).toBe(true);
    expect(res.stats).toEqual({ files: 1, additions: 3, deletions: 0 });
  });

  it("accepts a pure unified diff without `diff --git`", () => {
    const res = validateUnifiedDiff(pureUnifiedDiff);
    expect(res.valid).toBe(true);
    expect(res.stats).toEqual({ files: 1, additions: 1, deletions: 1 });
  });

  it("counts files, additions and deletions across multiple files", () => {
    const res = validateUnifiedDiff(twoFileDiff);
    expect(res.valid).toBe(true);
    expect(res.stats).toEqual({ files: 2, additions: 2, deletions: 2 });
  });

  it("accepts hunks whose header omits the optional count (defaults to 1)", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1 +1 @@",
      "-a",
      "+b",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(true);
  });

  it("accepts `\\ No newline at end of file` annotation", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,1 +1,1 @@",
      "-a",
      "\\ No newline at end of file",
      "+b",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(true);
    expect(res.stats.additions).toBe(1);
    expect(res.stats.deletions).toBe(1);
  });
});

describe("validateUnifiedDiff — invalid inputs", () => {
  it("rejects empty input", () => {
    const res = validateUnifiedDiff("");
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues[0]?.code).toBe("empty");
  });

  it("rejects prose with no file header", () => {
    const res = validateUnifiedDiff(
      "this is not a diff\nit is just text\nnothing here.",
    );
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues[0]?.code).toBe("missing-header");
  });

  it("rejects malformed hunk header", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ broken @@",
      "+a",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    const first = res.issues[0]!;
    expect(first.code).toBe("bad-hunk-header");
    expect(first.line).toBe(4);
  });

  it("rejects a hunk body shorter than declared range", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,3 +1,3 @@",
      "-a",
      "+b",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues.some((i) => i.code === "hunk-count-mismatch")).toBe(true);
  });

  it("rejects a hunk body longer than declared range", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1 +1 @@",
      "-a",
      "+b",
      "+c",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues[0]?.code).toBe("hunk-count-mismatch");
  });

  it("rejects an unknown line prefix inside a hunk", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,2 +1,2 @@",
      "?not-a-diff-line",
      "+b",
      " c",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues[0]?.code).toBe("bad-line-prefix");
    expect(res.issues[0]?.line).toBe(5);
  });

  it("reports the file path for hunk errors when known", () => {
    const diff = [
      "diff --git a/path/to/foo.ts b/path/to/foo.ts",
      "--- a/path/to/foo.ts",
      "+++ b/path/to/foo.ts",
      "@@ -1,10 +1,10 @@",
      "-a",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues[0]?.file).toBe("path/to/foo.ts");
  });

  it("flags addition that exceeds new-side range when old-side still pending", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -2,2 +2,1 @@",
      "-a",
      "+b",
      "+c",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues[0]?.code).toBe("hunk-count-mismatch");
    expect(res.issues[0]?.message).toMatch(/additions/);
  });

  it("flags deletion that exceeds old-side range when new-side still pending", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,1 +1,2 @@",
      "+a",
      "-b",
      "-c",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues[0]?.code).toBe("hunk-count-mismatch");
    expect(res.issues[0]?.message).toMatch(/deletions/);
  });

  it("flags context line when one side of the hunk range is already satisfied", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,1 +1,2 @@",
      "-a",
      " b",
      "+c",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues[0]?.code).toBe("hunk-count-mismatch");
    expect(res.issues[0]?.message).toMatch(/Context/);
  });
});

describe("validateUnifiedDiff — file header variants", () => {
  it("accepts `+++ /dev/null` (deleted file)", () => {
    const diff = [
      "diff --git a/gone.txt b/gone.txt",
      "--- a/gone.txt",
      "+++ /dev/null",
      "@@ -1,1 +0,0 @@",
      "-gone",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(true);
    expect(res.stats.files).toBe(1);
  });

  it("accepts `+++ path` without the `b/` prefix", () => {
    const diff = [
      "--- path.txt",
      "+++ path.txt",
      "@@ -1 +1 @@",
      "-a",
      "+b",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(true);
  });

  it("flags an unfinished hunk when the next file starts", () => {
    const diff = [
      "diff --git a/x b/x",
      "--- a/x",
      "+++ b/x",
      "@@ -1,3 +1,3 @@",
      "-a",
      "diff --git a/y b/y",
      "--- a/y",
      "+++ b/y",
      "@@ -1 +1 @@",
      "-c",
      "+d",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
    if (res.valid) return;
    expect(res.issues.some((i) => i.code === "hunk-count-mismatch")).toBe(true);
  });

  it("flags an unfinished hunk when a new unified-diff header starts", () => {
    const diff = [
      "--- a/x",
      "+++ b/x",
      "@@ -1,3 +1,3 @@",
      "-a",
      "--- a/y",
      "+++ b/y",
      "@@ -1 +1 @@",
      "-c",
      "+d",
    ].join("\n");
    const res = validateUnifiedDiff(diff);
    expect(res.valid).toBe(false);
  });
});
