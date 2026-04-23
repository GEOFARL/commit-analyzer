import type { SuggestionFrame } from "@commit-analyzer/contracts";

// Mirrors api/src/.../suggestion-formatter.ts. Kept client-side so the copy
// button doesn't need a round trip and can stay responsive even after the
// stream is done.
export const formatAsCommitMessage = (s: SuggestionFrame): string => {
  const scope = s.scope ? `(${s.scope})` : "";
  const header = `${s.type}${scope}: ${s.subject}`;
  const parts = [header];
  if (s.body) parts.push("", s.body);
  if (s.footer) parts.push("", s.footer);
  return parts.join("\n");
};
