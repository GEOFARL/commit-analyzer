import type { RuleFn } from "./types.js";

export const allowedTypes: RuleFn<string[]> = (parsed, value) => {
  if (value.includes(parsed.type)) return { passed: true };
  return {
    passed: false,
    message: `type "${parsed.type}" is not allowed. Allowed: ${value.join(", ")}`,
  };
};
