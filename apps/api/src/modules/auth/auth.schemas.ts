import { z } from "zod";

export const signInEventSchema = z.object({
  provider: z.literal("github"),
});
