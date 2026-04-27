import type { ApiKey } from "@commit-analyzer/contracts";
import { describe, expect, it } from "vitest";

import { formatKeysTable } from "./keys-table.js";

const sample: ApiKey = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "laptop",
  prefix: "git_abcd",
  lastUsedAt: "2026-04-01T12:00:00.000Z",
  createdAt: "2026-03-01T12:00:00.000Z",
};

describe("formatKeysTable", () => {
  it("returns 'no api keys.' when empty", () => {
    expect(formatKeysTable([])).toBe("no api keys.\n");
  });

  it("renders headers + rows aligned", () => {
    const out = formatKeysTable([sample]);
    expect(out).toContain("NAME");
    expect(out).toContain("PREFIX");
    expect(out).toContain("LAST USED");
    expect(out).toContain("CREATED");
    expect(out).toContain("laptop");
    expect(out).toContain("git_abcd");
    expect(out).toContain("2026-04-01T12:00:00.000Z");
    expect(out).toContain(sample.createdAt);
  });

  it("renders 'never' when lastUsedAt is null", () => {
    const out = formatKeysTable([{ ...sample, lastUsedAt: null }]);
    expect(out).toContain("never");
  });
});
