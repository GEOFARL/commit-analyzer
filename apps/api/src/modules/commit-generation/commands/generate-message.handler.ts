import type {
  GenerationHistoryRepository,
  Policy,
  PolicyRepository,
  PolicyRule,
  RepositoryRepository,
} from "@commit-analyzer/database";
import { renderParsedDiff, type ParsedDiff } from "@commit-analyzer/diff-parser";
import type {
  GenerationStatus,
  LlmProvider,
  SuggestionRecord,
} from "@commit-analyzer/shared-types";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { CommandHandler, EventBus, type ICommandHandler } from "@nestjs/cqrs";

import { getServerEnv } from "../../../common/config.js";
import {
  GENERATION_HISTORY_REPOSITORY,
  POLICY_REPOSITORY,
  REPOSITORY_REPOSITORY,
} from "../../../common/database/tokens.js";
import { GenerationCompletedEvent } from "../../../shared/events/generation-completed.event.js";
import { GenerationFailedEvent } from "../../../shared/events/generation-failed.event.js";
import { ValidatorService } from "../../../shared/policy-validation/validator.service.js";
import type { ValidatorPolicy } from "../../../shared/policy-validation/validator.service.types.js";
import { LLMProviderFactory } from "../providers/llm-provider.factory.js";
import type { LLMProvider } from "../providers/llm-provider.interface.js";
import type { LlmSuggestion } from "../providers/suggestion.schema.js";
import { hashDiff } from "../services/diff-hash.js";
import { DiffParserService } from "../services/diff-parser.service.js";
import { PromptBuilderService } from "../services/prompt-builder.service.js";
import type { PromptPolicy } from "../services/prompt-builder.types.js";
import { formatSuggestionAsCommitMessage } from "../services/suggestion-formatter.js";

import { GenerateMessageCommand } from "./generate-message.command.js";
import type {
  EnrichedSuggestion,
  GenerateMessageResult,
} from "./generate-message.result.js";

const REGEN_SYSTEM_SUFFIX = (failures: string[]): string =>
  [
    "",
    "Your previous suggestions failed these policy rules:",
    ...failures.map((line) => `- ${line}`),
    "Regenerate all suggestions so every one satisfies the rules above.",
  ].join("\n");

