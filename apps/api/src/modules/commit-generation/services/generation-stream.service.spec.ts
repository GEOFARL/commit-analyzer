import "reflect-metadata";

import type {
  GenerationHistoryRepository,
  PolicyRepository,
  RepositoryRepository,
} from "@commit-analyzer/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ValidatorService } from "../../../shared/policy-validation/validator.service.js";
import { QuotaError } from "../providers/llm-provider.errors.js";
import { LLMProviderFactory } from "../providers/llm-provider.factory.js";
import type {
  GenerateArgs,
  LLMProvider,
  SuggestionEvent,
} from "../providers/llm-provider.interface.js";
import type { LlmSuggestion } from "../providers/suggestion.schema.js";

import { DiffParserService } from "./diff-parser.service.js";
import { PromptBuilderService } from "./prompt-builder.service.js";

const getServerEnvMock = vi.hoisted(() => vi.fn());
vi.mock("../../../common/config.js", () => ({
  getServerEnv: getServerEnvMock,
}));

const { GenerationStreamService } = await import(
  "./generation-stream.service.js"
);

const USER_ID = "11111111-1111-1111-1111-111111111111";
const HISTORY_ID = "44444444-4444-4444-4444-444444444444";

const SAMPLE_DIFF = [
  "diff --git a/src/auth.ts b/src/auth.ts",
  "index 1..2 100644",
  "--- a/src/auth.ts",
  "+++ b/src/auth.ts",
  "@@ -1,3 +1,4 @@",
  " export function login(user: string) {",
  "-  return true;",
  "+  if (!user) throw new Error('user required');",
  "+  return true;",
  " }",
].join("\n");

type ProviderMockConfig = {
  suggestions: LlmSuggestion[];
  tokensUsed?: number;
  throwOn?: "immediate" | "after-first";
  error?: Error;
  signalOnSuggestion?: AbortController;
};

const streamEventsFor = (cfg: ProviderMockConfig): AsyncIterable<SuggestionEvent> => {
  const events: SuggestionEvent[] = cfg.suggestions.map((value, index) => ({
    kind: "suggestion" as const,
    index,
    value,
  }));
  events.push({ kind: "done", tokensUsed: cfg.tokensUsed ?? 42 });
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next() {
          if (cfg.throwOn === "immediate") {
            return Promise.reject(cfg.error ?? new Error("boom"));
          }
          if (cfg.throwOn === "after-first" && i === 1) {
            return Promise.reject(cfg.error ?? new Error("mid-stream boom"));
          }
          if (i >= events.length) {
            return Promise.resolve({
              value: undefined as unknown as SuggestionEvent,
              done: true as const,
            });
          }
          const value = events[i++]!;
          if (
            cfg.signalOnSuggestion &&
            value.kind === "suggestion" &&
            value.index === 0
          ) {
            cfg.signalOnSuggestion.abort();
          }
          return Promise.resolve({ value, done: false as const });
        },
      };
    },
  };
};

const mockProvider = (cfg: ProviderMockConfig): LLMProvider => ({
  name: "openai",
  verify: vi.fn().mockResolvedValue(true),
  generateSuggestions: (_args: GenerateArgs) => streamEventsFor(cfg),
});

const mockHistoryRepo = () => {
  const createOne = vi.fn().mockImplementation((input: unknown) =>
    Promise.resolve({
      id: HISTORY_ID,
      ...(input as object),
      createdAt: new Date(),
    }),
  );
  return { createOne } as unknown as GenerationHistoryRepository;
};

const mockPolicyRepo = () =>
  ({
    findWithRules: vi.fn().mockResolvedValue(null),
    getActiveForRepo: vi.fn().mockResolvedValue(null),
  }) as unknown as PolicyRepository;

const mockReposRepo = () =>
  ({
    findByIdForUser: vi.fn().mockResolvedValue(null),
  }) as unknown as RepositoryRepository;

