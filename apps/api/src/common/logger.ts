import { pino, type Logger, type LoggerOptions } from "pino";

export const REDACT_PATHS: readonly string[] = [
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "password",
  "*.password",
  "req.headers.authorization",
  "req.headers.cookie",
  "req.body.diff",
  "req.body.password",
  "res.headers['set-cookie']",
  "payload.token",
  "payload.api_key",
  "payload.diff",
  "payload.response_text",
];

const SECRET_KEY_PATTERN = /(_TOKEN|_KEY|_SECRET|authorization|password)/i;

const REDACTED = "[REDACTED]";

const redactSecretKeys = (
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown => {
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) return value.map((v) => redactSecretKeys(v, seen));
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SECRET_KEY_PATTERN.test(key) ? REDACTED : redactSecretKeys(val, seen);
  }
  return out;
};

interface CreateLoggerOptions {
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
      censor: REDACTED,
    },
    formatters: {
      log: (obj) => redactSecretKeys(obj) as Record<string, unknown>,
    },
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...extra,
  });
};
