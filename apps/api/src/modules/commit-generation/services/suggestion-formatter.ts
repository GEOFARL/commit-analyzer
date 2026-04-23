import type { LlmSuggestion } from "../providers/suggestion.schema.js";

export const formatSuggestionAsCommitMessage = (
  suggestion: LlmSuggestion,
): string => {
  const scope = suggestion.scope?.trim();
  const header = scope
    ? `${suggestion.type}(${scope}): ${suggestion.subject}`
    : `${suggestion.type}: ${suggestion.subject}`;

  const body = suggestion.body?.trim();
  const footer = suggestion.footer?.trim();

  const parts = [header];
  if (body) parts.push("", body);
  if (footer) parts.push("", footer);

  return parts.join("\n");
};
