import type { LanguageModel } from "ai";
import { generateText, streamObject } from "ai";

import {
  AuthError,
  mapProviderError,
  QuotaError,
  UpstreamError,
} from "./llm-provider.errors.js";
import type {
  GenerateArgs,
  LLMProvider,
  SuggestionEvent,
  VerifyOptions,
} from "./llm-provider.interface.js";
import { llmSuggestionSchema } from "./suggestion.schema.js";

export type ProviderClientFactory = (apiKey: string) => (
  modelId: string,
) => LanguageModel;

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: LLMProvider["name"];
  protected abstract readonly defaultVerifyModel: string;
  protected abstract readonly verifyTimeoutMs: number;
  protected abstract readonly clientFactory: ProviderClientFactory;

  async verify(apiKey: string, options?: VerifyOptions): Promise<boolean> {
    const modelId = options?.model ?? this.defaultVerifyModel;
    const signal =
      options?.signal ?? AbortSignal.timeout(this.verifyTimeoutMs);

    try {
      const client = this.clientFactory(apiKey);
      await generateText({
        model: client(modelId),
        prompt: "ping",
        abortSignal: signal,
      });
      return true;
    } catch (error) {
      const mapped = mapProviderError(error);
      if (mapped instanceof AuthError) return false;
      if (mapped instanceof QuotaError) return true;
      throw mapped;
    }
  }

  async *generateSuggestions(args: GenerateArgs): AsyncIterable<SuggestionEvent> {
    let result;
    try {
      const client = this.clientFactory(args.apiKey);
      result = streamObject({
        model: client(args.model),
        output: "array",
        schema: llmSuggestionSchema,
        system: args.prompt.system,
        prompt: args.prompt.user,
        abortSignal: args.signal,
      });
    } catch (error) {
      throw mapProviderError(error);
    }

    let index = 0;
    try {
      for await (const element of result.elementStream) {
        if (index >= args.count) break;
        yield { kind: "suggestion", index, value: element };
        index += 1;
      }
    } catch (error) {
      throw mapProviderError(error);
    }

    if (index === 0) {
      throw new UpstreamError("LLM produced no suggestions");
    }

    // Usage is telemetry — if it fails after suggestions were delivered, emit
    // the done event with tokensUsed=0 instead of discarding the stream.
    let tokensUsed = 0;
    try {
      const usage = await result.usage;
      tokensUsed = usage?.totalTokens ?? 0;
    } catch {
      tokensUsed = 0;
    }

    yield { kind: "done", tokensUsed };
  }
}
