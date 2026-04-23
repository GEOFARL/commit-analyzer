import { APICallError, RetryError } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  generateTextMock,
  streamObjectMock,
  createOpenAIMock,
  createAnthropicMock,
} = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  streamObjectMock: vi.fn(),
  createOpenAIMock: vi.fn(),
  createAnthropicMock: vi.fn(),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: generateTextMock,
    streamObject: streamObjectMock,
  };
});

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: createOpenAIMock,
}));

vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: createAnthropicMock,
}));

const { AnthropicProvider } = await import("./anthropic.provider.js");
const {
  AuthError,
  QuotaError,
  QuotaExhaustedError,
  TimeoutError,
  UpstreamError,
} = await import("./llm-provider.errors.js");
const { LLMProviderFactory } = await import("./llm-provider.factory.js");
const { OpenAIProvider } = await import("./openai.provider.js");

const buildPrompt = () => ({ system: "sys", user: "usr" });

const apiCallError = (
  statusCode: number,
  options: { data?: unknown; responseBody?: string } = {},
) =>
  new APICallError({
    message: `status ${statusCode}`,
    url: "https://example.test/v1",
    requestBodyValues: {},
    statusCode,
    data: options.data,
    responseBody: options.responseBody,
  });

const insufficientQuotaError = () =>
  apiCallError(429, {
    data: {
      error: {
        message: "You exceeded your current quota",
        type: "insufficient_quota",
        code: "insufficient_quota",
      },
    },
    responseBody: JSON.stringify({
      error: { type: "insufficient_quota", code: "insufficient_quota" },
    }),
  });

