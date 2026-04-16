import "reflect-metadata";

import type { AuditEvent } from "@commit-analyzer/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toAuditEventDto } from "./audit.mappers.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";

const makeAuditEvent = (overrides: Partial<AuditEvent> = {}): AuditEvent =>
  ({
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    userId: USER_ID,
    eventType: "auth.login",
    payload: { provider: "github" },
    ip: "127.0.0.1",
    userAgent: "test-agent",
    createdAt: new Date("2026-03-01T00:00:00.000Z"),
    ...overrides,
  }) as unknown as AuditEvent;

describe("toAuditEventDto", () => {
  it("maps entity to DTO", () => {
    const event = makeAuditEvent();
    const dto = toAuditEventDto(event);

    expect(dto).toEqual({
      id: event.id,
      eventType: "auth.login",
      payload: { provider: "github" },
      ip: "127.0.0.1",
      userAgent: "test-agent",
      createdAt: "2026-03-01T00:00:00.000Z",
    });
  });

  it("handles null ip and userAgent", () => {
    const event = makeAuditEvent({ ip: null, userAgent: null });
    const dto = toAuditEventDto(event);

    expect(dto.ip).toBeNull();
    expect(dto.userAgent).toBeNull();
  });
});
