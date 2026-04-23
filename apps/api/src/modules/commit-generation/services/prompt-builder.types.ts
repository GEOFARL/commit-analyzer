import type { PolicyRuleInput } from "@commit-analyzer/contracts";

export type PromptPolicy = {
  rules: ReadonlyArray<PolicyRuleInput>;
};

export type BuildPromptOptions = {
  count?: number;
};

export type BuiltPrompt = {
  system: string;
  user: string;
};

export type ResolvedPolicy = {
  allowedTypes: string;
  allowedScopes: string;
  maxSubjectLength: number;
  extraInstructions: string[];
};
