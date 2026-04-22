import { LessThan, type DataSource, type Repository as OrmRepository } from "typeorm";

import { GenerationHistory } from "../entities/generation-history.entity.js";

export interface GenerationHistoryListOptions {
  userId: string;
  limit: number;
  cursor?: string;
}

export interface CreateGenerationHistoryInput {
  userId: string;
  repositoryId?: string | null;
  diffHash: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  suggestions: unknown;
  policyId?: string | null;
}

export interface GenerationHistoryRepository
  extends OrmRepository<GenerationHistory> {
  listByUser(
    options: GenerationHistoryListOptions,
  ): Promise<GenerationHistory[]>;
  createOne(input: CreateGenerationHistoryInput): Promise<GenerationHistory>;
}

export const createGenerationHistoryRepository = (
  dataSource: DataSource,
): GenerationHistoryRepository => {
  const base = dataSource.getRepository(GenerationHistory);
  const extensions: Pick<
    GenerationHistoryRepository,
    "listByUser" | "createOne"
  > = {
    async listByUser(
      options: GenerationHistoryListOptions,
    ): Promise<GenerationHistory[]> {
      const { userId, limit, cursor } = options;
      const where: Record<string, unknown> = { userId };
      if (cursor) {
        where.createdAt = LessThan(new Date(cursor));
      }
      return base.find({
        where,
        order: { createdAt: "DESC" },
        take: limit,
      });
    },
    async createOne(
      input: CreateGenerationHistoryInput,
    ): Promise<GenerationHistory> {
      return base.save(
        base.create({
          userId: input.userId,
          repositoryId: input.repositoryId ?? null,
          diffHash: input.diffHash,
          provider: input.provider,
          model: input.model,
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          suggestions: input.suggestions,
          policyId: input.policyId ?? null,
        }),
      );
    },
  };
  return base.extend(extensions) as GenerationHistoryRepository;
};
