import { createOpenAI } from "@ai-sdk/openai";
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
export class OpenAIProvider extends BaseLLMProvider {
  readonly name = "openai" as const;
  protected readonly defaultVerifyModel = DEFAULT_VERIFY_MODEL.openai;
  protected readonly verifyTimeoutMs = VERIFY_TIMEOUT_MS;
  protected readonly clientFactory: ProviderClientFactory = (apiKey) =>
    createOpenAI({ apiKey });
}
