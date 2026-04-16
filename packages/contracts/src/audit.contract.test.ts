import { describe, expect, it } from "vitest";

import {
  auditContract,
  auditEventSchema,
  auditEventTypeSchema,
  auditEventTypes,
} from "./audit.contract.js";

const validEvent = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  eventType: "auth.login",
  payload: { provider: "github" },
  ip: "127.0.0.1",
  userAgent: "test-agent",
  createdAt: "2026-03-01T00:00:00.000Z",
};

describe("auditEventTypeSchema", () => {
  it("accepts all 9 event types", () => {
    for (const t of auditEventTypes) {
      expect(auditEventTypeSchema.parse(t)).toBe(t);
    }
  });

  it("rejects unknown event type", () => {
    expect(() => auditEventTypeSchema.parse("unknown.type")).toThrow();
  });

  it("defines exactly 9 event types", () => {
    expect(auditEventTypes).toHaveLength(9);
  });
});

describe("auditEventSchema", () => {
  it("parses a valid audit event", () => {
    expect(auditEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it("accepts null ip and userAgent", () => {
    const parsed = auditEventSchema.parse({
      ...validEvent,
      ip: null,
      userAgent: null,
    });
    expect(parsed.ip).toBeNull();
    expect(parsed.userAgent).toBeNull();
  });

  it("rejects non-uuid id", () => {
    expect(() =>
      auditEventSchema.parse({ ...validEvent, id: "bad" }),
    ).toThrow();
  });
});

describe("auditContract", () => {
  it("declares GET /audit-events", () => {
    expect(auditContract.list.method).toBe("GET");
    expect(auditContract.list.path).toBe("/audit-events");
  });

  it("tags with jwt auth", () => {
    expect(auditContract.list.metadata).toEqual({ auth: "jwt", rateLimit: "default" });
  });
});
