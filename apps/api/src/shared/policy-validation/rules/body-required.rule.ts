import type { RuleFn } from "./types.js";

export const bodyRequired: RuleFn<boolean> = (parsed, value) => {
  if (!value) return { passed: true };
  if ((parsed.body?.length ?? 0) > 0) return { passed: true };
  return { passed: false, message: "body is required" };
};
