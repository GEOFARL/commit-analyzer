import "reflect-metadata";

import type {
  GenerationHistoryRepository,
  Policy,
  PolicyRepository,
  RepositoryRepository,
} from "@commit-analyzer/database";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ValidatorService } from "../../../shared/policy-validation/validator.service.js";
import { LLMProviderFactory } from "../providers/llm-provider.factory.js";
import type {
  GenerateArgs,
  LLMProvider,
  SuggestionEvent,
} from "../providers/llm-provider.interface.js";
import type { LlmSuggestion } from "../providers/suggestion.schema.js";
import { DiffParserService } from "../services/diff-parser.service.js";
import { PromptBuilderService } from "../services/prompt-builder.service.js";

const getServerEnvMock = vi.hoisted(() => vi.fn());
vi.mock("../../../common/config.js", () => ({
  getServerEnv: getServerEnvMock,
}));

const { GenerateMessageCommand } = await import("./generate-message.command.js");
const { GenerateMessageHandler } = await import("./generate-message.handler.js");

const USER_ID = "11111111-1111-1111-1111-111111111111";
const REPO_ID = "22222222-2222-2222-2222-222222222222";
const POLICY_ID = "33333333-3333-3333-3333-333333333333";
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
  suggestions: LlmSuggestion[][];
  tokensUsed?: number;
};

const streamValues = <T>(values: T[]): AsyncIterable<T> => ({
  [Symbol.asyncIterator]() {
    let i = 0;
    return {
      next: () =>
        Promise.resolve(
          i < values.length
            ? { value: values[i++] as T, done: false }
            : { value: undefined as unknown as T, done: true },
        ),
    };
  },
});

const buildEventsFor = (
  suggestions: LlmSuggestion[],
  tokensUsed: number,
): SuggestionEvent[] => {
  const events: SuggestionEvent[] = suggestions.map((value, index) => ({
    kind: "suggestion",
    index,
    value,
  }));
  events.push({ kind: "done", tokensUsed });
  return events;
};

const mockProvider = (cfg: ProviderMockConfig): LLMProvider => {
  const queue = [...cfg.suggestions];
  const tokens = cfg.tokensUsed ?? 42;
  return {
    name: "openai",
    verify: vi.fn().mockResolvedValue(true),
    generateSuggestions: (_args: GenerateArgs): AsyncIterable<SuggestionEvent> =>
      streamValues(buildEventsFor(queue.shift() ?? [], tokens)),
  };
};

const mockHistoryRepo = (overrides: Partial<GenerationHistoryRepository> = {}) => {
  const createOne = vi.fn().mockImplementation((input: unknown) =>
    Promise.resolve({
      id: HISTORY_ID,
      ...(input as object),
      createdAt: new Date(),
    }),
  );
  return {
    createOne,
    ...overrides,
  } as unknown as GenerationHistoryRepository;
};

const mockPolicyRepo = (policy: Policy | null) => {
  return {
    findWithRules: vi.fn().mockResolvedValue(policy),
    getActiveForRepo: vi.fn().mockResolvedValue(policy),
  } as unknown as PolicyRepository;
};

const mockReposRepo = (owned: boolean) => {
  return {
    findByIdForUser: vi
      .fn()
      .mockResolvedValue(owned ? { id: REPO_ID, userId: USER_ID } : null),
  } as unknown as RepositoryRepository;
};

const policyFixture = (): Policy =>
  ({
    id: POLICY_ID,
    repositoryId: REPO_ID,
    name: "strict",
    isActive: true,
    createdAt: new Date(),
    rules: [
      { id: "r1", policyId: POLICY_ID, ruleType: "allowedTypes", ruleValue: ["feat", "fix"] },
      { id: "r2", policyId: POLICY_ID, ruleType: "maxSubjectLength", ruleValue: 50 },
    ],
  }) as unknown as Policy;

