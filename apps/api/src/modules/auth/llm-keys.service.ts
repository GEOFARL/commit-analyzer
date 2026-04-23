import type { LlmProviderName } from "@commit-analyzer/contracts";
import type { LLMApiKey, LLMApiKeyRepository } from "@commit-analyzer/database";
import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import { LLM_API_KEY_REPOSITORY } from "../../common/database/tokens.js";
import { CryptoService } from "../../shared/crypto.service.js";
import {
  mapProviderError,
  QuotaExhaustedError,
  TimeoutError,
} from "../commit-generation/providers/llm-provider.errors.js";
import { LLMProviderFactory } from "../commit-generation/providers/llm-provider.factory.js";

import { LlmKeyDeletedEvent } from "./events/llm-key-deleted.event.js";
import { LlmKeyUpsertedEvent } from "./events/llm-key-upserted.event.js";
import {
  InvalidLlmApiKeyException,
  LlmProviderQuotaExhaustedException,
  LlmProviderTimeoutException,
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
    provider: LlmProviderName,
    key: string,
  ): Promise<LLMApiKey> {
    // `BaseLLMProvider.verify()` collapses outcomes into:
    //   AuthError → false ("provider rejected the API key"),
    //   QuotaError (plain 429 rate-limit) → true (transient; allow save),
    //   QuotaExhaustedError / TimeoutError / UpstreamError → thrown.
    // The thrown errors are translated below into distinct 422 codes so the UI
    // can show actionable messages instead of a generic "unavailable".
    let verified: boolean;
    try {
      verified = await this.providers.get(provider).verify(key);
    } catch (err) {
      const mapped = mapProviderError(err);
      this.logger.warn(
        `LLM verify threw for provider=${provider}: ${mapped.name}: ${mapped.message}`,
      );
      if (mapped instanceof QuotaExhaustedError) {
        throw new LlmProviderQuotaExhaustedException(
          `${provider} account has no remaining quota — add billing credit and try again`,
        );
      }
      if (mapped instanceof TimeoutError) {
        throw new LlmProviderTimeoutException(
          `timed out contacting ${provider}; please retry`,
        );
      }
      throw new LlmProviderUnavailableException(
        "could not verify the API key with the provider",
      );
    }

    if (!verified) {
      throw new InvalidLlmApiKeyException("provider rejected the API key");
    }

    const { ciphertext, iv, tag } = this.crypto.encryptParts(key);
    const saved = await this.repo.upsertForUser({
      userId,
      provider,
      keyEnc: ciphertext,
      keyIv: iv,
      keyTag: tag,
      status: "ok",
    });

    this.eventBus.publish(new LlmKeyUpsertedEvent(userId, provider));
    return saved;
  }

  async remove(userId: string, provider: LlmProviderName): Promise<void> {
    const removed = await this.repo.deleteByUserAndProvider(userId, provider);
    if (!removed) throw new NotFoundException("llm api key not found");
    this.eventBus.publish(new LlmKeyDeletedEvent(userId, provider));
  }
}
