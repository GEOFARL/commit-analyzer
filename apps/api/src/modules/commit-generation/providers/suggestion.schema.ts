import { z } from "zod";

export const llmSuggestionSchema = z.object({
  type: z.string().min(1),
  scope: z.string().nullable(),
  subject: z.string().min(1),
  body: z.string().nullable(),
  footer: z.string().nullable(),
});

export type LlmSuggestion = z.infer<typeof llmSuggestionSchema>;
