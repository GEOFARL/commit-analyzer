import "reflect-metadata";

import type { LLMApiKey } from "@commit-analyzer/database";
import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CryptoService } from "../../shared/crypto.service.js";
import { UpstreamError } from "../commit-generation/providers/llm-provider.errors.js";
import type { LLMProviderFactory } from "../commit-generation/providers/llm-provider.factory.js";

import { LlmKeyDeletedEvent } from "./events/llm-key-deleted.event.js";
import { LlmKeyUpsertedEvent } from "./events/llm-key-upserted.event.js";
import {
  InvalidLlmApiKeyException,
  LlmProviderUnavailableException,
} from "./llm-keys.errors.js";
import { LlmKeysService } from "./llm-keys.service.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";

const makeRecord = (overrides: Partial<LLMApiKey> = {}): LLMApiKey =>
  ({
    id: "22222222-2222-2222-2222-222222222222",
    userId: USER_ID,
    provider: "openai",
    keyEnc: Buffer.from("enc"),
    keyIv: Buffer.from("iv"),
    keyTag: Buffer.from("tag"),
    status: "ok",
    createdAt: new Date("2026-02-01T00:00:00.000Z"),
    ...overrides,
  }) as unknown as LLMApiKey;

describe("LlmKeysService", () => {
  const publish = vi.fn();
  const repo = {
    listByUser: vi.fn(),
    findByUserAndProvider: vi.fn(),
    upsertForUser: vi.fn(),
    deleteByUserAndProvider: vi.fn(),
  };
  const crypto = {
    encryptParts: vi.fn(() => ({
      ciphertext: Buffer.from("c"),
      iv: Buffer.from("i"),
      tag: Buffer.from("t"),
    })),
  };
  const verify = vi.fn();
  const providers = {
    get: vi.fn(() => ({ verify, generateSuggestions: vi.fn() })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const makeService = () =>
    new LlmKeysService(
      repo as never,
      crypto as unknown as CryptoService,
      providers as unknown as LLMProviderFactory,
      { publish } as never,
    );

  describe("list", () => {
    it("delegates to the repository", async () => {
      const items = [makeRecord()];
      repo.listByUser.mockResolvedValueOnce(items);

      const result = await makeService().list(USER_ID);

      expect(result).toBe(items);
      expect(repo.listByUser).toHaveBeenCalledWith(USER_ID);
    });
  });

  describe("upsert", () => {
    it("stores an encrypted key once the provider verifies it", async () => {
      verify.mockResolvedValueOnce(true);
      const saved = makeRecord();
      repo.upsertForUser.mockResolvedValueOnce(saved);

      const result = await makeService().upsert(
        USER_ID,
        "openai",
        "sk-live-validkey1",
      );

      expect(verify).toHaveBeenCalledWith("sk-live-validkey1");
      expect(crypto.encryptParts).toHaveBeenCalledWith("sk-live-validkey1");
      expect(repo.upsertForUser).toHaveBeenCalledWith({
        userId: USER_ID,
        provider: "openai",
        keyEnc: Buffer.from("c"),
        keyIv: Buffer.from("i"),
        keyTag: Buffer.from("t"),
        status: "ok",
      });
      expect(publish).toHaveBeenCalledWith(new LlmKeyUpsertedEvent(USER_ID, "openai"));
      expect(result).toBe(saved);
    });

    // `BaseLLMProvider.verify()` returns false on AuthError — the service's
    // invalid-key path must trigger on that boolean, not on an exception.
    it("rejects with 422 when verify returns false (provider auth rejection)", async () => {
      verify.mockResolvedValueOnce(false);

      await expect(
        makeService().upsert(USER_ID, "openai", "sk-invalid-key-12345"),
      ).rejects.toBeInstanceOf(InvalidLlmApiKeyException);

      expect(repo.upsertForUser).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    // `BaseLLMProvider.verify()` maps QuotaError → true so the user isn't
    // blocked from saving a working key during a rate-limit hiccup; the
    // service must honor that boolean.
    it("saves when verify returns true even during a quota hiccup", async () => {
      verify.mockResolvedValueOnce(true);
      repo.upsertForUser.mockResolvedValueOnce(makeRecord());

      await makeService().upsert(
        USER_ID,
        "openai",
        "sk-quota-exhausted123",
      );

      expect(repo.upsertForUser).toHaveBeenCalled();
      expect(publish).toHaveBeenCalledWith(
        new LlmKeyUpsertedEvent(USER_ID, "openai"),
      );
    });

    // UpstreamError is the only category `verify()` re-throws.
    it("surfaces LlmProviderUnavailableException on upstream failures", async () => {
      verify.mockRejectedValueOnce(new UpstreamError("5xx"));

      await expect(
        makeService().upsert(USER_ID, "openai", "sk-working-maybe12345"),
      ).rejects.toBeInstanceOf(LlmProviderUnavailableException);
      expect(repo.upsertForUser).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("emits LlmKeyDeletedEvent when a row was removed", async () => {
      repo.deleteByUserAndProvider.mockResolvedValueOnce(true);

      await makeService().remove(USER_ID, "openai");

      expect(publish).toHaveBeenCalledWith(
        new LlmKeyDeletedEvent(USER_ID, "openai"),
      );
    });

    it("throws NotFoundException when no row was removed", async () => {
      repo.deleteByUserAndProvider.mockResolvedValueOnce(false);

      await expect(
        makeService().remove(USER_ID, "anthropic"),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(publish).not.toHaveBeenCalled();
    });
  });
});
