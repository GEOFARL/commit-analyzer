import { z } from "zod";

export const llmSuggestionSchema = z.object({
  type: z.string().min(1),
  scope: z.string().nullable().optional(),
  subject: z.string().min(1),
  body: z.string().nullable().optional(),
  footer: z.string().nullable().optional(),
});

export type LlmSuggestion = z.infer<typeof llmSuggestionSchema>;
