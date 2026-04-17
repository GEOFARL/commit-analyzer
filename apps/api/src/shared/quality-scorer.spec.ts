import { describe, expect, it } from "vitest";

import fixturesJson from "../../test/algorithms/fixtures/quality-scorer.fixtures.json" with {
  type: "json",
};

import { parseConventionalCommit } from "./cc-parser.js";
import { scoreCommit } from "./quality-scorer.js";
import type { Score } from "./quality-scorer.js";

const fixtures = fixturesJson as Array<{
  name: string;
  input: string;
  expected: Score;
}>;

describe("scoreCommit", () => {
  describe("regression fixtures", () => {
    for (const { name, input, expected } of fixtures) {
      it(name, () => {
        const parsed = parseConventionalCommit(input);
        expect(scoreCommit(parsed)).toEqual(expected);
      });
    }
  });

  it("great commit scores ≥90", () => {
    const parsed = parseConventionalCommit(
      "feat(auth): add oauth2 login flow\n\nImplements Google and GitHub OAuth2 providers.\nUsers can now sign in without a password.\n\nCloses #42",
    );
    const { overallScore } = scoreCommit(parsed);
    expect(overallScore).toBeGreaterThanOrEqual(90);
  });

  it("bad commit scores ≤30", () => {
    const parsed = parseConventionalCommit("wip");
    const { overallScore } = scoreCommit(parsed);
    expect(overallScore).toBeLessThanOrEqual(30);
  });

  it("score is deterministic across multiple calls", () => {
    const message = "fix(db): handle connection timeout";
    const parsed = parseConventionalCommit(message);
    const s1 = scoreCommit(parsed);
    const s2 = scoreCommit(parsed);
    expect(s1).toEqual(s2);
  });

  describe("is_conventional component", () => {
    it("non-CC message gets 0 for is_conventional", () => {
      const s = scoreCommit(parseConventionalCommit("just a plain message"));
      const detail = s.details.find((d) => d.component === "is_conventional")!;
      expect(detail.got).toBe(0);
    });

    it("valid CC message gets 30 for is_conventional", () => {
      const s = scoreCommit(parseConventionalCommit("feat: something"));
      const detail = s.details.find((d) => d.component === "is_conventional")!;
      expect(detail.got).toBe(30);
    });
  });

  describe("type_valid component", () => {
    it("valid type earns 10 pts", () => {
      const s = scoreCommit(parseConventionalCommit("feat: something"));
      const detail = s.details.find((d) => d.component === "type_valid")!;
      expect(detail.got).toBe(10);
    });

    it("unknown type earns 0 pts", () => {
      const s = scoreCommit(parseConventionalCommit("wip: something"));
      const detail = s.details.find((d) => d.component === "type_valid")!;
      expect(detail.got).toBe(0);
    });

    it("all canonical types are valid", () => {
      const types = [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "test",
        "chore",
        "build",
        "ci",
        "perf",
        "revert",
      ];
      for (const t of types) {
        const s = scoreCommit(parseConventionalCommit(`${t}: something`));
        const detail = s.details.find((d) => d.component === "type_valid")!;
        expect(detail.got, `${t} should be valid`).toBe(10);
      }
    });
  });

  describe("scope_present component", () => {
    it("scope present earns 10 pts", () => {
      const s = scoreCommit(parseConventionalCommit("feat(api): something"));
      const detail = s.details.find((d) => d.component === "scope_present")!;
      expect(detail.got).toBe(10);
    });

    it("no scope earns 0 pts", () => {
      const s = scoreCommit(parseConventionalCommit("feat: something"));
      const detail = s.details.find((d) => d.component === "scope_present")!;
      expect(detail.got).toBe(0);
    });
  });

  describe("subject_length component", () => {
    it("subject 1–50 chars earns 20 pts", () => {
      // "something" = 9 chars
      const s = scoreCommit(parseConventionalCommit("feat: something"));
      const detail = s.details.find((d) => d.component === "subject_length")!;
      expect(detail.got).toBe(20);
    });

    it("subject exactly 50 chars earns 20 pts", () => {
      const subject = "a".repeat(50);
      const s = scoreCommit(parseConventionalCommit(`feat: ${subject}`));
      const detail = s.details.find((d) => d.component === "subject_length")!;
      expect(detail.got).toBe(20);
    });

    it("subject 51–72 chars earns 15 pts", () => {
      const subject = "a".repeat(51);
      const s = scoreCommit(parseConventionalCommit(`feat: ${subject}`));
      const detail = s.details.find((d) => d.component === "subject_length")!;
      expect(detail.got).toBe(15);
    });

    it("subject exactly 72 chars earns 15 pts", () => {
      const subject = "a".repeat(72);
      const s = scoreCommit(parseConventionalCommit(`feat: ${subject}`));
      const detail = s.details.find((d) => d.component === "subject_length")!;
      expect(detail.got).toBe(15);
    });

    it("subject >72 chars earns 5 pts", () => {
      const subject = "a".repeat(73);
      const s = scoreCommit(parseConventionalCommit(`feat: ${subject}`));
      const detail = s.details.find((d) => d.component === "subject_length")!;
      expect(detail.got).toBe(5);
    });

    it("non-CC commit has subjectLength=0 and earns 0 pts", () => {
      const s = scoreCommit(parseConventionalCommit("plain commit"));
      expect(s.subjectLength).toBe(0);
      const detail = s.details.find((d) => d.component === "subject_length")!;
      expect(detail.got).toBe(0);
    });
  });

  describe("body_present component", () => {
    it("body present earns 15 pts", () => {
      const s = scoreCommit(
        parseConventionalCommit("feat: something\n\nbody text here"),
      );
      const detail = s.details.find((d) => d.component === "body_present")!;
      expect(detail.got).toBe(15);
    });

    it("no body earns 0 pts", () => {
      const s = scoreCommit(parseConventionalCommit("feat: something"));
      const detail = s.details.find((d) => d.component === "body_present")!;
      expect(detail.got).toBe(0);
    });
  });

  describe("footer_present component", () => {
    it("footer present earns 15 pts", () => {
      const s = scoreCommit(
        parseConventionalCommit(
          "feat: something\n\nbody text\n\nCloses #1",
        ),
      );
      const detail = s.details.find((d) => d.component === "footer_present")!;
      expect(detail.got).toBe(15);
    });

    it("no footer earns 0 pts", () => {
      const s = scoreCommit(
        parseConventionalCommit("feat: something\n\nbody only"),
      );
      const detail = s.details.find((d) => d.component === "footer_present")!;
      expect(detail.got).toBe(0);
    });
  });

  describe("overallScore", () => {
    it("sums component points correctly", () => {
      // feat + valid type + no scope + short subject + no body + no footer
      // 30 + 10 + 0 + 20 + 0 + 0 = 60
      const s = scoreCommit(parseConventionalCommit("feat: something"));
      expect(s.overallScore).toBe(60);
    });

    it("clamped to 100 max", () => {
      const s = scoreCommit(
        parseConventionalCommit(
          "feat(scope): add something\n\nbody\n\nCloses #1",
        ),
      );
      expect(s.overallScore).toBeLessThanOrEqual(100);
    });

    it("clamped to 0 min", () => {
      const s = scoreCommit(parseConventionalCommit(""));
      expect(s.overallScore).toBeGreaterThanOrEqual(0);
    });
  });

  describe("details array", () => {
    it("always contains exactly 6 entries", () => {
      const s = scoreCommit(parseConventionalCommit("feat: something"));
      expect(s.details).toHaveLength(6);
    });

    it("all weight fields are positive", () => {
      const s = scoreCommit(parseConventionalCommit("feat: something"));
      for (const d of s.details) {
        expect(d.weight).toBeGreaterThan(0);
      }
    });

    it("got never exceeds weight for each component", () => {
      const s = scoreCommit(
        parseConventionalCommit(
          "feat(scope): add something\n\nbody\n\nCloses #1",
        ),
      );
      for (const d of s.details) {
        expect(d.got).toBeLessThanOrEqual(d.weight);
      }
    });
  });
});
