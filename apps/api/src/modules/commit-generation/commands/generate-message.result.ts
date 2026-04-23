import type {
  GenerationStatus,
  SuggestionRecord,
} from "@commit-analyzer/shared-types";

import type { ValidationResult } from "../../../shared/policy-validation/validator.service.types.js";

export interface EnrichedSuggestion extends SuggestionRecord {
  validation: ValidationResult | null;
}

export interface GenerateMessageResult {
  historyId: string | null;
  status: GenerationStatus;
  suggestions: EnrichedSuggestion[];
  tokensUsed: number;
  regenerated: boolean;
}
