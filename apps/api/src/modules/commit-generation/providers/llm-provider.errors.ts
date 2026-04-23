import { APICallError, RetryError } from "ai";

class LLMProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
  }
}

export class AuthError extends LLMProviderError {}
export class QuotaError extends LLMProviderError {}
export class QuotaExhaustedError extends LLMProviderError {}
export class TimeoutError extends LLMProviderError {}
export class UpstreamError extends LLMProviderError {}

const INSUFFICIENT_QUOTA_CODE = "insufficient_quota";

// OpenAI returns 429 for both rate-limit and out-of-credit; only the body's
// `error.code` distinguishes them. Distinguishing matters: rate-limit is
// transient (let the user save the key), billing-exhausted is not.
const isInsufficientQuota = (error: APICallError): boolean => {
  const data = (error as { data?: unknown }).data;
  if (
    data &&
    typeof data === "object" &&
    "error" in data &&
    data.error &&
    typeof data.error === "object" &&
    "code" in data.error &&
    (data.error as { code?: unknown }).code === INSUFFICIENT_QUOTA_CODE
  ) {
    return true;
  }
  const body = error.responseBody;
  if (typeof body === "string" && body.includes(INSUFFICIENT_QUOTA_CODE)) {
    return true;
  }
  return false;
};

const isAbortLike = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  const cause = (error as { cause?: unknown }).cause;
  return isAbortLike(cause);
};

const pickUnderlying = (retry: RetryError): unknown => {
  if (retry.lastError !== undefined) return retry.lastError;
  const list = retry.errors;
  return list.length > 0 ? list[list.length - 1] : undefined;
};

export function mapProviderError(error: unknown): LLMProviderError {
  if (error instanceof LLMProviderError) return error;

  // The AI SDK retries transient failures and re-throws as `RetryError` with
  // the underlying errors attached. Classify the last attempt so callers see
  // the real cause, not an opaque wrapper.
  if (RetryError.isInstance(error)) {
    const underlying = pickUnderlying(error);
    if (underlying !== undefined && underlying !== error) {
      return mapProviderError(underlying);
    }
    return new UpstreamError(error.message, error);
  }

  if (isAbortLike(error)) {
    return new TimeoutError(
      error instanceof Error ? error.message : "request aborted",
      error,
    );
  }

  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    if (status === 401 || status === 403) {
      return new AuthError(error.message, error);
    }
    if (status === 429) {
      return isInsufficientQuota(error)
        ? new QuotaExhaustedError(error.message, error)
        : new QuotaError(error.message, error);
    }
    return new UpstreamError(error.message, error);
  }

  if (error instanceof Error) {
    return new UpstreamError(error.message, error);
  }
  return new UpstreamError("Unknown LLM provider error", error);
}
