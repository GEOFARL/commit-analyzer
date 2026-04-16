import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { parseConventionalCommit } from "./cc-parser.js";

const require = createRequire(import.meta.url);
const fixtures = require("../../test/algorithms/fixtures/cc-parser.fixtures.json") as Array<{
  name: string;
  input: string;
  expected: unknown;
}>;

describe("parseConventionalCommit", () => {
  describe("fixtures", () => {
    for (const { name, input, expected } of fixtures) {
      it(name, () => {
        expect(parseConventionalCommit(input)).toEqual(expected);
      });
    }
  });

  describe("ok=true — field presence", () => {
    it("minimal one-liner has ok=true", () => {
      const r = parseConventionalCommit("feat: something");
      expect(r.ok).toBe(true);
    });

    it("scope present when given", () => {
      const r = parseConventionalCommit("fix(core): patch null ref");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.scope).toBe("core");
    });

    it("scope absent when omitted", () => {
      const r = parseConventionalCommit("chore: tidy up");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.scope).toBeUndefined();
    });

    it("bang sets isBreaking=true", () => {
      const r = parseConventionalCommit("feat!: drop v1 api");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.isBreaking).toBe(true);
    });

    it("BREAKING CHANGE footer sets isBreaking=true", () => {
      const r = parseConventionalCommit(
        "feat: new thing\n\nsome body\n\nBREAKING CHANGE: old api gone",
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.isBreaking).toBe(true);
    });

    it("BREAKING-CHANGE footer (hyphen) sets isBreaking=true", () => {
      const r = parseConventionalCommit(
        "feat: new thing\n\nsome body\n\nBREAKING-CHANGE: old api gone",
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.isBreaking).toBe(true);
    });

    it("body captured; footer absent", () => {
      const r = parseConventionalCommit(
        "fix: handle error\n\nThis is the body.\nIt has two lines.",
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.body).toBe("This is the body.\nIt has two lines.");
      expect(r.footer).toBeUndefined();
    });

    it("footer captured", () => {
      const r = parseConventionalCommit(
        "fix: handle error\n\nbody text\n\nCloses #7",
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.footer).toBe("Closes #7");
    });

    it("body absent on one-liner", () => {
      const r = parseConventionalCommit("chore: tidy up");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.body).toBeUndefined();
    });

    it("footer absent when only body present", () => {
      const r = parseConventionalCommit("chore: tidy up\n\nbody only");
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.footer).toBeUndefined();
    });

    it("multi-paragraph body separated by blank lines", () => {
      const r = parseConventionalCommit(
        "docs: explain algo\n\nparagraph one\n\nparagraph two\n\ntoken: value",
      );
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.body).toBe("paragraph one\n\nparagraph two");
      expect(r.footer).toBe("token: value");
    });
  });

  describe("ok=false — reason codes", () => {
    it("empty string → reason=empty", () => {
      const r = parseConventionalCommit("");
      expect(r).toEqual({ ok: false, reason: "empty" });
    });

    it("whitespace-only → reason=empty", () => {
      const r = parseConventionalCommit("  \n  ");
      expect(r).toEqual({ ok: false, reason: "empty" });
    });

    it("no colon → reason=no-type", () => {
      const r = parseConventionalCommit("just a plain commit message");
      expect(r).toEqual({ ok: false, reason: "no-type" });
    });

    it("merge commit (no colon) → reason=no-type", () => {
      const r = parseConventionalCommit("Merge pull request #1 from foo/bar");
      expect(r).toEqual({ ok: false, reason: "no-type" });
    });

    it("uppercase type → reason=malformed-header", () => {
      const r = parseConventionalCommit("Feat: something");
      expect(r).toEqual({ ok: false, reason: "malformed-header" });
    });

    it("missing space after colon → reason=malformed-header", () => {
      const r = parseConventionalCommit("feat:no-space");
      expect(r).toEqual({ ok: false, reason: "malformed-header" });
    });

    it("empty scope → reason=malformed-header", () => {
      const r = parseConventionalCommit("feat(): empty scope");
      expect(r).toEqual({ ok: false, reason: "malformed-header" });
    });

    it("hyphenated type → reason=malformed-header", () => {
      const r = parseConventionalCommit("build-system: do something");
      expect(r).toEqual({ ok: false, reason: "malformed-header" });
    });

    it("body not separated by blank line → reason=malformed-header", () => {
      const r = parseConventionalCommit("fix: title\nnot separated");
      expect(r).toEqual({ ok: false, reason: "malformed-header" });
    });

    it("numeric type → reason=malformed-header", () => {
      const r = parseConventionalCommit("123: bad type");
      expect(r).toEqual({ ok: false, reason: "malformed-header" });
    });
  });
});
