import { describe, expect, it } from "vitest";

import {
  createPolicySchema,
  defaultPolicyTemplateResponseSchema,
  defaultPolicyTemplateSchema,
  policiesContract,
  policyDtoSchema,
  policyRuleSchema,
  ruleResultSchema,
  updatePolicySchema,
  validatePolicyInputSchema,
  validationResultSchema,
} from "./policies.contract.js";

const uuid = "2f5c1e3a-9d4b-4a7e-8f2c-1b3d4e5f6a7b";

const validPolicyDto = {
  id: uuid,
  repositoryId: "a1111111-2222-4333-8444-555555555555",
  name: "conventional-commits",
  isActive: true,
  rules: [
    {
      id: "b1111111-2222-4333-8444-555555555555",
      ruleType: "maxSubjectLength" as const,
      ruleValue: 72,
    },
  ],
  createdAt: "2026-04-20T10:00:00.000Z",
  updatedAt: "2026-04-22T10:00:00.000Z",
};

describe("policyRuleSchema", () => {
  it("accepts allowedTypes with a non-empty list", () => {
    expect(
      policyRuleSchema.parse({
        ruleType: "allowedTypes",
        ruleValue: ["feat", "fix"],
      }),
    ).toEqual({ ruleType: "allowedTypes", ruleValue: ["feat", "fix"] });
  });

  it("accepts allowedScopes with a regex kind", () => {
    const parsed = policyRuleSchema.parse({
      ruleType: "allowedScopes",
      ruleValue: { kind: "regex", pattern: "^[a-z-]+$" },
    });
    expect(parsed.ruleType).toBe("allowedScopes");
  });

  it("rejects allowedScopes with invalid regex", () => {
    expect(() =>
      policyRuleSchema.parse({
        ruleType: "allowedScopes",
        ruleValue: { kind: "regex", pattern: "[unclosed" },
      }),
    ).toThrow();
  });

  it("rejects maxSubjectLength above 500", () => {
    expect(() =>
      policyRuleSchema.parse({ ruleType: "maxSubjectLength", ruleValue: 501 }),
    ).toThrow();
  });

  it("rejects unknown rule type", () => {
    expect(() =>
      policyRuleSchema.parse({ ruleType: "unknown", ruleValue: true }),
    ).toThrow();
  });
});

describe("createPolicySchema", () => {
  it("defaults rules to an empty array", () => {
    const parsed = createPolicySchema.parse({ name: "strict" });
    expect(parsed.rules).toEqual([]);
  });

  it("rejects empty name", () => {
    expect(() => createPolicySchema.parse({ name: "" })).toThrow();
  });
});

describe("updatePolicySchema", () => {
  it("allows name only", () => {
    expect(updatePolicySchema.parse({ name: "renamed" })).toEqual({
      name: "renamed",
    });
  });

  it("allows rules only", () => {
    const parsed = updatePolicySchema.parse({
      rules: [{ ruleType: "bodyRequired", ruleValue: true }],
    });
    expect(parsed.rules).toHaveLength(1);
  });
});

describe("policyDtoSchema", () => {
  it("parses a valid policy dto", () => {
    expect(policyDtoSchema.parse(validPolicyDto)).toEqual(validPolicyDto);
  });

  it("rejects non-iso createdAt", () => {
    expect(() =>
      policyDtoSchema.parse({ ...validPolicyDto, createdAt: "today" }),
    ).toThrow();
  });
});

describe("validatePolicyInputSchema", () => {
  it("accepts a non-empty message", () => {
    expect(
      validatePolicyInputSchema.parse({ message: "feat: add widget" }),
    ).toEqual({ message: "feat: add widget" });
  });

  it("rejects an empty message", () => {
    expect(() => validatePolicyInputSchema.parse({ message: "" })).toThrow();
  });
});

describe("ruleResultSchema", () => {
  it("accepts format result without message", () => {
    expect(
      ruleResultSchema.parse({ ruleType: "format", passed: false }),
    ).toEqual({ ruleType: "format", passed: false });
  });

  it("accepts a rule-type result with a message", () => {
    expect(
      ruleResultSchema.parse({
        ruleType: "bodyRequired",
        passed: false,
        message: "body is required",
      }),
    ).toMatchObject({ ruleType: "bodyRequired", passed: false });
  });
});

