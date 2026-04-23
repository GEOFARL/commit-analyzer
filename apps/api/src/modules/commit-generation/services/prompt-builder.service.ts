import type { ParsedDiff } from "@commit-analyzer/diff-parser";
import { Injectable } from "@nestjs/common";

import {
  DEFAULT_COUNT,
  PROMPT_CHAR_BUDGET,
} from "./prompt-builder.constants.js";
import {
  clampCount,
  renderSystemPrompt,
  renderUserPrompt,
  resolvePolicy,
} from "./prompt-builder.mappers.js";
import type {
  BuildPromptOptions,
  BuiltPrompt,
  PromptPolicy,
} from "./prompt-builder.types.js";

@Injectable()
export class PromptBuilderService {
  build(
    parsed: ParsedDiff,
    policy?: PromptPolicy,
    options?: BuildPromptOptions,
  ): BuiltPrompt {
    const count = clampCount(options?.count ?? DEFAULT_COUNT);
    const resolved = resolvePolicy(policy);
    const system = renderSystemPrompt(count, resolved);
    const user = renderUserPrompt(parsed);

    const totalLength = system.length + user.length;
    if (totalLength > PROMPT_CHAR_BUDGET) {
      throw new Error(
        `Prompt exceeds char budget: ${totalLength} > ${PROMPT_CHAR_BUDGET}`,
      );
    }

    return { system, user };
  }
}
