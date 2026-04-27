import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { DefaultPolicyService } from "./default-policy.service.js";
import { PolicyRuleInvalidError } from "./policy.errors.js";

const USER_ID = "user-1";

describe("DefaultPolicyService", () => {
  let getStored: ReturnType<typeof vi.fn>;
  let setStored: ReturnType<typeof vi.fn>;
  let service: DefaultPolicyService;

  beforeEach(() => {
    getStored = vi.fn();
    setStored = vi.fn().mockResolvedValue(undefined);
    const users = {
      getDefaultPolicyTemplate: getStored,
      setDefaultPolicyTemplate: setStored,
    } as never;
    service = new DefaultPolicyService(users);
  });

  describe("getDefaultPolicyTemplate", () => {
    it("returns null when nothing is stored", async () => {
      getStored.mockResolvedValue(null);

      const result = await service.getDefaultPolicyTemplate(USER_ID);

      expect(result).toBeNull();
      expect(getStored).toHaveBeenCalledWith(USER_ID);
    });

    it("parses and returns a stored template", async () => {
      getStored.mockResolvedValue({
        enabled: true,
        rules: [{ ruleType: "bodyRequired", ruleValue: true }],
      });

      const result = await service.getDefaultPolicyTemplate(USER_ID);

      expect(result).toEqual({
        enabled: true,
        rules: [{ ruleType: "bodyRequired", ruleValue: true }],
      });
    });

    it("returns null when stored data fails validation", async () => {
      getStored.mockResolvedValue({ enabled: "yes", rules: "broken" });

      const result = await service.getDefaultPolicyTemplate(USER_ID);

      expect(result).toBeNull();
    });
  });

  describe("setDefaultPolicyTemplate", () => {
    it("persists a valid template and returns it", async () => {
      const input = {
        enabled: true,
        rules: [{ ruleType: "maxSubjectLength", ruleValue: 72 }],
      };

      const result = await service.setDefaultPolicyTemplate(USER_ID, input);

      expect(result).toEqual(input);
      expect(setStored).toHaveBeenCalledWith(USER_ID, input);
    });

    it("defaults rules to empty when omitted", async () => {
      const result = await service.setDefaultPolicyTemplate(USER_ID, {
        enabled: false,
      });

      expect(result).toEqual({ enabled: false, rules: [] });
      expect(setStored).toHaveBeenCalledWith(USER_ID, {
        enabled: false,
        rules: [],
      });
    });

    it("rejects invalid rule input without persisting", async () => {
      await expect(
        service.setDefaultPolicyTemplate(USER_ID, {
          enabled: true,
          rules: [{ ruleType: "allowedTypes", ruleValue: [] }],
        }),
      ).rejects.toBeInstanceOf(PolicyRuleInvalidError);
      expect(setStored).not.toHaveBeenCalled();
    });

    it("rejects invalid regex scope without persisting", async () => {
      await expect(
        service.setDefaultPolicyTemplate(USER_ID, {
          enabled: true,
          rules: [
            {
              ruleType: "allowedScopes",
              ruleValue: { kind: "regex", pattern: "([broken" },
            },
          ],
        }),
      ).rejects.toBeInstanceOf(PolicyRuleInvalidError);
      expect(setStored).not.toHaveBeenCalled();
    });

    it("rejects missing enabled flag", async () => {
      await expect(
        service.setDefaultPolicyTemplate(USER_ID, { rules: [] }),
      ).rejects.toBeInstanceOf(PolicyRuleInvalidError);
    });
  });

  describe("clearDefaultPolicyTemplate", () => {
    it("persists null to clear the stored template", async () => {
      await service.clearDefaultPolicyTemplate(USER_ID);

      expect(setStored).toHaveBeenCalledWith(USER_ID, null);
    });
  });
});
