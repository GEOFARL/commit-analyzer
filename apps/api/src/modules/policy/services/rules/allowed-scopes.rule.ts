import type { RuleFn } from "./types.js";

export type AllowedScopesValue =
  | { kind: "list"; values: string[] }
  | { kind: "regex"; pattern: string };

export const allowedScopes: RuleFn<AllowedScopesValue> = (parsed, value) => {
  const scope = parsed.scope ?? "";

  if (value.kind === "list") {
    if (value.values.includes(scope)) return { passed: true };
    return {
      passed: false,
      message: `scope "${scope}" is not allowed. Allowed: ${value.values.join(", ")}`,
    };
  }

  if (new RegExp(value.pattern).test(scope)) return { passed: true };
  return {
    passed: false,
    message: `scope "${scope}" does not match pattern /${value.pattern}/`,
  };
};
