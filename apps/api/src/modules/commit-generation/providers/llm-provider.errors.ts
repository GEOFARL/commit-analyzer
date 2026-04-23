import { APICallError } from "ai";

class LLMProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
  }
}

export class AuthError extends LLMProviderError {}
export class QuotaError extends LLMProviderError {}
export class UpstreamError extends LLMProviderError {}

export function mapProviderError(error: unknown): LLMProviderError {
  if (error instanceof LLMProviderError) return error;

  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    if (status === 401 || status === 403) {
      return new AuthError(error.message, error);
    }
    if (status === 429) {
      return new QuotaError(error.message, error);
    }
    return new UpstreamError(error.message, error);
  }

  if (error instanceof Error) {
    return new UpstreamError(error.message, error);
  }
  return new UpstreamError("Unknown LLM provider error", error);
}
