import {
  renderParsedDiff,
  type ParsedDiff,
} from "@commit-analyzer/diff-parser";

import {
  DEFAULT_ALLOWED_SCOPES,
  DEFAULT_ALLOWED_TYPES,
  DEFAULT_MAX_SUBJECT_LENGTH,
  MAX_COUNT,
  MIN_COUNT,
} from "./prompt-builder.constants.js";
import type { PromptPolicy, ResolvedPolicy } from "./prompt-builder.types.js";

export function clampCount(count: number): number {
  if (!Number.isInteger(count) || count < MIN_COUNT) return MIN_COUNT;
  if (count > MAX_COUNT) return MAX_COUNT;
  return count;
}

export function resolvePolicy(
  policy: PromptPolicy | undefined,
): ResolvedPolicy {
  let allowedTypes = DEFAULT_ALLOWED_TYPES.join(",");
  let allowedScopes = DEFAULT_ALLOWED_SCOPES;
  let maxSubjectLength = DEFAULT_MAX_SUBJECT_LENGTH;
  const extraInstructions: string[] = [];

  if (!policy) {
    return { allowedTypes, allowedScopes, maxSubjectLength, extraInstructions };
  }

  for (const rule of policy.rules) {
    switch (rule.ruleType) {
      case "allowedTypes":
        allowedTypes = rule.ruleValue.join(",");
        break;
      case "allowedScopes":
        allowedScopes =
          rule.ruleValue.kind === "list"
            ? rule.ruleValue.values.join(",")
            : `matching /${rule.ruleValue.pattern}/`;
        break;
      case "maxSubjectLength":
        maxSubjectLength = rule.ruleValue;
        break;
      case "bodyRequired":
        if (rule.ruleValue) {
          extraInstructions.push(
            "A non-empty body is required for every suggestion.",
          );
        }
        break;
      case "footerRequired":
        if (rule.ruleValue) {
          extraInstructions.push(
            "A footer with a BREAKING CHANGE note or issue reference is required.",
          );
        }
        break;
    }
  }

  return { allowedTypes, allowedScopes, maxSubjectLength, extraInstructions };
}

export function renderSystemPrompt(
  count: number,
  policy: ResolvedPolicy,
): string {
  const extras =
    policy.extraInstructions.length > 0
      ? `\nAdditional policy constraints:\n${policy.extraInstructions
          .map((line) => `- ${line}`)
          .join("\n")}\n`
      : "";

  return [
    `You are an expert Git commit author. Produce ${count} distinct commit`,
    "messages for the diff below. Use the Conventional Commits format.",
    "Each message must:",
    `- match the header format \`<type>(<scope>)?: <subject>\` where subject ≤ ${policy.maxSubjectLength} chars, imperative mood, no trailing period`,
    "- include a body wrapped at 100 cols preceded by a blank line (optional unless required below)",
    "- include a footer with BREAKING CHANGE or issue references only when applicable",
    `- pick type from [${policy.allowedTypes}]`,
    `- pick scope from [${policy.allowedScopes}] (omit if N/A)`,
    extras,
    "Return suggestions as a JSON array of objects shaped like",
    '{ "type": string, "scope"?: string, "subject": string, "body"?: string, "footer"?: string }',
    "with no surrounding prose.",
  ].join("\n");
}

export function renderUserPrompt(parsed: ParsedDiff): string {
  const rendered = renderParsedDiff(parsed);
  const truncatedNote = parsed.truncated
    ? "\n\n(Diff was truncated to fit the token budget; summaries above remain authoritative.)"
    : "";
  return [
    `Files touched:\n${parsed.summary || "(none)"}`,
    "",
    "Diff:",
    rendered,
    truncatedNote,
  ]
    .join("\n")
    .replace(/\n+$/, "");
}
