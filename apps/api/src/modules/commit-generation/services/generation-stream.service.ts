import type {
  GenerationHistoryRepository,
  Policy,
  PolicyRepository,
  RepositoryRepository,
} from "@commit-analyzer/database";
import { renderParsedDiff } from "@commit-analyzer/diff-parser";
import type {
  GenerationStatus,
  LlmProvider,
  SuggestionRecord,
} from "@commit-analyzer/shared-types";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import {
  GENERATION_HISTORY_REPOSITORY,
  POLICY_REPOSITORY,
  REPOSITORY_REPOSITORY,
} from "../../../common/database/tokens.js";
import { GenerationCompletedEvent } from "../../../shared/events/generation-completed.event.js";
import { GenerationFailedEvent } from "../../../shared/events/generation-failed.event.js";
import { ValidatorService } from "../../../shared/policy-validation/validator.service.js";
import { PolicyAccessDeniedError } from "../commands/generate-message.errors.js";
import {
  classifyGenerationError,
  toPromptPolicy,
  toValidatorPolicy,
} from "../commands/generate-message.mappers.js";
import { LLMProviderFactory } from "../providers/llm-provider.factory.js";
import type { LlmSuggestion } from "../providers/suggestion.schema.js";

import { hashDiff } from "./diff-hash.js";
import { DiffParserService } from "./diff-parser.service.js";
import type {
  StreamEvent,
  StreamInput,
  SuggestionFramePayload,
} from "./generation-stream.types.js";
import { PromptBuilderService } from "./prompt-builder.service.js";
import { formatSuggestionAsCommitMessage } from "./suggestion-formatter.js";

@Injectable()
export class GenerationStreamService {
  private readonly logger = new Logger(GenerationStreamService.name);

  constructor(
    @Inject(DiffParserService)
    private readonly diffParser: DiffParserService,
    @Inject(PromptBuilderService)
    private readonly promptBuilder: PromptBuilderService,
    @Inject(LLMProviderFactory)
    private readonly factory: LLMProviderFactory,
    @Inject(ValidatorService)
    private readonly validator: ValidatorService,
    @Inject(EventBus)
    private readonly eventBus: EventBus,
    @Inject(POLICY_REPOSITORY)
    private readonly policies: PolicyRepository,
    @Inject(REPOSITORY_REPOSITORY)
    private readonly repositories: RepositoryRepository,
    @Inject(GENERATION_HISTORY_REPOSITORY)
    private readonly history: GenerationHistoryRepository,
  ) {}

  async *stream(input: StreamInput): AsyncGenerator<StreamEvent> {
    const { userId, diff, provider, model, apiKey, options } = input;
    const count = options?.count ?? 3;
    const signal = options?.signal;

    let parsed;
    try {
      parsed = this.diffParser.parse(diff);
    } catch (err) {
      const message = err instanceof Error ? err.message : "diff parse failed";
      yield { kind: "error", data: { code: "DIFF_PARSE_FAILED", message } };
      return;
    }
    const diffHash = hashDiff(renderParsedDiff(parsed));

    let policy: Policy | null;
    try {
      policy = await this.resolvePolicy(
        userId,
        options?.policyId,
        options?.repositoryId,
      );
    } catch (err) {
      if (err instanceof PolicyAccessDeniedError) {
        yield {
          kind: "error",
          data: { code: "POLICY_ACCESS_DENIED", message: err.message },
        };
        return;
      }
      throw err;
    }

    const validatorPolicy = policy ? toValidatorPolicy(policy) : null;
    const prompt = this.promptBuilder.build(parsed, toPromptPolicy(policy), {
      count,
    });
    const llm = this.factory.get(provider);

    const collected: SuggestionRecord[] = [];
    let tokensUsed = 0;
    let aborted = false;

    try {
      for await (const ev of llm.generateSuggestions({
        apiKey,
        model,
        prompt,
        count,
        signal,
      })) {
        if (ev.kind === "suggestion") {
          const frame = this.enrich(ev.index, ev.value, validatorPolicy);
          collected.push({
            type: frame.type,
            scope: frame.scope,
            subject: frame.subject,
            body: frame.body,
            footer: frame.footer,
            compliant: frame.compliant,
          });
          yield { kind: "suggestion", data: frame };
        } else {
          tokensUsed = ev.tokensUsed;
        }
      }
    } catch (err) {
      if (signal?.aborted) {
        aborted = true;
      } else {
        const code = classifyGenerationError(err);
        const message = err instanceof Error ? err.message : "generation failed";
        const historyId = await this.persist({
          userId,
          repositoryId: options?.repositoryId,
          diffHash,
          provider,
          model,
          tokensUsed,
          status: "failed",
          suggestions: collected,
          policyId: policy?.id ?? null,
        });
        if (historyId) {
          this.eventBus.publish(
            new GenerationFailedEvent(userId, historyId, code),
          );
        }
        yield { kind: "error", data: { code, message } };
        return;
      }
    }

    if (signal?.aborted || aborted) {
      await this.persist({
        userId,
        repositoryId: options?.repositoryId,
        diffHash,
        provider,
        model,
        tokensUsed,
        status: "cancelled",
        suggestions: collected,
        policyId: policy?.id ?? null,
      });
      return;
    }

    const historyId = await this.persist({
      userId,
      repositoryId: options?.repositoryId,
      diffHash,
      provider,
      model,
      tokensUsed,
      status: "completed",
      suggestions: collected,
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
    yield { kind: "done", data: { historyId, tokensUsed } };
  }

  private enrich(
    index: number,
    suggestion: LlmSuggestion,
    validatorPolicy: ReturnType<typeof toValidatorPolicy> | null,
  ): SuggestionFramePayload {
    const validation = validatorPolicy
      ? this.validator.validate(
          formatSuggestionAsCommitMessage(suggestion),
          validatorPolicy,
        )
      : null;
    return {
      index,
      type: suggestion.type,
      scope: suggestion.scope ?? null,
      subject: suggestion.subject,
      body: suggestion.body ?? null,
      footer: suggestion.footer ?? null,
      compliant: validation ? validation.passed : true,
      validation: validation
        ? {
            passed: validation.passed,
            results: validation.results.map((r) => ({
              ruleType: r.ruleType,
              passed: r.passed,
              ...(r.message !== undefined ? { message: r.message } : {}),
            })),
          }
        : null,
    };
  }

  private async resolvePolicy(
    userId: string,
    policyId: string | undefined,
    repositoryId: string | undefined,
  ): Promise<Policy | null> {
    if (policyId) {
      const policy = await this.policies.findWithRules(policyId);
      if (!policy) throw new PolicyAccessDeniedError();
      const owned = await this.repositories.findByIdForUser(
        policy.repositoryId,
        userId,
      );
      if (!owned) throw new PolicyAccessDeniedError();
      return policy;
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
    } catch (err) {
      this.logger.warn(
        `generation history persistence failed: ${String(err)}`,
      );
      return null;
    }
  }
}
