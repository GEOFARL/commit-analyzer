import type { HistoryEntry } from "@commit-analyzer/contracts";
import {
  decodeGenerationHistoryCursor,
  encodeGenerationHistoryCursor,
  type GenerationHistory,
  type GenerationHistoryRepository,
  type Policy,
  type PolicyRepository,
  type Repository as RepoEntity,
  type RepositoryRepository,
} from "@commit-analyzer/database";
import type { SuggestionRecord } from "@commit-analyzer/shared-types";
import { Inject, Injectable } from "@nestjs/common";

import {
  GENERATION_HISTORY_REPOSITORY,
  POLICY_REPOSITORY,
  REPOSITORY_REPOSITORY,
} from "../../../common/database/tokens.js";
import { ValidatorService } from "../../../shared/policy-validation/validator.service.js";
import { toValidatorPolicy } from "../commands/generate-message.mappers.js";

import { uniqueIds } from "./generation-history.mappers.js";
import type {
  ListHistoryOptions,
  ListHistoryResult,
} from "./generation-history.types.js";
import { formatSuggestionAsCommitMessage } from "./suggestion-formatter.js";

@Injectable()
export class GenerationHistoryService {
  constructor(
    @Inject(GENERATION_HISTORY_REPOSITORY)
    private readonly history: GenerationHistoryRepository,
    @Inject(POLICY_REPOSITORY)
    private readonly policies: PolicyRepository,
    @Inject(REPOSITORY_REPOSITORY)
    private readonly repositories: RepositoryRepository,
    private readonly validator: ValidatorService,
  ) {}

  async list(options: ListHistoryOptions): Promise<ListHistoryResult> {
    const { userId, limit, cursor: rawCursor, repositoryId } = options;
    const cursor = rawCursor
      ? decodeGenerationHistoryCursor(rawCursor)
      : undefined;

    const rows = await this.history.listByUser({
      userId,
      limit: limit + 1,
      cursor,
      repositoryId,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && page.length > 0
        ? encodeGenerationHistoryCursor(page[page.length - 1]!)
        : null;

    const { repoMap, policyMap } = await this.hydrate(page);

    return {
      items: page.map((row) => this.toEntry(row, repoMap, policyMap)),
      nextCursor,
    };
  }

  async findById(userId: string, id: string): Promise<HistoryEntry | null> {
    const row = await this.history.findByIdForUser(id, userId);
    if (!row) return null;
    const { repoMap, policyMap } = await this.hydrate([row]);
    return this.toEntry(row, repoMap, policyMap);
  }

  private async hydrate(
    rows: readonly GenerationHistory[],
  ): Promise<{
    repoMap: Map<string, RepoEntity | null>;
    policyMap: Map<string, Policy | null>;
  }> {
    const repoIds = uniqueIds(rows.map((r) => r.repositoryId));
    const policyIds = uniqueIds(rows.map((r) => r.policyId));

    const [repoEntries, policyEntries] = await Promise.all([
      Promise.all(
        repoIds.map(async (id) =>
          [id, await this.repositories.findOneBy({ id })] as const,
        ),
      ),
      Promise.all(
        policyIds.map(async (id) =>
          [id, await this.policies.findWithRules(id)] as const,
        ),
      ),
    ]);

    return {
      repoMap: new Map<string, RepoEntity | null>(repoEntries),
      policyMap: new Map<string, Policy | null>(policyEntries),
    };
  }

  private toEntry(
    row: GenerationHistory,
    repoMap: Map<string, RepoEntity | null>,
    policyMap: Map<string, Policy | null>,
  ): HistoryEntry {
    const repo = row.repositoryId
      ? repoMap.get(row.repositoryId) ?? null
      : null;
    const policy = row.policyId ? policyMap.get(row.policyId) ?? null : null;
    const suggestions = row.suggestions.map((s) =>
      this.enrichSuggestion(s, policy),
    );

    return {
      id: row.id,
      provider: row.provider,
      model: row.model,
      status: row.status,
      tokensUsed: row.tokensUsed,
      suggestions,
      policyId: row.policyId,
      policyName: policy?.name ?? null,
      repositoryId: row.repositoryId,
      repositoryFullName: repo?.fullName ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private enrichSuggestion(
    record: SuggestionRecord,
    policy: Policy | null,
  ): HistoryEntry["suggestions"][number] {
    const validation = policy
      ? this.validator.validate(
          formatSuggestionAsCommitMessage(record),
          toValidatorPolicy(policy),
        )
      : null;
    return {
      type: record.type,
      scope: record.scope ?? null,
      subject: record.subject,
      body: record.body ?? null,
      footer: record.footer ?? null,
      compliant: validation ? validation.passed : record.compliant,
      validation,
    };
  }
}