const build = (args: {
  provider: LLMProvider;
  history?: GenerationHistoryRepository;
  policies?: PolicyRepository;
  repos?: RepositoryRepository;
}) => {
  const factory = new LLMProviderFactory(
    args.provider as never,
    args.provider as never,
  );
  const eventBus = { publish: vi.fn() };
  const handler = new GenerateMessageHandler(
    new DiffParserService(),
    new PromptBuilderService(),
    factory,
    new ValidatorService(),
    eventBus as never,
    args.policies ?? mockPolicyRepo(null),
    args.repos ?? mockReposRepo(false),
    args.history ?? mockHistoryRepo(),
  );
  return { handler, eventBus };
};

beforeEach(() => {
  getServerEnvMock.mockReturnValue({ GENERATION_POLICY_REGEN_ENABLED: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GenerateMessageHandler", () => {
  it("streams suggestions, persists history, emits completed event", async () => {
    const provider = mockProvider({
      suggestions: [
        [
          { type: "feat", subject: "add user validation to login" },
          { type: "fix", subject: "throw on missing user" },
          { type: "refactor", subject: "guard empty user input" },
        ],
      ],
      tokensUsed: 321,
    });
    const history = mockHistoryRepo();
    const { handler, eventBus } = build({ provider, history });

    const result = await handler.execute(
      new GenerateMessageCommand(
        USER_ID,
        SAMPLE_DIFF,
        "openai",
        "gpt-4o-mini",
        "sk-test",
      ),
    );

    expect(result.historyId).toBe(HISTORY_ID);
    expect(result.status).toBe("completed");
    expect(result.suggestions).toHaveLength(3);
    expect(result.tokensUsed).toBe(321);
    expect(result.regenerated).toBe(false);

    const createArgs = (history.createOne as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(createArgs.status).toBe("completed");
    expect(createArgs.tokensUsed).toBe(321);
    expect(createArgs.policyId).toBeNull();
    expect(String(createArgs.diffHash)).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it("never persists raw diff contents — only the hash", async () => {
    const provider = mockProvider({
      suggestions: [[{ type: "feat", subject: "add validation" }]],
    });
    const history = mockHistoryRepo();
    const { handler } = build({ provider, history });

    await handler.execute(
      new GenerateMessageCommand(
        USER_ID,
        SAMPLE_DIFF,
        "openai",
        "gpt-4o-mini",
        "sk-test",
      ),
    );

    const createArgs = (history.createOne as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Record<string, unknown>;
    const serialized = JSON.stringify(createArgs);
    expect(serialized).not.toContain("export function login");
    expect(serialized).not.toContain("user required");
    expect(serialized).not.toContain("diff --git");
  });

  it("annotates suggestions with policy validation when an active policy exists", async () => {
    const provider = mockProvider({
      suggestions: [
        [
          { type: "feat", subject: "add login guard" },
          {
            type: "chore",
            subject:
              "rewrite the whole thing extensively with more detail to explain",
          },
          { type: "fix", subject: "throw on missing user" },
        ],
      ],
    });
    const { handler } = build({
      provider,
      policies: mockPolicyRepo(policyFixture()),
      repos: mockReposRepo(true),
    });

    const result = await handler.execute(
      new GenerateMessageCommand(
        USER_ID,
        SAMPLE_DIFF,
        "openai",
        "gpt-4o-mini",
        "sk-test",
        { repositoryId: REPO_ID },
      ),
    );

    expect(result.suggestions.map((s) => s.compliant)).toEqual([
      true,
      false,
      true,
    ]);
    expect(result.suggestions[1]!.validation?.passed).toBe(false);
  });

  it("regenerates when flag on and better set replaces non-compliant one", async () => {
    getServerEnvMock.mockReturnValue({ GENERATION_POLICY_REGEN_ENABLED: true });
    const provider = mockProvider({
      suggestions: [
        [
          { type: "chore", subject: "short" },
          { type: "wip", subject: "messing around" },
        ],
        [
          { type: "feat", subject: "add auth guard" },
          { type: "fix", subject: "throw on empty user" },
        ],
      ],
      tokensUsed: 100,
    });
    const { handler } = build({
      provider,
      policies: mockPolicyRepo(policyFixture()),
      repos: mockReposRepo(true),
    });

    const result = await handler.execute(
      new GenerateMessageCommand(
        USER_ID,
        SAMPLE_DIFF,
        "openai",
        "gpt-4o-mini",
        "sk-test",
        { repositoryId: REPO_ID, count: 2 },
      ),
    );

    expect(result.regenerated).toBe(true);
    expect(result.suggestions.every((s) => s.compliant)).toBe(true);
    expect(result.tokensUsed).toBe(200);
  });

  it("does not regenerate when the flag is off, even with failing suggestions", async () => {
    const provider = mockProvider({
      suggestions: [
        [
          { type: "chore", subject: "short" },
          { type: "wip", subject: "messing around" },
        ],
      ],
    });
    const { handler } = build({
      provider,
      policies: mockPolicyRepo(policyFixture()),
      repos: mockReposRepo(true),
    });

    const result = await handler.execute(
      new GenerateMessageCommand(
        USER_ID,
        SAMPLE_DIFF,
        "openai",
        "gpt-4o-mini",
        "sk-test",
        { repositoryId: REPO_ID, count: 2 },
      ),
    );

    expect(result.regenerated).toBe(false);
    expect(result.suggestions.every((s) => s.compliant)).toBe(false);
  });

  it("returns result with historyId=null when persistence fails (best-effort)", async () => {
    const provider = mockProvider({
      suggestions: [[{ type: "feat", subject: "add guard" }]],
    });
    const history = mockHistoryRepo({
      createOne: vi.fn().mockRejectedValue(new Error("db down")),
    });
    const { handler, eventBus } = build({ provider, history });

    const result = await handler.execute(
      new GenerateMessageCommand(
        USER_ID,
        SAMPLE_DIFF,
        "openai",
        "gpt-4o-mini",
        "sk-test",
      ),
    );

    expect(result.historyId).toBeNull();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("records a failed history row and emits generation.failed when provider throws", async () => {
    const err = new Error("upstream down");
    const throwingStream: AsyncIterable<SuggestionEvent> = {
      [Symbol.asyncIterator]: () => ({ next: () => Promise.reject(err) }),
    };
    const provider: LLMProvider = {
      name: "openai",
      verify: vi.fn(),
      generateSuggestions: vi.fn(() => throwingStream),
    };
    const history = mockHistoryRepo();
    const { handler, eventBus } = build({ provider, history });

    await expect(
      handler.execute(
        new GenerateMessageCommand(
          USER_ID,
          SAMPLE_DIFF,
          "openai",
          "gpt-4o-mini",
          "sk-test",
        ),
      ),
    ).rejects.toBe(err);

    const createArgs = (history.createOne as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as Record<string, unknown>;
    expect(createArgs.status).toBe("failed");
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it("skips policy lookup when the user does not own the repository", async () => {
    const provider = mockProvider({
      suggestions: [[{ type: "chore", subject: "short" }]],
    });
    const policies = mockPolicyRepo(policyFixture());
    const { handler } = build({
      provider,
      policies,
      repos: mockReposRepo(false),
    });

    const result = await handler.execute(
      new GenerateMessageCommand(
        USER_ID,
        SAMPLE_DIFF,
        "openai",
        "gpt-4o-mini",
        "sk-test",
        { repositoryId: REPO_ID },
      ),
    );

    const activeSpy = (policies as unknown as {
      getActiveForRepo: ReturnType<typeof vi.fn>;
    }).getActiveForRepo;
    expect(activeSpy).not.toHaveBeenCalled();
    expect(result.suggestions[0]!.compliant).toBe(true);
  });
});
