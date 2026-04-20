import { describe, expect, it } from "vitest";

import { allowedScopes } from "./allowed-scopes.rule.js";
import { allowedTypes } from "./allowed-types.rule.js";
import { bodyRequired } from "./body-required.rule.js";
import { footerRequired } from "./footer-required.rule.js";
import { maxSubjectLength } from "./max-subject-length.rule.js";
import type { ParsedOk } from "./types.js";

const baseParsed: ParsedOk = {
  ok: true,
  type: "feat",
  subject: "add thing",
  isBreaking: false,
};

const withOverrides = (o: Partial<ParsedOk>): ParsedOk => ({
  ...baseParsed,
  ...o,
});

describe("allowedTypes", () => {
  it("passes when type is in the list", () => {
    expect(
      allowedTypes(withOverrides({ type: "feat" }), ["feat", "fix"]),
    ).toEqual({ passed: true });
  });

  it("fails with message when type is not in the list", () => {
    const out = allowedTypes(withOverrides({ type: "wip" }), ["feat", "fix"]);
    expect(out.passed).toBe(false);
    expect(out.message).toContain("wip");
    expect(out.message).toContain("feat, fix");
  });

  it("edge: empty list fails every type", () => {
    const out = allowedTypes(withOverrides({ type: "feat" }), []);
    expect(out.passed).toBe(false);
  });
});

describe("allowedScopes", () => {
  describe("list variant", () => {
    it("passes when scope is in values", () => {
      expect(
        allowedScopes(withOverrides({ scope: "api" }), {
          kind: "list",
          values: ["api", "web"],
        }),
      ).toEqual({ passed: true });
    });

    it("fails when scope is not in values", () => {
      const out = allowedScopes(withOverrides({ scope: "cli" }), {
        kind: "list",
        values: ["api", "web"],
      });
      expect(out.passed).toBe(false);
      expect(out.message).toContain("cli");
    });

    it("edge: missing scope treated as empty string", () => {
      const out = allowedScopes(withOverrides({ scope: undefined }), {
        kind: "list",
        values: ["api"],
      });
      expect(out.passed).toBe(false);
      expect(out.message).toContain('""');
    });

    it("edge: empty string scope matches when list contains empty string", () => {
      expect(
        allowedScopes(withOverrides({ scope: undefined }), {
          kind: "list",
          values: [""],
        }),
      ).toEqual({ passed: true });
    });
  });

  describe("regex variant", () => {
    it("passes when scope matches pattern", () => {
      expect(
        allowedScopes(withOverrides({ scope: "api-v2" }), {
          kind: "regex",
          pattern: "^api(-v\\d+)?$",
        }),
      ).toEqual({ passed: true });
    });

    it("fails when scope does not match pattern", () => {
      const out = allowedScopes(withOverrides({ scope: "frontend" }), {
        kind: "regex",
        pattern: "^api(-v\\d+)?$",
      });
      expect(out.passed).toBe(false);
      expect(out.message).toContain("frontend");
    });

    it("edge: missing scope tested as empty string against regex", () => {
      expect(
        allowedScopes(withOverrides({ scope: undefined }), {
          kind: "regex",
          pattern: "^$",
        }),
      ).toEqual({ passed: true });
    });
  });
});

describe("maxSubjectLength", () => {
  it("passes when subject length is under the limit", () => {
    expect(
      maxSubjectLength(withOverrides({ subject: "short" }), 50),
    ).toEqual({ passed: true });
  });

  it("passes at exactly the boundary (<=)", () => {
    expect(
      maxSubjectLength(withOverrides({ subject: "x".repeat(50) }), 50),
    ).toEqual({ passed: true });
  });

  it("fails when subject length exceeds the limit", () => {
    const out = maxSubjectLength(
      withOverrides({ subject: "x".repeat(51) }),
      50,
    );
    expect(out.passed).toBe(false);
    expect(out.message).toContain("51");
    expect(out.message).toContain("50");
  });

  it("edge: limit 0 rejects every non-empty subject", () => {
    const out = maxSubjectLength(withOverrides({ subject: "x" }), 0);
    expect(out.passed).toBe(false);
  });
});

describe("bodyRequired", () => {
  it("passes when value=false regardless of body", () => {
    expect(bodyRequired(withOverrides({ body: undefined }), false)).toEqual({
      passed: true,
    });
  });

  it("passes when value=true and body present", () => {
    expect(
      bodyRequired(withOverrides({ body: "why this change" }), true),
    ).toEqual({ passed: true });
  });

  it("fails when value=true and body missing", () => {
    expect(bodyRequired(withOverrides({ body: undefined }), true)).toEqual({
      passed: false,
      message: "body is required",
    });
  });

  it("edge: empty-string body counts as missing", () => {
    expect(bodyRequired(withOverrides({ body: "" }), true)).toEqual({
      passed: false,
      message: "body is required",
    });
  });
});

describe("footerRequired", () => {
  it("passes when value=false regardless of footer", () => {
    expect(footerRequired(withOverrides({ footer: undefined }), false)).toEqual(
      { passed: true },
    );
  });

  it("passes when value=true and footer present", () => {
    expect(
      footerRequired(withOverrides({ footer: "Closes #7" }), true),
    ).toEqual({ passed: true });
  });

  it("fails when value=true and footer missing", () => {
    expect(footerRequired(withOverrides({ footer: undefined }), true)).toEqual({
      passed: false,
      message: "footer is required",
    });
  });

  it("edge: empty-string footer counts as missing", () => {
    expect(footerRequired(withOverrides({ footer: "" }), true)).toEqual({
      passed: false,
      message: "footer is required",
    });
  });
});
