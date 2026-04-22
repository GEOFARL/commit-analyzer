import { describe, expect, it } from "vitest";

import {
  DIFF_TOKEN_BUDGET,
  parseAndStripDiff,
  renderParsedDiff,
} from "./diff-strip.js";

describe("cli diff-strip — re-export surface", () => {
  it("exports the parser, renderer and budget constant", () => {
    expect(typeof parseAndStripDiff).toBe("function");
    expect(typeof renderParsedDiff).toBe("function");
    expect(DIFF_TOKEN_BUDGET).toBe(4000);
  });

  it("parses a small diff end-to-end via the re-export", () => {
    const diff = [
      "diff --git a/a.ts b/a.ts",
      "index 1..2 100644",
      "--- a/a.ts",
      "+++ b/a.ts",
      "@@ -1 +1 @@",
      "-a",
      "+b",
    ].join("\n");
    const parsed = parseAndStripDiff(diff);
    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]?.path).toBe("a.ts");
    expect(renderParsedDiff(parsed)).toContain("diff --git a/a.ts b/a.ts");
  });
});
