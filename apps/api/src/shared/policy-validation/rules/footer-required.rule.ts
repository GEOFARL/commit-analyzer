import type { RuleFn } from "./types.js";

export const footerRequired: RuleFn<boolean> = (parsed, value) => {
  if (!value) return { passed: true };
  if ((parsed.footer?.length ?? 0) > 0) return { passed: true };
  return { passed: false, message: "footer is required" };
};
