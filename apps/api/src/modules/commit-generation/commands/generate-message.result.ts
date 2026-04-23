import type {
  GenerationStatus,
  SuggestionRecord,
} from "@commit-analyzer/shared-types";

import type { ValidationResult } from "../../../shared/policy-validation/validator.service.types.js";

export interface EnrichedSuggestion extends SuggestionRecord {
  validation: ValidationResult | null;
}

export interface GenerateMessageResult {
  /**
   * ID of the persisted `GenerationHistory` row, or `null` when persistence
   * failed (the command is best-effort: a failed write does not fail the
   * command). Downstream consumers that need a history record must check for
   * null before treating the generation as recorded — `generation.completed`
   * is only emitted when this is non-null.
   */
  historyId: string | null;
  status: GenerationStatus;
  suggestions: EnrichedSuggestion[];
  tokensUsed: number;
  regenerated: boolean;
}
