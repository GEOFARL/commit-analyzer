import { z } from "zod";

const nonEmpty = (field: string) =>
  z
    .string({ required_error: `${field} is required` })
    .trim()
    .min(1, `${field} must not be empty`);

const urlField = (field: string) =>
  z
    .string({ required_error: `${field} is required` })
    .trim()
    .url(`${field} must be a valid URL`);

const optionalString = z
  .string()
  .trim()
  .min(1)
  .optional()
  .or(z.literal("").transform(() => undefined));

const base64Key32 = z
  .string({ required_error: "ENCRYPTION_KEY_BASE64 is required" })
  .refine(
    (value) => {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
      try {
        return Buffer.from(value, "base64").length === 32;
      } catch {
        return false;
      }
    },
    "ENCRYPTION_KEY_BASE64 must be 32 raw bytes encoded as base64",
  );

export const serverEnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),

  APP_URL: urlField("APP_URL"),
  API_URL: urlField("API_URL"),
  WEB_ORIGIN: urlField("WEB_ORIGIN"),

  DATABASE_URL: nonEmpty("DATABASE_URL"),
  REDIS_URL: nonEmpty("REDIS_URL"),

  SUPABASE_URL: urlField("SUPABASE_URL"),
  SUPABASE_ANON_KEY: nonEmpty("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty("SUPABASE_SERVICE_ROLE_KEY"),

  GITHUB_CLIENT_ID: nonEmpty("GITHUB_CLIENT_ID"),
  GITHUB_CLIENT_SECRET: nonEmpty("GITHUB_CLIENT_SECRET"),

  OPENAI_API_KEY: optionalString,
  ANTHROPIC_API_KEY: optionalString,

  ENCRYPTION_KEY_BASE64: base64Key32,

  CSP_CONNECT_SRC: z
    .string()
    .trim()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(/[\s,]+/u)
            .map((token) => token.trim())
            .filter((token) => token.length > 0)
        : [],
    ),
});

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: urlField("NEXT_PUBLIC_APP_URL"),
  NEXT_PUBLIC_API_URL: urlField("NEXT_PUBLIC_API_URL"),
  NEXT_PUBLIC_SUPABASE_URL: urlField("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
