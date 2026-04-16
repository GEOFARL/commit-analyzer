import "reflect-metadata";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditService } from "../audit.service.js";
import { PolicyActivatedEvent } from "../events/policy-activated.event.js";

import { OnPolicyActivatedHandler } from "./on-policy-activated.handler.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const REPO_ID = "22222222-2222-2222-2222-222222222222";
const POLICY_ID = "33333333-3333-3333-3333-333333333333";

describe("OnPolicyActivatedHandler", () => {
  const record = vi.fn();
  let handler: OnPolicyActivatedHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new OnPolicyActivatedHandler({ record } as unknown as AuditService);
  });

  it("calls AuditService.record with policy.activated", async () => {
    await handler.handle(new PolicyActivatedEvent(USER_ID, REPO_ID, POLICY_ID));

    expect(record).toHaveBeenCalledWith({
      userId: USER_ID,
      eventType: "policy.activated",
      payload: {
        repository_id: REPO_ID,
        policy_id: POLICY_ID,
      },
    });
  });
});