const build = (provider: LLMProvider, history = mockHistoryRepo()) => {
  const factory = new LLMProviderFactory(
    provider as never,
    provider as never,
  );
  const eventBus = { publish: vi.fn() };
  const service = new GenerationStreamService(
    new DiffParserService(),
    new PromptBuilderService(),
    factory,
    new ValidatorService(),
    eventBus as never,
    mockPolicyRepo(),
    mockReposRepo(),
    history,
  );
  return { service, eventBus, history };
};

beforeEach(() => {
  getServerEnvMock.mockReturnValue({ GENERATION_POLICY_REGEN_ENABLED: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GenerationStreamService", () => {
  it("yields suggestion, done events and emits generation.completed", async () => {
    const provider = mockProvider({
      suggestions: [
        { type: "feat", subject: "add user validation" },
        { type: "fix", subject: "throw on missing user" },
        { type: "refactor", subject: "guard empty input" },
      ],
      tokensUsed: 321,
    });
    const { service, eventBus, history } = build(provider);

    const events: string[] = [];
    let donePayload: { historyId: string | null; tokensUsed: number } | null =
      null;
    for await (const ev of service.stream({
      userId: USER_ID,
      diff: SAMPLE_DIFF,
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "sk-test",
    })) {
      events.push(ev.kind);
      if (ev.kind === "done") donePayload = ev.data;
    }

    expect(events).toEqual(["suggestion", "suggestion", "suggestion", "done"]);
    expect(donePayload).toMatchObject({
      historyId: HISTORY_ID,
      tokensUsed: 321,
    });
    const createArgs = (history.createOne as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(createArgs.status).toBe("completed");
    expect(createArgs.tokensUsed).toBe(321);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it("emits error frame and generation.failed when provider throws", async () => {
    const provider = mockProvider({
      suggestions: [],
      throwOn: "immediate",
      error: new QuotaError("rate limited"),
    });
    const { service, eventBus, history } = build(provider);

    const events: Array<{ kind: string; data: Record<string, unknown> }> = [];
    for await (const ev of service.stream({
      userId: USER_ID,
      diff: SAMPLE_DIFF,
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "sk-test",
    })) {
      events.push(ev as never);
    }

    expect(events).toEqual([
      { kind: "error", data: { code: "LLM_RATE_LIMIT", message: "rate limited" } },
    ]);
    const createArgs = (history.createOne as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(createArgs.status).toBe("failed");
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const event = (eventBus.publish.mock.calls[0]![0] as { reason: string });
    expect(event.reason).toBe("LLM_RATE_LIMIT");
  });

  it("persists cancelled row and emits no events when abort fires mid-stream", async () => {
    const controller = new AbortController();
    const provider = mockProvider({
      suggestions: [
        { type: "feat", subject: "first suggestion" },
        { type: "fix", subject: "second suggestion" },
      ],
      throwOn: "after-first",
      error: Object.assign(new Error("aborted"), { name: "AbortError" }),
      signalOnSuggestion: controller,
    });
    const { service, eventBus, history } = build(provider);

    const events: string[] = [];
    for await (const ev of service.stream({
      userId: USER_ID,
      diff: SAMPLE_DIFF,
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "sk-test",
      options: { signal: controller.signal },
    })) {
      events.push(ev.kind);
    }

    expect(events).toEqual(["suggestion"]);
    const createArgs = (history.createOne as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(createArgs.status).toBe("cancelled");
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("starts yielding the first suggestion quickly (TTFT < 2s)", async () => {
    const provider = mockProvider({
      suggestions: [{ type: "feat", subject: "add guard" }],
    });
    const { service } = build(provider);
    const t0 = Date.now();
    const iter = service.stream({
      userId: USER_ID,
      diff: SAMPLE_DIFF,
      provider: "openai",
      model: "gpt-4o-mini",
      apiKey: "sk-test",
    });
    const first = await iter.next();
    const ttft = Date.now() - t0;
    expect(first.value).toMatchObject({ kind: "suggestion" });
    expect(ttft).toBeLessThan(2000);
    // Drain the rest so no pending promise leaks.
    for await (const _ of iter) void _;
  });
});
