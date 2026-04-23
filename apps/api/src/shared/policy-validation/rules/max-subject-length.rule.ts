import type { RuleFn } from "./types.js";

export const maxSubjectLength: RuleFn<number> = (parsed, value) => {
  if (parsed.subject.length <= value) return { passed: true };
  return {
    passed: false,
    message: `subject is ${parsed.subject.length} chars; max allowed is ${value}`,
  };
};
