interface SuggestionLike {
  type: string;
  scope?: string | null;
  subject: string;
}

export const formatSuggestionHeader = (suggestion: SuggestionLike): string => {
  const scope = suggestion.scope?.trim();
  return scope
    ? `${suggestion.type}(${scope}): ${suggestion.subject}`
    : `${suggestion.type}: ${suggestion.subject}`;
};
