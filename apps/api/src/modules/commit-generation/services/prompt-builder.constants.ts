export const DEFAULT_COUNT = 3;
export const MIN_COUNT = 1;
export const MAX_COUNT = 5;

export const DEFAULT_MAX_SUBJECT_LENGTH = 72;

export const DEFAULT_ALLOWED_TYPES: ReadonlyArray<string> = [
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "test",
  "chore",
  "build",
  "ci",
  "perf",
  "revert",
];

export const DEFAULT_ALLOWED_SCOPES = "<any>";

// Conservative ceiling — safely under the smallest supported provider context
// window (gpt-4o-mini / claude-haiku, ~128k tokens ≈ ~512k chars). Leaves
// headroom for model output and JSON overhead.
export const PROMPT_CHAR_BUDGET = 480_000;
