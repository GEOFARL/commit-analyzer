import type { LLMApiKeyRepository } from "@commit-analyzer/database";
import type { LlmProvider } from "@commit-analyzer/shared-types";
import { Inject, Injectable } from "@nestjs/common";

import { LLM_API_KEY_REPOSITORY } from "../../../common/database/tokens.js";
import { CryptoService } from "../../../shared/crypto.service.js";

@Injectable()
export class LlmKeyService {
  constructor(
    @Inject(LLM_API_KEY_REPOSITORY)
    private readonly repo: LLMApiKeyRepository,
    @Inject(CryptoService)
    private readonly crypto: CryptoService,
  ) {}

  async getDecrypted(
    userId: string,
    provider: LlmProvider,
  ): Promise<string | null> {
    const row = await this.repo.findByUserAndProvider(userId, provider);
    if (!row) return null;
    return this.crypto.decryptParts({
      ciphertext: row.keyEnc,
      iv: row.keyIv,
      tag: row.keyTag,
    });
  }
}
