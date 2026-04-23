import type { DataSource, Repository as OrmRepository } from "typeorm";

import {
  LLMApiKey,
  type LLMApiKeyStatus,
  type LLMProvider,
} from "../entities/llm-api-key.entity.js";

export interface UpsertLLMApiKeyInput {
  userId: string;
  provider: LLMProvider;
  keyEnc: Buffer;
  keyIv: Buffer;
  keyTag: Buffer;
  status: LLMApiKeyStatus;
}

export interface LLMApiKeyRepository extends OrmRepository<LLMApiKey> {
  listByUser(userId: string): Promise<LLMApiKey[]>;
  findByUserAndProvider(
    userId: string,
    provider: LLMProvider,
  ): Promise<LLMApiKey | null>;
  upsertForUser(input: UpsertLLMApiKeyInput): Promise<LLMApiKey>;
  deleteByUserAndProvider(
    userId: string,
    provider: LLMProvider,
  ): Promise<boolean>;
}

export const createLLMApiKeyRepository = (
  dataSource: DataSource,
): LLMApiKeyRepository => {
  const base = dataSource.getRepository(LLMApiKey);

  const extensions: Pick<
    LLMApiKeyRepository,
    "listByUser" | "findByUserAndProvider" | "upsertForUser" | "deleteByUserAndProvider"
  > = {
    listByUser(userId: string): Promise<LLMApiKey[]> {
      return base.find({
        where: { userId },
        order: { createdAt: "DESC" },
      });
    },
    findByUserAndProvider(
      userId: string,
      provider: LLMProvider,
    ): Promise<LLMApiKey | null> {
      return base.findOne({ where: { userId, provider } });
    },
    async upsertForUser(input: UpsertLLMApiKeyInput): Promise<LLMApiKey> {
      // Unique constraint is (user_id, provider). An explicit findOne → update
      // keeps the ciphertext+iv+tag triplet consistent (TypeORM's `upsert`
      // method would require listing every encryption column in
      // `conflictPaths`, and the update path must not forget any of them).
      const existing = await base.findOne({
        where: { userId: input.userId, provider: input.provider },
      });

      if (existing) {
        existing.keyEnc = input.keyEnc;
        existing.keyIv = input.keyIv;
        existing.keyTag = input.keyTag;
        existing.status = input.status;
        return base.save(existing);
      }

      return base.save(
        base.create({
          userId: input.userId,
          provider: input.provider,
          keyEnc: input.keyEnc,
          keyIv: input.keyIv,
          keyTag: input.keyTag,
          status: input.status,
        }),
      );
    },
    async deleteByUserAndProvider(
      userId: string,
      provider: LLMProvider,
    ): Promise<boolean> {
      const result = await base.delete({ userId, provider });
      return (result.affected ?? 0) > 0;
    },
  };

  return base.extend(extensions) as LLMApiKeyRepository;
};
