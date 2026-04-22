import { describe, expect, it } from "vitest";

import { DiffParserService } from "./diff-parser.service.js";

describe("DiffParserService", () => {
  const service = new DiffParserService();

  const diff = [
    "diff --git a/foo.ts b/foo.ts",
    "index 1..2 100644",
    "--- a/foo.ts",
    "+++ b/foo.ts",
    "@@ -1 +1 @@",
    "-old",
    "+new",
  ].join("\n");

  it("parse wraps parseAndStripDiff", () => {
    const parsed = service.parse(diff);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]?.path).toBe("foo.ts");
    expect(parsed.truncated).toBe(false);
  });

  it("render returns prompt-ready string", () => {
    const parsed = service.parse(diff);
    const rendered = service.render(parsed);
    expect(rendered).toContain("diff --git a/foo.ts b/foo.ts");
    expect(rendered).toContain("@@");
  });
});
