import { HttpException, HttpStatus } from "@nestjs/common";

// ts-rest's error envelope is `{ error: { code, message } }`. 422 is the
// documented status for verification failures (see llm-keys.contract).
export class InvalidLlmApiKeyException extends HttpException {
  constructor(reason: string) {
    super(
      { error: { code: "invalid_llm_api_key", message: reason } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class LlmProviderUnavailableException extends HttpException {
  constructor(reason: string) {
    super(
      { error: { code: "llm_provider_unavailable", message: reason } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

// OpenAI's `insufficient_quota` (billing exhausted) arrives as HTTP 429 but is
// a permanent state, not a retry-me. Distinct code so the UI can direct the
// user to their billing page instead of telling them to retry.
export class LlmProviderQuotaExhaustedException extends HttpException {
  constructor(reason: string) {
    super(
      { error: { code: "provider_quota_exhausted", message: reason } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class LlmProviderTimeoutException extends HttpException {
  constructor(reason: string) {
    super(
      { error: { code: "provider_timeout", message: reason } },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
