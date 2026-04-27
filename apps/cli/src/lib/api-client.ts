import {
  contracts,
  doneFrameSchema,
  errorEnvelopeSchema,
  errorFrameSchema,
  suggestionFrameSchema,
  type ApiKey,
  type DoneFrame,
  type ErrorEnvelope,
  type ErrorFrame,
  type GenerateRequest,
  type PolicyDto,
  type SuggestionFrame,
  type User,
} from "@commit-analyzer/contracts";
import { initClient, tsRestFetchApi, type ApiFetcher, type ApiFetcherArgs } from "@ts-rest/core";
import { createParser } from "eventsource-parser";

import {
  AbortError,
  ApiResponseError,
  AuthError,
  NetworkError,
  ProtocolError,
  StreamError,
  TimeoutError,
} from "./api-errors.js";

const API_KEY_HEADER = "x-api-key";
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 30_000;

type FetchLike = typeof globalThis.fetch;

interface ApiClientConfig {
  apiUrl: string;
  apiKey: string;
  requestTimeoutMs?: number;
  streamIdleTimeoutMs?: number;
  fetch?: FetchLike;
}

export function createApiClient(cfg: ApiClientConfig) {
  const baseHeaders: Record<string, string> = { [API_KEY_HEADER]: cfg.apiKey };
  // `c.noBody()` unique-symbol from contracts' ts-rest install does not match the cli's; runtime shape is identical.
  return initClient(contracts as never, {
    baseUrl: stripTrailingSlash(cfg.apiUrl),
    baseHeaders,
    api: createTypedFetcher(cfg),
  });
}

type ApiClient = ReturnType<typeof createApiClient>;

interface RouteResponse {
  status: number;
  body: unknown;
  headers: Headers;
}

type CallArg = { fetchOptions?: { signal?: AbortSignal } };
type ListPoliciesArg = CallArg & { params: { repoId: string } };

interface ProxyShape {
  auth: {
    me: (args?: CallArg) => Promise<RouteResponse>;
    apiKeys: { list: (args?: CallArg) => Promise<RouteResponse> };
  };
  policies: { list: (args: ListPoliciesArg) => Promise<RouteResponse> };
}

const asTyped = (client: ApiClient): ProxyShape => client as unknown as ProxyShape;

interface CallOptions {
  signal?: AbortSignal;
}

export async function whoami(client: ApiClient, options: CallOptions = {}): Promise<User> {
  const res = await asTyped(client).auth.me({
    fetchOptions: options.signal ? { signal: options.signal } : {},
  });
  if (res.status === 200) return res.body as User;
  throwResponseError(res);
}

export async function listApiKeys(client: ApiClient, options: CallOptions = {}): Promise<ApiKey[]> {
  const res = await asTyped(client).auth.apiKeys.list({
    fetchOptions: options.signal ? { signal: options.signal } : {},
  });
  if (res.status === 200) return (res.body as { items: ApiKey[] }).items;
  throwResponseError(res);
}

export type { ApiClient };

export async function listPolicies(
  client: ApiClient,
  repoId: string,
  options: CallOptions = {},
): Promise<PolicyDto[]> {
  const res = await asTyped(client).policies.list({
    params: { repoId },
    fetchOptions: options.signal ? { signal: options.signal } : {},
  });
  if (res.status === 200) {
    return (res.body as { items: PolicyDto[] }).items;
  }
  throwResponseError(res);
}

function throwResponseError(res: RouteResponse): never {
  const envelope = ensureEnvelope(res.body);
  if (res.status === 401 || res.status === 403) {
    throw new AuthError(res.status, envelope);
  }
  throw new ApiResponseError(res.status, envelope);
}

function ensureEnvelope(body: unknown): ErrorEnvelope | null {
  const parsed = errorEnvelopeSchema.safeParse(body);
  return parsed.success ? parsed.data : null;
}

function createTypedFetcher(cfg: ApiClientConfig): ApiFetcher {
  const timeoutMs = cfg.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  return async (args: ApiFetcherArgs) => {
    const userSignal = args.fetchOptions?.signal ?? args.signal;
    const { signal, cleanup } = withTimeout(userSignal, timeoutMs);
    try {
      return await tsRestFetchApi({
        ...args,
        fetchOptions: { ...args.fetchOptions, signal },
        signal,
      });
    } catch (err) {
      throw translateFetchError(err, userSignal, timeoutMs);
    } finally {
      cleanup();
    }
  };
}

interface StreamGenerateOptions {
  signal?: AbortSignal;
  /** Stream idle timeout override. */
  streamIdleTimeoutMs?: number;
  onSuggestion?: (frame: SuggestionFrame) => void;
  onError?: (frame: ErrorFrame) => void;
}

interface StreamGenerateResult {
  done: DoneFrame;
  suggestions: SuggestionFrame[];
}

