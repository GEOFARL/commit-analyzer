const SECRET_KEY_NAMES = new Set([
  "token",
  "tokens",
  "secret",
  "secrets",
  "password",
  "passphrase",
  "authorization",
  "auth",
  "api_key",
  "apikey",
  "access_token",
  "accesstoken",
  "refresh_token",
  "refreshtoken",
  "client_secret",
  "clientsecret",
  "private_key",
  "privatekey",
  "key",
]);

const SECRET_KEY_ALLOWLIST = new Set(["api_key_id", "key_prefix", "keyprefix"]);

const SECRET_VALUE_PATTERNS: RegExp[] = [
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
  /^(sk-|sk_live_|sk_test_|pk_live_|pk_test_|rk_live_|rk_test_)[A-Za-z0-9_-]{12,}$/,
  /^(ghp_|ghs_|gho_|ghu_|github_pat_)[A-Za-z0-9_-]{20,}$/i,
  /^xox[abprs]-[A-Za-z0-9-]{10,}$/i,
  /^AKIA[0-9A-Z]{16}$/,
  /^Bearer\s+[A-Za-z0-9._-]{16,}$/i,
  /^[A-Fa-f0-9]{40,}$/,
  /^[A-Za-z0-9_-]{40,}$/,
];

const REDACTED = "[REDACTED]";

const isSecretKey = (key: string): boolean => {
  const k = key.toLowerCase();
  if (SECRET_KEY_ALLOWLIST.has(k)) return false;
  if (SECRET_KEY_NAMES.has(k)) return true;
  for (const banned of SECRET_KEY_NAMES) {
    if (k.includes(banned) && !SECRET_KEY_ALLOWLIST.has(k)) return true;
  }
  return false;
};

const looksLikeSecretValue = (value: string): boolean => {
  if (value.length < 12) return false;
  return SECRET_VALUE_PATTERNS.some((re) => re.test(value));
};

const redactString = (value: string): string =>
  looksLikeSecretValue(value) ? REDACTED : value;

export const redactPayload = (input: unknown): unknown => {
  if (typeof input === "string") return redactString(input);
  if (input === null || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map((v) => redactPayload(v));

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string" && isSecretKey(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = redactPayload(value);
  }
  return out;
};