@Injectable()
@CommandHandler(GenerateMessageCommand)
export class GenerateMessageHandler
  implements ICommandHandler<GenerateMessageCommand, GenerateMessageResult>
{
  private readonly logger = new Logger(GenerateMessageHandler.name);

  constructor(
    private readonly diffParser: DiffParserService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly factory: LLMProviderFactory,
    private readonly validator: ValidatorService,
    private readonly eventBus: EventBus,
    @Inject(POLICY_REPOSITORY)
    private readonly policies: PolicyRepository,
    @Inject(REPOSITORY_REPOSITORY)
    private readonly repositories: RepositoryRepository,
    @Inject(GENERATION_HISTORY_REPOSITORY)
    private readonly history: GenerationHistoryRepository,
  ) {}

  async execute(
    command: GenerateMessageCommand,
  ): Promise<GenerateMessageResult> {
    const { userId, diff, provider, model, apiKey, options } = command;
    const parsed = this.diffParser.parse(diff);
    const diffHash = hashDiff(renderParsedDiff(parsed));
    const policy = await this.resolvePolicy(userId, options.policyId, options.repositoryId);
    const count = options.count ?? 3;

    try {
      const llm = this.factory.get(provider);
      const first = await this.runProvider({
        provider: llm,
        apiKey,
        model,
        parsed,
        policy,
        count,
        signal: options.signal,
      });

      let enriched = this.enrich(first.suggestions, policy);
      let tokensUsed = first.tokensUsed;
      let regenerated = false;

      if (policy && this.shouldRegenerate(enriched)) {
        const failures = this.collectFailures(enriched);
        const second = await this.runProvider({
          provider: llm,
          apiKey,
          model,
          parsed,
          policy,
          count,
          signal: options.signal,
          regenSuffix: REGEN_SYSTEM_SUFFIX(failures),
        });
        const reEnriched = this.enrich(second.suggestions, policy);
        if (this.compliantCount(reEnriched) > this.compliantCount(enriched)) {
          enriched = reEnriched;
        }
        tokensUsed += second.tokensUsed;
        regenerated = true;
      }

      const status: GenerationStatus = "completed";
      const historyId = await this.persist({
        userId,
        repositoryId: options.repositoryId,
        diffHash,
        provider,
        model,
        tokensUsed,
        status,
        suggestions: this.toRecords(enriched),
        policyId: policy?.id ?? null,
      });

      if (historyId) {
        this.eventBus.publish(
          new GenerationCompletedEvent(
            userId,
            historyId,
            provider,
            model,
            tokensUsed,
          ),
        );
      }

      return {
        historyId,
        status,
        suggestions: enriched,
        tokensUsed,
        regenerated,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.name : "unknown";
      const historyId = await this.persist({
        userId,
        repositoryId: options.repositoryId,
        diffHash,
        provider,
        model,
        tokensUsed: 0,
        status: "failed",
        suggestions: [],
        policyId: policy?.id ?? null,
      });
      if (historyId) {
        this.eventBus.publish(
          new GenerationFailedEvent(userId, historyId, reason),
        );
      }
      throw error;
    }
  }

  private async runProvider(args: {
    provider: LLMProvider;
    apiKey: string;
    model: string;
    parsed: ParsedDiff;
    policy: Policy | null;
    count: number;
    signal?: AbortSignal;
    regenSuffix?: string;
  }): Promise<{ suggestions: LlmSuggestion[]; tokensUsed: number }> {
    const promptPolicy = toPromptPolicy(args.policy);
    const prompt = this.promptBuilder.build(args.parsed, promptPolicy, {
      count: args.count,
    });
    const system = args.regenSuffix
      ? `${prompt.system}${args.regenSuffix}`
      : prompt.system;

    const suggestions: LlmSuggestion[] = [];
    let tokensUsed = 0;
    for await (const event of args.provider.generateSuggestions({
      apiKey: args.apiKey,
      model: args.model,
      prompt: { system, user: prompt.user },
      count: args.count,
      signal: args.signal,
    })) {
      if (event.kind === "suggestion") suggestions.push(event.value);
      else tokensUsed = event.tokensUsed;
    }
    return { suggestions, tokensUsed };
  }

  private enrich(
    suggestions: LlmSuggestion[],
    policy: Policy | null,
  ): EnrichedSuggestion[] {
    const validatorPolicy = policy
      ? toValidatorPolicy(policy)
      : null;
    return suggestions.map((s) => {
      const validation = validatorPolicy
        ? this.validator.validate(
            formatSuggestionAsCommitMessage(s),
            validatorPolicy,
          )
        : null;
      return {
        type: s.type,
        scope: s.scope ?? null,
        subject: s.subject,
        body: s.body ?? null,
        footer: s.footer ?? null,
        compliant: validation ? validation.passed : true,
        validation,
      };
    });
  }

  private toRecords(enriched: EnrichedSuggestion[]): SuggestionRecord[] {
    return enriched.map(({ validation: _v, ...record }) => record);
  }

  private async resolvePolicy(
    userId: string,
    policyId: string | undefined,
    repositoryId: string | undefined,
  ): Promise<Policy | null> {
    if (policyId) {
      const policy = await this.policies.findWithRules(policyId);
      if (!policy) return null;
      const owned = await this.repositories.findByIdForUser(
        policy.repositoryId,
        userId,
      );
      return owned ? policy : null;
    }
    if (repositoryId) {
      const owned = await this.repositories.findByIdForUser(
        repositoryId,
        userId,
      );
      if (!owned) return null;
      return this.policies.getActiveForRepo(repositoryId);
    }
    return null;
  }

  private shouldRegenerate(enriched: EnrichedSuggestion[]): boolean {
    const env = getServerEnv();
    if (!env.GENERATION_POLICY_REGEN_ENABLED) return false;
    return enriched.some((s) => !s.compliant);
  }

  private collectFailures(enriched: EnrichedSuggestion[]): string[] {
    const messages = new Set<string>();
    for (const s of enriched) {
      for (const r of s.validation?.results ?? []) {
        if (!r.passed) {
          messages.add(r.message ?? `rule ${r.ruleType} failed`);
        }
      }
    }
    return [...messages];
  }

  private compliantCount(enriched: EnrichedSuggestion[]): number {
    return enriched.filter((s) => s.compliant).length;
  }

  private async persist(input: {
    userId: string;
    repositoryId: string | undefined;
    diffHash: string;
    provider: LlmProvider;
    model: string;
    tokensUsed: number;
    status: GenerationStatus;
    suggestions: SuggestionRecord[];
    policyId: string | null;
  }): Promise<string | null> {
    try {
      const row = await this.history.createOne({
        userId: input.userId,
        repositoryId: input.repositoryId ?? null,
        diffHash: input.diffHash,
        provider: input.provider,
        model: input.model,
        tokensUsed: input.tokensUsed,
        status: input.status,
        suggestions: input.suggestions,
        policyId: input.policyId,
      });
      return row.id;
    } catch (error) {
      this.logger.warn(
        `generation history persistence failed: ${String(error)}`,
      );
      return null;
    }
  }
}

const toPromptPolicy = (policy: Policy | null): PromptPolicy | undefined => {
  if (!policy) return undefined;
  return {
    rules: policy.rules.map((rule: PolicyRule) => ({
      ruleType: rule.ruleType,
      ruleValue: rule.ruleValue,
    })) as PromptPolicy["rules"],
  };
};

const toValidatorPolicy = (policy: Policy): ValidatorPolicy => ({
  rules: policy.rules.map((rule) => ({
    ruleType: rule.ruleType,
    ruleValue: rule.ruleValue,
  })),
});
