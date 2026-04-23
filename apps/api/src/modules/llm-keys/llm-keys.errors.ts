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
