import "reflect-metadata";

import type { AuditEvent } from "@commit-analyzer/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuditService } from "./audit.service.js";

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

describe("AuditService", () => {
  const auditEvents = {
    create: vi.fn((v: Partial<AuditEvent>) => v as AuditEvent),
    save: vi.fn(),
    list: vi.fn(),
  };
  const cls = {
    get: vi.fn(),
  };

  let service: AuditService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuditService(auditEvents as never, cls as never);
  });

  describe("record", () => {
    it("saves a valid audit event", async () => {
      auditEvents.save.mockResolvedValue(makeAuditEvent());

      await service.record({
        userId: USER_ID,
        eventType: "auth.login",
        payload: { provider: "github" },
        ip: "127.0.0.1",
        userAgent: "test-agent",
      });

      expect(auditEvents.create).toHaveBeenCalledWith({
        userId: USER_ID,
        eventType: "auth.login",
        payload: { provider: "github" },
        ip: "127.0.0.1",
        userAgent: "test-agent",
      });
      expect(auditEvents.save).toHaveBeenCalledTimes(1);
    });

    it("rejects unknown event types", async () => {
      await expect(
        service.record({
          userId: USER_ID,
          eventType: "unknown.type" as never,
          payload: {},
        }),
      ).rejects.toThrow();
    });

    it("rejects invalid payload for event type", async () => {
      await expect(
        service.record({
          userId: USER_ID,
          eventType: "auth.login",
          payload: { wrong: "field" },
        }),
      ).rejects.toThrow();
    });

    it("accepts valid apikey.created payload", async () => {
      auditEvents.save.mockResolvedValue(makeAuditEvent());

      await service.record({
        userId: USER_ID,
        eventType: "apikey.created",
        payload: {
          api_key_id: "22222222-2222-2222-2222-222222222222",
          name: "cli",
          key_prefix: "git_abcd",
        },
      });

      expect(auditEvents.save).toHaveBeenCalledTimes(1);
    });

    it("accepts valid generation.completed payload", async () => {
      auditEvents.save.mockResolvedValue(makeAuditEvent());

      await service.record({
        userId: USER_ID,
        eventType: "generation.completed",
        payload: {
          generation_id: "33333333-3333-3333-3333-333333333333",
          provider: "openai",
          model: "gpt-4",
          tokens_used: 150,
        },
      });

      expect(auditEvents.save).toHaveBeenCalledTimes(1);
    });

    it("strips extra fields from payload via zod", async () => {
      auditEvents.save.mockResolvedValue(makeAuditEvent());

      await service.record({
        userId: USER_ID,
        eventType: "auth.login",
        payload: { provider: "github", token: "secret" },
      });

      const createArg = auditEvents.create.mock.calls[0]?.[0] as {
        payload: Record<string, unknown>;
      };
      expect(createArg.payload).toEqual({ provider: "github" });
      expect(createArg.payload).not.toHaveProperty("token");
    });
  });

  describe("list", () => {
    it("returns items with nextCursor when more available", async () => {
      const items = Array.from({ length: 3 }, (_, i) =>
        makeAuditEvent({
          id: `${i}0000000-0000-0000-0000-000000000000`,
          createdAt: new Date(`2026-03-0${(3 - i).toString()}T00:00:00.000Z`),
        }),
      );
      auditEvents.list.mockResolvedValue(items);

      const result = await service.list({ userId: USER_ID, limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe("2026-03-02T00:00:00.000Z");
      expect(auditEvents.list).toHaveBeenCalledWith({
        userId: USER_ID,
        limit: 3,
        cursor: undefined,
        eventType: undefined,
      });
    });

    it("returns null nextCursor when no more items", async () => {
      const items = [makeAuditEvent()];
      auditEvents.list.mockResolvedValue(items);

      const result = await service.list({ userId: USER_ID, limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it("passes eventType filter to repository", async () => {
      auditEvents.list.mockResolvedValue([]);

      await service.list({
        userId: USER_ID,
        limit: 50,
        eventType: "auth.login",
      });

      expect(auditEvents.list).toHaveBeenCalledWith({
        userId: USER_ID,
        limit: 51,
        cursor: undefined,
        eventType: "auth.login",
      });
    });
  });
});
