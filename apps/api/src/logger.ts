import { pino, type Logger, type LoggerOptions } from "pino";

// Paths that must never appear in logs. See docs/09-security.md §5.
// Matches both top-level and nested occurrences (e.g. `req.headers.authorization`).
export const REDACT_PATHS: readonly string[] = [
  "*.authorization",
  "authorization",
  "*.cookie",
  "cookie",
  "password",
  "*.password",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.diff",
  "req.body.password",
  "res.headers['set-cookie']",
  // Catch-all for anything that smells like a token or key, at any depth.
  '*[/.*(_TOKEN|_KEY|_SECRET).*/i]',
  "*.accessToken",
  "*.refreshToken",
  "*.apiKey",
  "*.token",
  "token",
  "apiKey",
  "accessToken",
  "refreshToken",
  "encryptionKey",
  "ENCRYPTION_KEY_BASE64",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GITHUB_CLIENT_SECRET",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
];

export interface CreateLoggerOptions {
  level?: LoggerOptions["level"];
  name?: string;
  extra?: LoggerOptions;
}

export const createLogger = (options: CreateLoggerOptions = {}): Logger => {
  const { level = process.env.LOG_LEVEL ?? "info", name = "api", extra } = options;
  return pino({
    name,
    level,
    redact: {
      paths: [...REDACT_PATHS],
      censor: "[REDACTED]",
    },
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...extra,
  });
};
