import { describe, expect, it } from "vitest";

import { fixtures } from "./cc-parser.fixtures.js";
import { parseConventionalCommit } from "./cc-parser.js";

describe("parseConventionalCommit", () => {
  describe("fixtures", () => {
    for (const { message, expected } of fixtures) {
      const label = message.split("\n")[0]!.slice(0, 60) || "(empty)";
      it(label, () => {
        const result = parseConventionalCommit(message);
        expect(result).toEqual(expected);
      });
    }
  });

  describe("valid field is true for well-formed messages", () => {
    it("minimal one-liner", () => {
      const r = parseConventionalCommit("feat: something");
      expect(r.valid).toBe(true);
    });

    it("with scope", () => {
      const r = parseConventionalCommit("fix(core): patch null ref");
      expect(r.valid).toBe(true);
      expect(r.scope).toBe("core");
    });

    it("breaking bang sets breaking=true", () => {
      const r = parseConventionalCommit("feat!: drop v1 api");
      expect(r.breaking).toBe(true);
      expect(r.valid).toBe(true);
    });

    it("BREAKING CHANGE footer sets breaking=true", () => {
      const r = parseConventionalCommit(
        "feat: new thing\n\nsome body\n\nBREAKING CHANGE: old api gone",
      );
      expect(r.breaking).toBe(true);
      expect(r.valid).toBe(true);
    });

    it("BREAKING-CHANGE footer sets breaking=true", () => {
      const r = parseConventionalCommit(
        "feat: new thing\n\nsome body\n\nBREAKING-CHANGE: old api gone",
      );
      expect(r.breaking).toBe(true);
    });

    it("body is captured correctly", () => {
      const r = parseConventionalCommit(
        "fix: handle error\n\nThis is the body.\nIt has two lines.",
      );
      expect(r.body).toBe("This is the body.\nIt has two lines.");
      expect(r.footer).toBeUndefined();
    });

    it("footer is captured correctly", () => {
      const r = parseConventionalCommit(
        "fix: handle error\n\nbody text\n\nCloses #7",
      );
      expect(r.footer).toBe("Closes #7");
    });

    it("body is undefined when absent", () => {
      const r = parseConventionalCommit("chore: tidy up");
      expect(r.body).toBeUndefined();
    });

    it("footer is undefined when absent", () => {
      const r = parseConventionalCommit("chore: tidy up\n\nbody only");
      expect(r.footer).toBeUndefined();
    });

    it("scope is undefined when absent", () => {
      const r = parseConventionalCommit("chore: tidy up");
      expect(r.scope).toBeUndefined();
    });

    it("multi-paragraph body separated by blank lines", () => {
      const r = parseConventionalCommit(
        "docs: explain algo\n\nparagraph one\n\nparagraph two\n\ntoken: value",
      );
      expect(r.body).toBe("paragraph one\n\nparagraph two");
      expect(r.footer).toBe("token: value");
    });
  });

  describe("valid field is false for malformed messages", () => {
    it("rejects empty string", () => {
      expect(parseConventionalCommit("").valid).toBe(false);
    });

    it("rejects whitespace-only", () => {
      expect(parseConventionalCommit("  \n  ").valid).toBe(false);
    });

    it("rejects uppercase type", () => {
      expect(parseConventionalCommit("Feat: something").valid).toBe(false);
    });

    it("rejects missing colon-space", () => {
      expect(parseConventionalCommit("feat:no-space").valid).toBe(false);
    });

    it("rejects empty scope", () => {
      expect(parseConventionalCommit("feat(): empty scope").valid).toBe(false);
    });

    it("rejects body not separated by blank line", () => {
      expect(
        parseConventionalCommit("fix: title\nnot separated"),
      ).toEqual({ type: "", subject: "", breaking: false, valid: false });
    });

    it("rejects plain text", () => {
      expect(parseConventionalCommit("just a plain commit message").valid).toBe(
        false,
      );
    });

    it("rejects numeric-prefixed type", () => {
      expect(parseConventionalCommit("123: bad type").valid).toBe(false);
    });
  });
});