export async function streamGenerate(
  cfg: ApiClientConfig,
  body: GenerateRequest,
  options: StreamGenerateOptions = {},
): Promise<StreamGenerateResult> {
  const fetchImpl: FetchLike = cfg.fetch ?? globalThis.fetch;
  const url = `${stripTrailingSlash(cfg.apiUrl)}/generate`;
  const idleMs =
    options.streamIdleTimeoutMs ?? cfg.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;

  const idle = createIdleAbort(idleMs, options.signal);

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        [API_KEY_HEADER]: cfg.apiKey,
      },
      body: JSON.stringify(body),
      signal: idle.signal,
    });
  } catch (err) {
    idle.cleanup();
    throw translateStreamFetchError(err, options.signal, idle, idleMs);
  }

  if (!res.ok) {
    idle.cleanup();
    const text = await res.text().catch(() => "");
    const envelope = parseErrorEnvelope(text);
    if (res.status === 401 || res.status === 403) {
      throw new AuthError(res.status, envelope);
    }
    throw new ApiResponseError(res.status, envelope);
  }

  if (!res.body) {
    idle.cleanup();
    throw new ProtocolError("response has no body");
  }

  const suggestions: SuggestionFrame[] = [];
  const sink: { done: DoneFrame | null; error: ErrorFrame | null } = {
    done: null,
    error: null,
  };

  const parser = createParser({
    onEvent: (ev) => {
      if (!ev.event) return;
      const payload = safeParseJson(ev.data);
      if (payload === undefined) return;
      switch (ev.event) {
        case "suggestion": {
          const result = suggestionFrameSchema.safeParse(payload);
          if (!result.success) return;
          suggestions.push(result.data);
          options.onSuggestion?.(result.data);
          return;
        }
        case "done": {
          const result = doneFrameSchema.safeParse(payload);
          if (result.success) sink.done = result.data;
          return;
        }
        case "error": {
          const result = errorFrameSchema.safeParse(payload);
          if (result.success) {
            sink.error = result.data;
            options.onError?.(result.data);
          }
        }
      }
    },
  });

  const decoder = new TextDecoder("utf-8");
  const reader: ReadableStreamDefaultReader<Uint8Array> = res.body.getReader();

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      idle.refresh();
      parser.feed(decoder.decode(value, { stream: true }));
    }
  } catch (err) {
    await reader.cancel().catch(() => {});
    throw translateStreamFetchError(err, options.signal, idle, idleMs, true);
  } finally {
    idle.cleanup();
  }

  if (sink.error) {
    throw new StreamError(sink.error.message);
  }
  if (!sink.done) {
    throw new StreamError("connection closed before done frame");
  }
  return { done: sink.done, suggestions };
}

function withTimeout(
  external: AbortSignal | null | undefined,
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController();
  let cleared = false;
  const onExternalAbort = () => ctrl.abort(external?.reason);
  if (external) {
    if (external.aborted) ctrl.abort(external.reason);
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(new TimeoutError(timeoutMs)), timeoutMs);
  return {
    signal: ctrl.signal,
    cleanup: () => {
      if (cleared) return;
      cleared = true;
      clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

interface IdleAbort {
  signal: AbortSignal;
  refresh: () => void;
  cleanup: () => void;
  fired: () => boolean;
}

function createIdleAbort(idleMs: number, external: AbortSignal | null | undefined): IdleAbort {
  const ctrl = new AbortController();
  let timeoutFired = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const arm = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timeoutFired = true;
      ctrl.abort(new TimeoutError(idleMs));
    }, idleMs);
  };
  arm();

  const onExternalAbort = () => ctrl.abort(external?.reason);
  if (external) {
    if (external.aborted) ctrl.abort(external.reason);
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }

  let cleared = false;
  return {
    signal: ctrl.signal,
    refresh: arm,
    cleanup: () => {
      if (cleared) return;
      cleared = true;
      if (timer) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
    fired: () => timeoutFired,
  };
}

function translateFetchError(
  err: unknown,
  external: AbortSignal | null | undefined,
  timeoutMs: number,
): unknown {
  if (err instanceof TimeoutError) return err;
  if (external?.aborted) return new AbortError();
  if (isAbortDomError(err)) {
    const reason = (err as { cause?: unknown }).cause;
    if (reason instanceof TimeoutError) return reason;
    return new TimeoutError(timeoutMs);
  }
  if (err instanceof TypeError) {
    return new NetworkError(err.message, { cause: err });
  }
  return err;
}

function translateStreamFetchError(
  err: unknown,
  external: AbortSignal | null | undefined,
  idle: IdleAbort,
  idleMs: number,
  midStream = false,
): unknown {
  if (err instanceof TimeoutError) return err;
  if (external?.aborted) return new AbortError();
  if (idle.fired()) return new TimeoutError(idleMs);
  if (isAbortDomError(err)) {
    if (external?.aborted) return new AbortError();
    return new TimeoutError(idleMs);
  }
  if (midStream) {
    const message = err instanceof Error ? err.message : "stream error";
    return new StreamError(message, { cause: err });
  }
  if (err instanceof TypeError) {
    return new NetworkError(err.message, { cause: err });
  }
  return err;
}

function isAbortDomError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function parseErrorEnvelope(text: string): ReturnType<typeof errorEnvelopeSchema.parse> | null {
  if (!text) return null;
  const json = safeParseJson(text);
  if (json === undefined) return null;
  const parsed = errorEnvelopeSchema.safeParse(json);
  return parsed.success ? parsed.data : null;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
