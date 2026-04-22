import type {
  GenerationStatus,
  LlmProvider,
  SuggestionRecord,
} from "@commit-analyzer/shared-types";
import type { DataSource, Repository as OrmRepository } from "typeorm";

import { GenerationHistory } from "../entities/generation-history.entity.js";

export interface GenerationHistoryCursor {
  createdAt: string;
  id: string;
}

export interface GenerationHistoryListOptions {
  userId: string;
  limit: number;
  cursor?: GenerationHistoryCursor;
}

export interface CreateGenerationHistoryInput {
  userId: string;
  repositoryId?: string | null;
  diffHash: string;
  provider: LlmProvider;
  model: string;
  tokensUsed: number;
  status?: GenerationStatus;
  suggestions: SuggestionRecord[];
  policyId?: string | null;
}

export interface GenerationHistoryRepository
  extends OrmRepository<GenerationHistory> {
  listByUser(
    options: GenerationHistoryListOptions,
  ): Promise<GenerationHistory[]>;
  createOne(input: CreateGenerationHistoryInput): Promise<GenerationHistory>;
}

/**
 * Encodes a compound cursor as `<iso>|<id>` so pagination survives equal
 * `created_at` values (the primary-key tiebreaker makes pages deterministic).
 */
export const encodeGenerationHistoryCursor = (
  row: Pick<GenerationHistory, "createdAt" | "id">,
): string => `${row.createdAt.toISOString()}|${row.id}`;

export const decodeGenerationHistoryCursor = (
  raw: string,
): GenerationHistoryCursor => {
  const sep = raw.indexOf("|");
  if (sep <= 0 || sep === raw.length - 1) {
    throw new Error("invalid generation history cursor");
  }
  return { createdAt: raw.slice(0, sep), id: raw.slice(sep + 1) };
};

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
      const qb = base
        .createQueryBuilder("gh")
        .where("gh.user_id = :userId", { userId })
        .orderBy("gh.created_at", "DESC")
        .addOrderBy("gh.id", "DESC")
        .take(limit);

      if (cursor) {
        qb.andWhere("(gh.created_at, gh.id) < (:createdAt, :id)", {
          createdAt: cursor.createdAt,
          id: cursor.id,
        });
      }

      return qb.getMany();
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
          tokensUsed: input.tokensUsed,
          status: input.status ?? "pending",
          suggestions: input.suggestions,
          policyId: input.policyId ?? null,
        }),
      );
    },
  };
  return base.extend(extensions) as GenerationHistoryRepository;
};
