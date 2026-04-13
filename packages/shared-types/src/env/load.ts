import { z } from "zod";

import {
  clientEnvSchema,
  serverEnvSchema,
  type ClientEnv,
  type ServerEnv,
} from "./schema.js";

export class EnvValidationError extends Error {
  constructor(
    public readonly scope: "server" | "client",
    public readonly issues: z.ZodIssue[],
  ) {
    super(
      `Invalid ${scope} environment:\n` +
        issues
          .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join("\n"),
    );
    this.name = "EnvValidationError";
  }
}

const parse = <S extends z.ZodTypeAny>(
  scope: "server" | "client",
  schema: S,
  source: Record<string, string | undefined>,
): z.output<S> => {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvValidationError(scope, result.error.issues);
  }
  return result.data as z.output<S>;
};

export const loadServerEnv = (
  source: Record<string, string | undefined> = process.env,
): ServerEnv => parse("server", serverEnvSchema, source);

export const loadClientEnv = (
  source: Record<string, string | undefined> = process.env,
): ClientEnv => parse("client", clientEnvSchema, source);

export const loadEnv = (
  source: Record<string, string | undefined> = process.env,
): { server: ServerEnv; client: ClientEnv } => ({
  server: loadServerEnv(source),
  client: loadClientEnv(source),
});