const fakeStream = <T>(values: T[]): AsyncIterable<T> => ({
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

const failingStream = (error: Error): AsyncIterable<never> => ({
  [Symbol.asyncIterator]() {
    return {
      next: () => Promise.reject(error),
    };
  },
});

const drain = async (iterable: AsyncIterable<unknown>) => {
  const out: unknown[] = [];
  for await (const event of iterable) out.push(event);
  return out;
};

beforeEach(() => {
  generateTextMock.mockReset();
  streamObjectMock.mockReset();
  createOpenAIMock.mockReset();
  createAnthropicMock.mockReset();

  const clientFn = (modelId: string) => ({ modelId });
  createOpenAIMock.mockReturnValue(clientFn);
  createAnthropicMock.mockReturnValue(clientFn);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("LLMProviderFactory", () => {
  it("returns the correct provider by name", () => {
    const openai = new OpenAIProvider();
    const anthropic = new AnthropicProvider();
    const factory = new LLMProviderFactory(openai, anthropic);

    expect(factory.get("openai")).toBe(openai);
    expect(factory.get("anthropic")).toBe(anthropic);
  });
});

describe.each([
  {
    label: "OpenAIProvider",
    create: () => new OpenAIProvider(),
    clientMock: createOpenAIMock,
    defaultModel: "gpt-4o-mini",
  },
  {
    label: "AnthropicProvider",
    create: () => new AnthropicProvider(),
    clientMock: createAnthropicMock,
    defaultModel: "claude-haiku-4-5",
  },
])("$label", ({ create, clientMock, defaultModel }) => {
  describe("verify()", () => {
    it("returns true when the probe succeeds", async () => {
      generateTextMock.mockResolvedValueOnce({ text: "pong" });
      const provider = create();

      await expect(provider.verify("sk-test")).resolves.toBe(true);

      expect(clientMock).toHaveBeenCalledWith({ apiKey: "sk-test" });
      const call = generateTextMock.mock.calls[0]![0] as {
        model: { modelId: string };
        prompt: string;
      };
      expect(call.model.modelId).toBe(defaultModel);
      expect(call.prompt).toBe("ping");
    });

    it("returns false when the upstream rejects with 401", async () => {
      generateTextMock.mockRejectedValueOnce(apiCallError(401));
      await expect(create().verify("sk-bad")).resolves.toBe(false);
    });

    it("returns true when the upstream rejects with 429 (rate limited)", async () => {
      generateTextMock.mockRejectedValueOnce(apiCallError(429));
      await expect(create().verify("sk-test")).resolves.toBe(true);
    });

    it("throws QuotaExhaustedError on 429 insufficient_quota (billing)", async () => {
      generateTextMock.mockRejectedValueOnce(insufficientQuotaError());
      await expect(create().verify("sk-test")).rejects.toBeInstanceOf(
        QuotaExhaustedError,
      );
    });

    it("throws QuotaExhaustedError when responseBody (no parsed data) indicates insufficient_quota", async () => {
      generateTextMock.mockRejectedValueOnce(
        apiCallError(429, {
          responseBody: '{"error":{"code":"insufficient_quota"}}',
        }),
      );
      await expect(create().verify("sk-test")).rejects.toBeInstanceOf(
        QuotaExhaustedError,
      );
    });

    // Anthropic returns 400 invalid_request_error (not 429) when the account
    // is out of credit. Without the dedicated branch this would surface as a
    // generic "could not verify" upstream error.
    it("throws QuotaExhaustedError on Anthropic-style 400 'credit balance is too low'", async () => {
      generateTextMock.mockRejectedValueOnce(
        apiCallError(400, {
          data: {
            error: {
              type: "invalid_request_error",
              message:
                "Your credit balance is too low to access the Anthropic API.",
            },
          },
        }),
      );
      await expect(create().verify("sk-test")).rejects.toBeInstanceOf(
        QuotaExhaustedError,
      );
    });

    it("throws QuotaExhaustedError when only responseBody carries the Anthropic low-credit message", async () => {
      generateTextMock.mockRejectedValueOnce(
        apiCallError(400, {
          responseBody:
            '{"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}',
        }),
      );
      await expect(create().verify("sk-test")).rejects.toBeInstanceOf(
        QuotaExhaustedError,
      );
    });

    it("unwraps a RetryError wrapping a 401 and returns false", async () => {
      const inner = apiCallError(401);
      generateTextMock.mockRejectedValueOnce(
        new RetryError({
          message: "retries exhausted",
          reason: "maxRetriesExceeded",
          errors: [inner],
        }),
      );
      await expect(create().verify("sk-bad")).resolves.toBe(false);
    });

    it("unwraps a RetryError wrapping 429 insufficient_quota", async () => {
      const inner = insufficientQuotaError();
      generateTextMock.mockRejectedValueOnce(
        new RetryError({
          message: "retries exhausted",
          reason: "errorNotRetryable",
          errors: [inner],
        }),
      );
      await expect(create().verify("sk-test")).rejects.toBeInstanceOf(
        QuotaExhaustedError,
      );
    });

    it("throws TimeoutError when the request is aborted", async () => {
      const abort = new Error("The operation was aborted");
      abort.name = "AbortError";
      generateTextMock.mockRejectedValueOnce(abort);
      await expect(create().verify("sk-test")).rejects.toBeInstanceOf(
        TimeoutError,
      );
    });

    it("disables SDK retries so the 10s timeout isn't split across attempts", async () => {
      generateTextMock.mockResolvedValueOnce({ text: "pong" });
      await create().verify("sk-test");
      const call = generateTextMock.mock.calls[0]![0] as {
        maxRetries?: number;
      };
      expect(call.maxRetries).toBe(0);
    });

    it("throws UpstreamError on a 500", async () => {
      generateTextMock.mockRejectedValueOnce(apiCallError(500));
      await expect(create().verify("sk-test")).rejects.toBeInstanceOf(
        UpstreamError,
      );
    });

    it("uses the caller-provided model and signal", async () => {
      generateTextMock.mockResolvedValueOnce({ text: "pong" });
      const controller = new AbortController();

      await create().verify("sk-test", {
        model: "custom-model",
        signal: controller.signal,
      });

      const call = generateTextMock.mock.calls[0]![0] as {
        model: { modelId: string };
        abortSignal: AbortSignal;
      };
      expect(call.model.modelId).toBe("custom-model");
      expect(call.abortSignal).toBe(controller.signal);
    });
  });

  describe("generateSuggestions()", () => {
    it("yields suggestion events then a done event with token usage", async () => {
      streamObjectMock.mockReturnValueOnce({
        elementStream: fakeStream([
          { type: "feat", subject: "first" },
          { type: "fix", subject: "second" },
          { type: "chore", subject: "third" },
        ]),
        usage: Promise.resolve({ totalTokens: 137 }),
      });

      const events = await drain(
        create().generateSuggestions({
          apiKey: "sk-test",
          model: "gpt-test",
          prompt: buildPrompt(),
          count: 3,
        }),
      );

      expect(events).toEqual([
        { kind: "suggestion", index: 0, value: { type: "feat", subject: "first" } },
        { kind: "suggestion", index: 1, value: { type: "fix", subject: "second" } },
        { kind: "suggestion", index: 2, value: { type: "chore", subject: "third" } },
        { kind: "done", tokensUsed: 137 },
      ]);

      const call = streamObjectMock.mock.calls[0]![0] as {
        model: { modelId: string };
        output: string;
        system: string;
        prompt: string;
      };
      expect(call.model.modelId).toBe("gpt-test");
      expect(call.output).toBe("array");
      expect(call.system).toBe("sys");
      expect(call.prompt).toBe("usr");
    });

    it("caps emitted suggestions at the requested count", async () => {
      streamObjectMock.mockReturnValueOnce({
        elementStream: fakeStream([
          { type: "feat", subject: "a" },
          { type: "feat", subject: "b" },
          { type: "feat", subject: "c" },
          { type: "feat", subject: "d" },
        ]),
        usage: Promise.resolve({ totalTokens: 10 }),
      });

      const events = await drain(
        create().generateSuggestions({
          apiKey: "sk-test",
          model: "gpt-test",
          prompt: buildPrompt(),
          count: 2,
        }),
      );

      const suggestions = events.filter(
        (event): event is { kind: "suggestion" } =>
          (event as { kind: string }).kind === "suggestion",
      );
      expect(suggestions).toHaveLength(2);
    });

    it("forwards the AbortSignal to streamObject", async () => {
      streamObjectMock.mockReturnValueOnce({
        elementStream: fakeStream([{ type: "feat", subject: "ok" }]),
        usage: Promise.resolve({ totalTokens: 1 }),
      });
      const controller = new AbortController();

      await drain(
        create().generateSuggestions({
          apiKey: "sk-test",
          model: "gpt-test",
          prompt: buildPrompt(),
          count: 1,
          signal: controller.signal,
        }),
      );

      const call = streamObjectMock.mock.calls[0]![0] as {
        abortSignal: AbortSignal;
      };
      expect(call.abortSignal).toBe(controller.signal);
    });

    it("maps a 401 stream failure to AuthError", async () => {
      streamObjectMock.mockReturnValueOnce({
        elementStream: failingStream(apiCallError(401)),
        usage: Promise.resolve({ totalTokens: 0 }),
      });

      await expect(
        drain(
          create().generateSuggestions({
            apiKey: "sk-test",
            model: "gpt-test",
            prompt: buildPrompt(),
            count: 1,
          }),
        ),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it("maps a 429 stream failure to QuotaError", async () => {
      streamObjectMock.mockReturnValueOnce({
        elementStream: failingStream(apiCallError(429)),
        usage: Promise.resolve({ totalTokens: 0 }),
      });

      await expect(
        drain(
          create().generateSuggestions({
            apiKey: "sk-test",
            model: "gpt-test",
            prompt: buildPrompt(),
            count: 1,
          }),
        ),
      ).rejects.toBeInstanceOf(QuotaError);
    });

    it("throws UpstreamError when no suggestions are produced", async () => {
      streamObjectMock.mockReturnValueOnce({
        elementStream: fakeStream<unknown>([]),
        usage: Promise.resolve({ totalTokens: 0 }),
      });

      await expect(
        drain(
          create().generateSuggestions({
            apiKey: "sk-test",
            model: "gpt-test",
            prompt: buildPrompt(),
            count: 3,
          }),
        ),
      ).rejects.toBeInstanceOf(UpstreamError);
    });

    it("still emits done with tokensUsed=0 when usage telemetry fails", async () => {
      streamObjectMock.mockReturnValueOnce({
        elementStream: fakeStream([{ type: "feat", subject: "ok" }]),
        usage: Promise.reject(new Error("usage unavailable")),
      });

      const events = await drain(
        create().generateSuggestions({
          apiKey: "sk-test",
          model: "gpt-test",
          prompt: buildPrompt(),
          count: 1,
        }),
      );

      expect(events).toEqual([
        { kind: "suggestion", index: 0, value: { type: "feat", subject: "ok" } },
        { kind: "done", tokensUsed: 0 },
      ]);
    });
  });
});
