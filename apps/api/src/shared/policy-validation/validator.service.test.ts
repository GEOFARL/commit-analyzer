import "reflect-metadata";

import { beforeEach, describe, expect, it } from "vitest";

import { UnknownPolicyRuleError } from "./rules/registry.js";
import { ValidatorService } from "./validator.service.js";
import type { ValidatorPolicy } from "./validator.service.types.js";

const makePolicy = (
  rules: ValidatorPolicy["rules"] = [],
): ValidatorPolicy => ({ rules });

describe("ValidatorService", () => {
  let service: ValidatorService;

  beforeEach(() => {
    service = new ValidatorService();
  });

  describe("format short-circuit", () => {
    it("returns format failure when message is empty", () => {
      const r = service.validate(
        "",
        makePolicy([{ ruleType: "allowedTypes", ruleValue: ["feat"] }]),
      );
      expect(r).toEqual({
        passed: false,
        results: [{ ruleType: "format", passed: false, message: "empty" }],
      });
    });

    it("returns format failure with reason=no-type", () => {
      const r = service.validate("not a conventional commit", makePolicy());
      expect(r.passed).toBe(false);
      expect(r.results).toHaveLength(1);
      expect(r.results[0]).toEqual({
        ruleType: "format",
        passed: false,
        message: "no-type",
      });
    });

    it("returns format failure with reason=malformed-header", () => {
      const r = service.validate("Feat: upper case", makePolicy());
      expect(r.results[0]?.message).toBe("malformed-header");
    });

    it("skips all rules on format failure", () => {
      const r = service.validate(
        "bad",
        makePolicy([{ ruleType: "allowedTypes", ruleValue: ["feat"] }]),
      );
      expect(r.results).toHaveLength(1);
    });
  });

  describe("rule orchestration", () => {
    it("passes when all rules pass", () => {
      const r = service.validate(
        "feat(api): add endpoint\n\nbody text\n\nCloses #1",
        makePolicy([
          { ruleType: "allowedTypes", ruleValue: ["feat", "fix"] },
          {
            ruleType: "allowedScopes",
            ruleValue: { kind: "list", values: ["api", "web"] },
          },
          { ruleType: "maxSubjectLength", ruleValue: 50 },
          { ruleType: "bodyRequired", ruleValue: true },
          { ruleType: "footerRequired", ruleValue: true },
        ]),
      );
      expect(r.passed).toBe(true);
      expect(r.results).toHaveLength(5);
      expect(r.results.every((x) => x.passed)).toBe(true);
    });

    it("fails when any rule fails and runs every rule", () => {
      const r = service.validate(
        "feat: huge subject that goes way past the configured limit for sure",
        makePolicy([
          { ruleType: "allowedTypes", ruleValue: ["feat"] },
          { ruleType: "maxSubjectLength", ruleValue: 10 },
        ]),
      );
      expect(r.passed).toBe(false);
      expect(r.results).toHaveLength(2);
      expect(r.results[0]?.passed).toBe(true);
      expect(r.results[1]?.passed).toBe(false);
    });

    it("returns passed=true with empty results when policy has no rules", () => {
      const r = service.validate("feat: noop", makePolicy([]));
      expect(r).toEqual({ passed: true, results: [] });
    });

    it("preserves rule order in results", () => {
      const r = service.validate(
        "feat: ok",
        makePolicy([
          { ruleType: "maxSubjectLength", ruleValue: 50 },
          { ruleType: "allowedTypes", ruleValue: ["feat"] },
        ]),
      );
      expect(r.results.map((x) => x.ruleType)).toEqual([
        "maxSubjectLength",
        "allowedTypes",
      ]);
    });

    it("omits message when rule passes", () => {
      const r = service.validate(
        "feat: ok",
        makePolicy([{ ruleType: "allowedTypes", ruleValue: ["feat"] }]),
      );
      expect(r.results[0]).toEqual({ ruleType: "allowedTypes", passed: true });
      expect("message" in r.results[0]!).toBe(false);
    });

    it("includes message when rule fails", () => {
      const r = service.validate(
        "feat: ok",
        makePolicy([{ ruleType: "allowedTypes", ruleValue: ["fix"] }]),
      );
      expect(r.results[0]?.passed).toBe(false);
      expect(r.results[0]?.message).toBeDefined();
    });
  });

  describe("unknown rule type", () => {
    it("throws UnknownPolicyRuleError for an unregistered ruleType", () => {
      const bogus = {
        ruleType: "subject_imperative",
        ruleValue: true,
      } as never;
      expect(() => service.validate("feat: ok", makePolicy([bogus]))).toThrow(
        UnknownPolicyRuleError,
      );
    });

    it("error carries the offending ruleType", () => {
      const bogus = {
        ruleType: "ticket_reference",
        ruleValue: "X",
      } as never;
      try {
        service.validate("feat: ok", makePolicy([bogus]));
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(UnknownPolicyRuleError);
        expect((err as UnknownPolicyRuleError).ruleType).toBe(
          "ticket_reference",
        );
      }
    });
  });
});