describe("validationResultSchema", () => {
  it("parses a passed validation", () => {
    expect(
      validationResultSchema.parse({
        passed: true,
        results: [{ ruleType: "maxSubjectLength", passed: true }],
      }),
    ).toMatchObject({ passed: true });
  });
});

describe("policiesContract", () => {
  it("declares every endpoint in scope", () => {
    expect(policiesContract.list.method).toBe("GET");
    expect(policiesContract.list.path).toBe("/repos/:repoId/policies");
    expect(policiesContract.get.method).toBe("GET");
    expect(policiesContract.get.path).toBe("/repos/:repoId/policies/:id");
    expect(policiesContract.create.method).toBe("POST");
    expect(policiesContract.create.path).toBe("/repos/:repoId/policies");
    expect(policiesContract.update.method).toBe("PATCH");
    expect(policiesContract.update.path).toBe("/repos/:repoId/policies/:id");
    expect(policiesContract.delete.method).toBe("DELETE");
    expect(policiesContract.delete.path).toBe("/repos/:repoId/policies/:id");
    expect(policiesContract.activate.method).toBe("POST");
    expect(policiesContract.activate.path).toBe(
      "/repos/:repoId/policies/:id/activate",
    );
    expect(policiesContract.validate.method).toBe("POST");
    expect(policiesContract.validate.path).toBe(
      "/repos/:repoId/policies/:id/validate",
    );
  });

  it("tags every policy endpoint with jwt + default rate limit", () => {
    const expected = { auth: "jwt", rateLimit: "default" };
    expect(policiesContract.list.metadata).toEqual(expected);
    expect(policiesContract.get.metadata).toEqual(expected);
    expect(policiesContract.create.metadata).toEqual(expected);
    expect(policiesContract.update.metadata).toEqual(expected);
    expect(policiesContract.delete.metadata).toEqual(expected);
    expect(policiesContract.activate.metadata).toEqual(expected);
    expect(policiesContract.validate.metadata).toEqual(expected);
    expect(policiesContract.defaults.get.metadata).toEqual(expected);
    expect(policiesContract.defaults.update.metadata).toEqual(expected);
    expect(policiesContract.defaults.clear.metadata).toEqual(expected);
  });

  it("declares the defaults sub-routes at the settings path", () => {
    expect(policiesContract.defaults.get.method).toBe("GET");
    expect(policiesContract.defaults.get.path).toBe("/settings/default-policy");
    expect(policiesContract.defaults.update.method).toBe("PUT");
    expect(policiesContract.defaults.update.path).toBe(
      "/settings/default-policy",
    );
    expect(policiesContract.defaults.clear.method).toBe("DELETE");
    expect(policiesContract.defaults.clear.path).toBe(
      "/settings/default-policy",
    );
  });
});

describe("defaultPolicyTemplateSchema", () => {
  it("defaults rules to empty when omitted", () => {
    expect(defaultPolicyTemplateSchema.parse({ enabled: true })).toEqual({
      enabled: true,
      rules: [],
    });
  });

  it("requires enabled flag", () => {
    expect(() =>
      defaultPolicyTemplateSchema.parse({ rules: [] }),
    ).toThrow();
  });

  it("rejects invalid rule shapes", () => {
    expect(() =>
      defaultPolicyTemplateSchema.parse({
        enabled: true,
        rules: [{ ruleType: "allowedTypes", ruleValue: [] }],
      }),
    ).toThrow();
  });
});

describe("defaultPolicyTemplateResponseSchema", () => {
  it("accepts a null template", () => {
    expect(
      defaultPolicyTemplateResponseSchema.parse({ template: null }),
    ).toEqual({ template: null });
  });

  it("accepts a populated template", () => {
    expect(
      defaultPolicyTemplateResponseSchema.parse({
        template: {
          enabled: false,
          rules: [{ ruleType: "bodyRequired", ruleValue: false }],
        },
      }),
    ).toEqual({
      template: {
        enabled: false,
        rules: [{ ruleType: "bodyRequired", ruleValue: false }],
      },
    });
  });
});
