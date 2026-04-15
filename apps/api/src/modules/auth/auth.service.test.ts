import "reflect-metadata";

import type { ApiKey, User } from "@commit-analyzer/database";
import {
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthService } from "./auth.service.js";
import { ApiKeyCreatedEvent } from "./events/api-key-created.event.js";
import { ApiKeyRevokedEvent } from "./events/api-key-revoked.event.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const API_KEY_ID = "22222222-2222-2222-2222-222222222222";

const makeUser = (): User =>
  ({
    id: USER_ID,
    githubId: "gh-1",
    email: "user@example.com",
    username: "user",
    avatarUrl: null,
    accessTokenEnc: null,
    accessTokenIv: null,
    accessTokenTag: null,
    defaultPolicyTemplate: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    repositories: [],
    apiKeys: [],
    llmApiKeys: [],
  }) as unknown as User;

const makeApiKey = (overrides: Partial<ApiKey> = {}): ApiKey =>
  ({
    id: API_KEY_ID,
    userId: USER_ID,
    name: "cli",
    keyPrefix: "git_abcd",
    keyHash: "hash",
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  }) as unknown as ApiKey;

describe("AuthService", () => {
  const publish = vi.fn();
  const users = {
    findByAuthId: vi.fn(),
  };
  const apiKeys = {
    listActiveByUser: vi.fn(),
    findActiveByIdForUser: vi.fn(),
    revoke: vi.fn(),
    create: vi.fn((v: Partial<ApiKey>) => v as ApiKey),
    save: vi.fn(),
  };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      users as never,
      apiKeys as never,
      { publish } as never,
    );
  });

  describe("me", () => {
    it("returns user", async () => {
      const user = makeUser();
      users.findByAuthId.mockResolvedValue(user);
      await expect(service.me(USER_ID)).resolves.toBe(user);
      expect(users.findByAuthId).toHaveBeenCalledWith(USER_ID);
    });

    it("throws 401 when user missing", async () => {
      users.findByAuthId.mockResolvedValue(null);
      await expect(service.me(USER_ID)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe("listApiKeys", () => {
    it("delegates to listActiveByUser", async () => {
      const keys = [makeApiKey()];
      apiKeys.listActiveByUser.mockResolvedValue(keys);
      await expect(service.listApiKeys(USER_ID)).resolves.toBe(keys);
      expect(apiKeys.listActiveByUser).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe("mintApiKey", () => {
    it("retries once on unique_violation and succeeds", async () => {
      const saved = makeApiKey();
      const uniqueErr = { code: "23505" };
      apiKeys.save
        .mockRejectedValueOnce(uniqueErr)
        .mockResolvedValueOnce(saved);

      const result = await service.mintApiKey(USER_ID, "cli");

      expect(apiKeys.save).toHaveBeenCalledTimes(2);
      expect(result.record).toBe(saved);
      expect(publish).toHaveBeenCalledTimes(1);
    });

    it("gives up after 3 attempts with 500", async () => {
      apiKeys.save.mockRejectedValue({ code: "23505" });
      await expect(
        service.mintApiKey(USER_ID, "cli"),
      ).rejects.toBeInstanceOf(InternalServerErrorException);
      expect(apiKeys.save).toHaveBeenCalledTimes(3);
      expect(publish).not.toHaveBeenCalled();
    });

    it("rethrows non-unique errors without retry", async () => {
      apiKeys.save.mockRejectedValue(new Error("boom"));
      await expect(service.mintApiKey(USER_ID, "cli")).rejects.toThrow("boom");
      expect(apiKeys.save).toHaveBeenCalledTimes(1);
      expect(publish).not.toHaveBeenCalled();
    });

    it("generates secret, stores argon2 hash, returns plaintext once, publishes event", async () => {
      const saved = makeApiKey();
      apiKeys.save.mockResolvedValue(saved);

      const result = await service.mintApiKey(USER_ID, "cli");

      expect(result.key.startsWith("git_")).toBe(true);
      expect(result.key.length).toBeGreaterThan(8);

      expect(apiKeys.create).toHaveBeenCalledTimes(1);
      const createArg = apiKeys.create.mock.calls[0]?.[0] as {
        userId: string;
        name: string;
        keyPrefix: string;
        keyHash: string;
      };
      expect(createArg.userId).toBe(USER_ID);
      expect(createArg.name).toBe("cli");
      expect(createArg.keyPrefix).toBe(result.key.slice(0, 8));
      expect(createArg.keyHash).not.toEqual(result.key);
      await expect(argon2.verify(createArg.keyHash, result.key)).resolves.toBe(
        true,
      );

      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0]?.[0] as ApiKeyCreatedEvent;
      expect(event).toBeInstanceOf(ApiKeyCreatedEvent);
      expect(event.apiKeyId).toBe(saved.id);
      expect(event.name).toBe(saved.name);
      expect(event.keyPrefix).toBe(saved.keyPrefix);
    });
  });

  describe("revokeApiKey", () => {
    it("calls revoke and publishes event", async () => {
      const record = makeApiKey();
      apiKeys.findActiveByIdForUser.mockResolvedValue(record);
      apiKeys.revoke.mockResolvedValue(undefined);

      await service.revokeApiKey(USER_ID, API_KEY_ID);

      expect(apiKeys.findActiveByIdForUser).toHaveBeenCalledWith(
        API_KEY_ID,
        USER_ID,
      );
      expect(apiKeys.revoke).toHaveBeenCalledWith(record.id);
      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0]?.[0] as ApiKeyRevokedEvent;
      expect(event).toBeInstanceOf(ApiKeyRevokedEvent);
      expect(event.apiKeyId).toBe(record.id);
      expect(event.keyPrefix).toBe(record.keyPrefix);
    });

    it("throws 404 when key missing or already revoked", async () => {
      apiKeys.findActiveByIdForUser.mockResolvedValue(null);
      await expect(
        service.revokeApiKey(USER_ID, API_KEY_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(publish).not.toHaveBeenCalled();
      expect(apiKeys.revoke).not.toHaveBeenCalled();
    });
  });
});
