import { describe, expect, it } from "vitest";

import { generateRequestSchema } from "./generation.contract.js";

const validDiff = [
  "diff --git a/a.ts b/a.ts",
  "index 1..2 100644",
  "--- a/a.ts",
  "+++ b/a.ts",
  "@@ -1 +1 @@",
  "-x",
  "+y",
].join("\n");

const baseRequest = {
  provider: "openai",
  model: "gpt-4o-mini",
} as const;

describe("generateRequestSchema — diff refinement", () => {
  it("accepts a valid unified diff", () => {
    const res = generateRequestSchema.safeParse({
      ...baseRequest,
      diff: validDiff,
    });
    expect(res.success).toBe(true);
  });

  it("rejects prose with no file header", () => {
    const res = generateRequestSchema.safeParse({
      ...baseRequest,
      diff: "hello, world — this is not a diff.",
    });
    expect(res.success).toBe(false);
    if (res.success) return;
    const issue = res.error.issues.find((i) => i.path[0] === "diff");
    expect(issue?.message).toMatch(/unified diff/i);
  });

  it("rejects an empty string via min(1)", () => {
    const res = generateRequestSchema.safeParse({
      ...baseRequest,
      diff: "",
    });
    expect(res.success).toBe(false);
  });
});
