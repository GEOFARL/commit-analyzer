import { createAnthropic } from "@ai-sdk/anthropic";
import { Injectable } from "@nestjs/common";

import {
  BaseLLMProvider,
  type ProviderClientFactory,
} from "./base-llm.provider.js";
import {
  DEFAULT_VERIFY_MODEL,
  VERIFY_TIMEOUT_MS,
} from "./llm-provider.constants.js";

@Injectable()
export class AnthropicProvider extends BaseLLMProvider {
  readonly name = "anthropic" as const;
  protected readonly defaultVerifyModel = DEFAULT_VERIFY_MODEL.anthropic;
  protected readonly verifyTimeoutMs = VERIFY_TIMEOUT_MS;
  protected readonly clientFactory: ProviderClientFactory = (apiKey) =>
    createAnthropic({ apiKey });
}
