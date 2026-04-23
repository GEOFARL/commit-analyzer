import "reflect-metadata";

import type {
  GenerationHistoryRepository,
  Policy,
  PolicyRepository,
  PolicyRule,
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

const USER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const REPO_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const POLICY_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

const DIFFS = {
  authGuard: [
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
  ].join("\n"),
  timeoutBump: [
    "diff --git a/src/api.ts b/src/api.ts",
    "index 3..4 100644",
    "--- a/src/api.ts",
    "+++ b/src/api.ts",
    "@@ -10,3 +10,3 @@",
    "-const TIMEOUT_MS = 1000;",
    "+const TIMEOUT_MS = 5000;",
    " export const fetchUser = () => fetchWithTimeout(TIMEOUT_MS);",
  ].join("\n"),
  docsTypo: [
    "diff --git a/README.md b/README.md",
    "index 5..6 100644",
    "--- a/README.md",
    "+++ b/README.md",
    "@@ -1,1 +1,1 @@",
    "-Rul the app with `pnpm dev`",
    "+Run the app with `pnpm dev`",
  ].join("\n"),
};

// 12 curated suggestions across 3 diffs. With maxSubjectLength=50 +
// allowedTypes=[feat,fix,docs], ≥80% (10 of 12) must pass. Two "noisy"
// entries intentionally fail (type=chore disallowed; subject >50 chars)
// to exercise the "some fail but ≥80% overall" acceptance criterion.
const FIXTURE_RESPONSES: Record<keyof typeof DIFFS, LlmSuggestion[]> = {
  authGuard: [
    { type: "feat", scope: "auth", subject: "reject login with empty user" },
    { type: "fix", scope: "auth", subject: "throw when user is missing" },
    { type: "feat", scope: "auth", subject: "guard login against empty input" },
    { type: "chore", scope: "auth", subject: "clean up login flow" },
  ],
  timeoutBump: [
    { type: "fix", scope: "api", subject: "bump fetchUser timeout to 5s" },
    { type: "feat", scope: "api", subject: "raise request timeout" },
    { type: "fix", scope: "api", subject: "increase TIMEOUT_MS to 5000" },
    {
      type: "feat",
      scope: "api",
      subject:
        "extend the timeout duration so that slow backends finish successfully",
    },
  ],
  docsTypo: [
    { type: "docs", subject: "fix typo in run command" },
    { type: "docs", subject: "correct spelling of Run" },
    { type: "docs", subject: "fix README typo" },
    { type: "fix", subject: "correct README wording" },
  ],
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

const buildProviderEvents = (key: keyof typeof DIFFS): SuggestionEvent[] => {
  const values = FIXTURE_RESPONSES[key];
  const events: SuggestionEvent[] = values.map((value, index) => ({
    kind: "suggestion",
    index,
    value,
  }));
  events.push({ kind: "done", tokensUsed: 50 });
  return events;
};

const mockProvider = (key: keyof typeof DIFFS): LLMProvider => ({
  name: "openai",
  verify: vi.fn().mockResolvedValue(true),
  generateSuggestions: (_args: GenerateArgs): AsyncIterable<SuggestionEvent> =>
    streamValues(buildProviderEvents(key)),
});

const policy: Policy = {
  id: POLICY_ID,
  repositoryId: REPO_ID,
  name: "conventional",
  isActive: true,
  createdAt: new Date(),
  rules: [
    {
      id: "r1",
      policyId: POLICY_ID,
      ruleType: "allowedTypes",
      ruleValue: ["feat", "fix", "docs"],
    } as PolicyRule,
    {
      id: "r2",
      policyId: POLICY_ID,
      ruleType: "maxSubjectLength",
      ruleValue: 50,
    } as PolicyRule,
  ],
} as unknown as Policy;

const mockHistoryRepo = () =>
  ({
    createOne: vi.fn().mockImplementation(() =>
      Promise.resolve({
        id: "hist",
        createdAt: new Date(),
      }),
    ),
  }) as unknown as GenerationHistoryRepository;

const mockPolicyRepo = () =>
  ({
    findWithRules: vi.fn().mockResolvedValue(policy),
    getActiveForRepo: vi.fn().mockResolvedValue(policy),
  }) as unknown as PolicyRepository;

const mockReposRepo = () =>
  ({
    findByIdForUser: vi
      .fn()
      .mockResolvedValue({ id: REPO_ID, userId: USER_ID }),
  }) as unknown as RepositoryRepository;

const build = (provider: LLMProvider) => {
  const factory = new LLMProviderFactory(
    provider as never,
    provider as never,
  );
  return new GenerateMessageHandler(
    new DiffParserService(),
    new PromptBuilderService(),
    factory,
    new ValidatorService(),
    { publish: vi.fn() } as never,
    mockPolicyRepo(),
    mockReposRepo(),
    mockHistoryRepo(),
  );
};

beforeEach(() => {
  getServerEnvMock.mockReturnValue({ GENERATION_POLICY_REGEN_ENABLED: false });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GenerateMessageHandler — fixture compliance", () => {
  it("achieves ≥80% policy-compliant suggestions across fixture diffs", async () => {
    let passing = 0;
    let total = 0;

    for (const key of Object.keys(DIFFS) as Array<keyof typeof DIFFS>) {
      const handler = build(mockProvider(key));
      const result = await handler.execute(
        new GenerateMessageCommand(
          USER_ID,
          DIFFS[key],
          "openai",
          "gpt-4o-mini",
          "sk-test",
          { repositoryId: REPO_ID, count: 4 },
        ),
      );
      passing += result.suggestions.filter((s) => s.compliant).length;
      total += result.suggestions.length;
    }

    expect(total).toBeGreaterThanOrEqual(9);
    const ratio = passing / total;
    expect(ratio).toBeGreaterThanOrEqual(0.8);
  });
});
