import type { UpsertLlmKeyRequest } from "@commit-analyzer/contracts";
import type { LLMApiKey, LLMApiKeyRepository } from "@commit-analyzer/database";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import { LLM_API_KEY_REPOSITORY } from "../../common/database/tokens.js";
import { CryptoService } from "../../shared/crypto.service.js";
import { LlmKeyDeletedEvent } from "../audit/events/llm-key-deleted.event.js";
import { LlmKeyUpsertedEvent } from "../audit/events/llm-key-upserted.event.js";
import {
  AuthError,
  QuotaError,
  mapProviderError,
} from "../commit-generation/providers/llm-provider.errors.js";
import { LLMProviderFactory } from "../commit-generation/providers/llm-provider.factory.js";

import {
  InvalidLlmApiKeyException,
  LlmProviderUnavailableException,
} from "./llm-keys.errors.js";

@Injectable()
export class LlmKeysService {
  private readonly logger = new Logger(LlmKeysService.name);

  constructor(
    @Inject(LLM_API_KEY_REPOSITORY)
    private readonly repo: LLMApiKeyRepository,
    private readonly crypto: CryptoService,
    private readonly providers: LLMProviderFactory,
    private readonly eventBus: EventBus,
  ) {}

  list(userId: string): Promise<LLMApiKey[]> {
    return this.repo.listByUser(userId);
  }

  async upsert(
    userId: string,
    input: UpsertLlmKeyRequest,
  ): Promise<LLMApiKey> {
    // Verify first — we must never persist a key the provider has rejected.
    // `verify()` returns false on AuthError, true on QuotaError (key is valid
    // but quota-exhausted), and throws on any other upstream failure.
    let verified: boolean;
    try {
      verified = await this.providers.get(input.provider).verify(input.apiKey);
    } catch (err) {
      const mapped = mapProviderError(err);
      if (mapped instanceof AuthError) {
        throw new InvalidLlmApiKeyException("provider rejected the API key");
      }
      if (mapped instanceof QuotaError) {
        // Key is valid but rate-limited; treat as verified so the user isn't
        // blocked from saving a working key during a quota hiccup.
        verified = true;
      } else {
        this.logger.warn(
          `LLM verify threw for provider=${input.provider}: ${mapped.message}`,
        );
        throw new LlmProviderUnavailableException(
          "could not verify the API key with the provider",
        );
      }
    }

    if (!verified) {
      throw new InvalidLlmApiKeyException("provider rejected the API key");
    }

    const { ciphertext, iv, tag } = this.crypto.encryptParts(input.apiKey);
    const saved = await this.repo.upsertForUser({
      userId,
      provider: input.provider,
      keyEnc: ciphertext,
      keyIv: iv,
      keyTag: tag,
      status: "ok",
    });

    this.eventBus.publish(new LlmKeyUpsertedEvent(userId, input.provider));
    return saved;
  }

  async remove(
    userId: string,
    provider: UpsertLlmKeyRequest["provider"],
  ): Promise<void> {
    const removed = await this.repo.deleteByUserAndProvider(userId, provider);
    if (!removed) throw new NotFoundException("llm api key not found");
    this.eventBus.publish(new LlmKeyDeletedEvent(userId, provider));
  }
}
