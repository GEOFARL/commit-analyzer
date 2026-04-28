import type { HistoryEntry } from "@commit-analyzer/contracts";
import {
  decodeGenerationHistoryCursor,
  encodeGenerationHistoryCursor,
  type GenerationHistory,
  type Policy,
  type PolicyRepository,
  type GenerationHistoryRepository,
  type Repository as RepoEntity,
  type RepositoryRepository,
} from "@commit-analyzer/database";
import type { SuggestionRecord } from "@commit-analyzer/shared-types";
import { Inject, Injectable } from "@nestjs/common";

import {
  GENERATION_HISTORY_REPOSITORY,
  POLICY_REPOSITORY,
  REPOSITORY_REPOSITORY,
} from "../../common/database/tokens.js";
import { ValidatorService } from "../../shared/policy-validation/validator.service.js";

import {
  formatSuggestionAsCommitMessage,
  toValidatorPolicy,
} from "./history.mappers.js";
import type { ListHistoryOptions, ListHistoryResult } from "./history.types.js";

@Injectable()
export class HistoryService {
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
    const { userId, limit, cursor: rawCursor } = options;
    const cursor = rawCursor
      ? decodeGenerationHistoryCursor(rawCursor)
      : undefined;

    const rows = await this.history.listByUser({
      userId,
      limit: limit + 1,
      cursor,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor =
      hasMore && page.length > 0
        ? encodeGenerationHistoryCursor(page[page.length - 1]!)
        : null;

    const repoIds = unique(page.map((r) => r.repositoryId).filter(isString));
    const policyIds = unique(page.map((r) => r.policyId).filter(isString));

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

    const repoMap = new Map<string, RepoEntity | null>(repoEntries);
    const policyMap = new Map<string, Policy | null>(policyEntries);

    return {
      items: page.map((row) => this.toEntry(row, repoMap, policyMap)),
      nextCursor,
    };
  }

  private toEntry(
    row: GenerationHistory,
    repoMap: Map<string, RepoEntity | null>,
    policyMap: Map<string, Policy | null>,
  ): HistoryEntry {
    const repo = row.repositoryId ? repoMap.get(row.repositoryId) ?? null : null;
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

const unique = <T>(values: readonly T[]): T[] => Array.from(new Set(values));
const isString = (value: unknown): value is string => typeof value === "string";
