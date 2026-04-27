import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createApiClient,
  listApiKeys,
  listPolicies,
  streamGenerate,
  whoami,
} from "./api-client.js";
import {
  AbortError,
  ApiResponseError,
  AuthError,
  NetworkError,
  StreamError,
  TimeoutError,
} from "./api-errors.js";

type FetchFn = typeof globalThis.fetch;

const VALID_DIFF = [
  "diff --git a/a.ts b/a.ts",
  "index 1..2 100644",
  "--- a/a.ts",
  "+++ b/a.ts",
  "@@ -1 +1 @@",
  "-a",
  "+b",
  "",
].join("\n");

const REQUEST = {
  diff: VALID_DIFF,
  provider: "openai" as const,
  model: "gpt-4o-mini",
};

const SUGGESTION_PAYLOAD = {
  index: 0,
  type: "feat",
  scope: null,
  subject: "add a",
  body: null,
  footer: null,
  compliant: true,
  validation: null,
};

const DONE_PAYLOAD = { historyId: null, tokensUsed: 42 };

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

interface StreamHandle {
  response: Response;
  close: () => void;
  error: (err: Error) => void;
}

function makeStreamResponse(chunks: string[]): StreamHandle {
  let close!: () => void;
  let error!: (err: Error) => void;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      close = () => controller.close();
      error = (err: Error) => controller.error(err);
    },
  });
  const response = new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
  return { response, close, error };
}

function makeJsonErrorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function userResponse(): Response {
  return new Response(
    JSON.stringify({
      id: "00000000-0000-0000-0000-000000000000",
      email: null,
      name: null,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

type FetchInput = Parameters<FetchFn>[0];
type FetchInit = Parameters<FetchFn>[1];
type FetchImpl = (input: FetchInput, init: FetchInit) => Promise<Response> | Response;

function fakeFetch(impl: FetchImpl): FetchFn {
  return vi.fn((input: FetchInput, init: FetchInit) => Promise.resolve(impl(input, init)));
}

function inputUrl(input: FetchInput): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return (input as { url: string }).url;
}

function pendingFetchUntilAbort(): FetchFn {
  return fakeFetch(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      }),
  );
}

describe("createApiClient", () => {
  let originalFetch: FetchFn;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("returns a ts-rest client that whoami can drive", async () => {
    let captured: { url: string; headers: Headers } | null = null;
    globalThis.fetch = fakeFetch((input, init) => {
      captured = { url: inputUrl(input), headers: new Headers(init?.headers) };
      return userResponse();
    });
    const client = createApiClient({
      apiUrl: "https://example.test",
      apiKey: "git_secret",
    });
    const user = await whoami(client);
    expect(user.id).toBe("00000000-0000-0000-0000-000000000000");
    expect(captured!.url).toContain("/me");
    expect(captured!.headers.get("x-api-key")).toBe("git_secret");
  });

  it("listApiKeys hits /api-keys and unwraps items", async () => {
    let url: string | null = null;
    let headers: Headers | null = null;
    const apiKey = {
      id: "00000000-0000-0000-0000-000000000001",
      name: "laptop",
      prefix: "git_abcd",
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
    };
    globalThis.fetch = fakeFetch((input, init) => {
      url = inputUrl(input);
      headers = new Headers(init?.headers);
      return new Response(JSON.stringify({ items: [apiKey] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = createApiClient({ apiUrl: "https://example.test", apiKey: "git_x" });
    const items = await listApiKeys(client);
    expect(items).toEqual([apiKey]);
    expect(url).toContain("/api-keys");
    expect(headers!.get("x-api-key")).toBe("git_x");
  });

  it("listPolicies hits the /repos/:repoId/policies route", async () => {
    let url: string | null = null;
    globalThis.fetch = fakeFetch((input) => {
      url = inputUrl(input);
      return new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    const client = createApiClient({
      apiUrl: "https://example.test",
      apiKey: "git_x",
    });
    const items = await listPolicies(client, "11111111-1111-1111-1111-111111111111");
    expect(items).toEqual([]);
    expect(url).toContain("/repos/11111111-1111-1111-1111-111111111111/policies");
  });

  it("translates fetch TypeError into NetworkError", async () => {
    globalThis.fetch = fakeFetch(() => {
      throw new TypeError("connect ECONNREFUSED");
    });
    const client = createApiClient({
      apiUrl: "https://example.test",
      apiKey: "git_x",
    });
    await expect(whoami(client)).rejects.toBeInstanceOf(NetworkError);
  });

  it("translates request timeout into TimeoutError", async () => {
    globalThis.fetch = pendingFetchUntilAbort();
    const client = createApiClient({
      apiUrl: "https://example.test",
      apiKey: "git_x",
      requestTimeoutMs: 25,
    });
    await expect(whoami(client)).rejects.toBeInstanceOf(TimeoutError);
  });

  it("translates external abort into AbortError", async () => {
    globalThis.fetch = pendingFetchUntilAbort();
    const ctrl = new AbortController();
    const client = createApiClient({
      apiUrl: "https://example.test",
      apiKey: "git_x",
    });
    const promise = whoami(client, { signal: ctrl.signal });
    ctrl.abort();
    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("maps 401 on /me to AuthError", async () => {
    globalThis.fetch = fakeFetch(
      () =>
        new Response(JSON.stringify({ error: { code: "UNAUTHORIZED", message: "no key" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = createApiClient({
      apiUrl: "https://example.test",
      apiKey: "git_bad",
    });
    const err = await whoami(client).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).status).toBe(401);
  });

  it("maps non-2xx on /policies to ApiResponseError", async () => {
    globalThis.fetch = fakeFetch(
      () =>
        new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "no repo" } }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    );
    const client = createApiClient({
      apiUrl: "https://example.test",
      apiKey: "git_x",
    });
    const err = await listPolicies(client, "22222222-2222-2222-2222-222222222222").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiResponseError);
    expect((err as ApiResponseError).status).toBe(404);
  });
});

describe("streamGenerate", () => {
  let originalFetch: FetchFn;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("parses suggestion and done frames", async () => {
    const onSuggestion = vi.fn();
    globalThis.fetch = fakeFetch(() => {
      const fresh = makeStreamResponse([
        ": ping\n\n",
        sseFrame("suggestion", SUGGESTION_PAYLOAD),
        sseFrame("done", DONE_PAYLOAD),
      ]);
      fresh.close();
      return fresh.response;
    });

    const result = await streamGenerate(
      { apiUrl: "https://example.test", apiKey: "git_x" },
      REQUEST,
      { onSuggestion },
    );
    expect(result.done).toEqual(DONE_PAYLOAD);
    expect(result.suggestions).toHaveLength(1);
    expect(onSuggestion).toHaveBeenCalledOnce();
  });

  it("sends x-api-key + accept: text/event-stream", async () => {
    let url: string | null = null;
    let headers: Headers | null = null;
    globalThis.fetch = fakeFetch((input, init) => {
      url = inputUrl(input);
      headers = new Headers(init?.headers);
      const fresh = makeStreamResponse([sseFrame("done", DONE_PAYLOAD)]);
      fresh.close();
      return fresh.response;
    });

    await streamGenerate({ apiUrl: "https://example.test/", apiKey: "git_secret" }, REQUEST);
    expect(url).toBe("https://example.test/generate");
    expect(headers!.get("x-api-key")).toBe("git_secret");
    expect(headers!.get("accept")).toBe("text/event-stream");
  });

  it("surfaces error frames as StreamError", async () => {
    globalThis.fetch = fakeFetch(() => {
      const fresh = makeStreamResponse([
        sseFrame("error", { code: "LLM_RATE_LIMITED", message: "slow down" }),
      ]);
      fresh.close();
      return fresh.response;
    });

    await expect(
      streamGenerate({ apiUrl: "https://example.test", apiKey: "git_x" }, REQUEST),
    ).rejects.toMatchObject({
      name: "StreamError",
      code: "STREAM",
      message: "slow down",
    });
  });

  it("throws StreamError when the connection closes before done", async () => {
    globalThis.fetch = fakeFetch(() => {
      const fresh = makeStreamResponse([sseFrame("suggestion", SUGGESTION_PAYLOAD)]);
      fresh.close();
      return fresh.response;
    });

    await expect(
      streamGenerate({ apiUrl: "https://example.test", apiKey: "git_x" }, REQUEST),
    ).rejects.toBeInstanceOf(StreamError);
  });

  it("throws StreamError when the stream errors mid-flight", async () => {
    globalThis.fetch = fakeFetch(() => {
      const fresh = makeStreamResponse([sseFrame("suggestion", SUGGESTION_PAYLOAD)]);
      queueMicrotask(() => fresh.error(new Error("ECONNRESET")));
      return fresh.response;
    });

    const err = await streamGenerate(
      { apiUrl: "https://example.test", apiKey: "git_x" },
      REQUEST,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(StreamError);
  });

  it("maps 401 to AuthError with envelope details", async () => {
    globalThis.fetch = fakeFetch(() =>
      makeJsonErrorResponse(401, "INVALID_API_KEY", "key not recognized"),
    );

    const err = await streamGenerate(
      { apiUrl: "https://example.test", apiKey: "git_bad" },
      REQUEST,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthError);
    const auth = err as AuthError;
    expect(auth.status).toBe(401);
    expect(auth.envelope?.error.code).toBe("INVALID_API_KEY");
  });

  it("maps non-401 error responses to ApiResponseError", async () => {
    globalThis.fetch = fakeFetch(() => makeJsonErrorResponse(500, "INTERNAL", "boom"));

    const err = await streamGenerate(
      { apiUrl: "https://example.test", apiKey: "git_x" },
      REQUEST,
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiResponseError);
    expect((err as ApiResponseError).status).toBe(500);
  });

  it("translates external abort to AbortError", async () => {
    globalThis.fetch = pendingFetchUntilAbort();

    const ctrl = new AbortController();
    const promise = streamGenerate({ apiUrl: "https://example.test", apiKey: "git_x" }, REQUEST, {
      signal: ctrl.signal,
    });
    ctrl.abort();
    await expect(promise).rejects.toBeInstanceOf(AbortError);
  });

  it("translates idle stream timeout to TimeoutError", async () => {
    vi.useFakeTimers();
    globalThis.fetch = pendingFetchUntilAbort();

    const settled = streamGenerate({ apiUrl: "https://example.test", apiKey: "git_x" }, REQUEST, {
      streamIdleTimeoutMs: 10,
    }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(20);
    const err = await settled;
    expect(err).toBeInstanceOf(TimeoutError);
  });
});
