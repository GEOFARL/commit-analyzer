import argon2 from "argon2";

export const API_KEY_BYTES = 32;
export const API_KEY_PREFIX_LENGTH = 8;
export const API_KEY_PRE = "git_";
export const API_KEY_MINT_MAX_ATTEMPTS = 3;
// Postgres SQLSTATE for unique_violation.
export const PG_UNIQUE_VIOLATION = "23505";

export const ARGON2_OPTS = {
  type: argon2.argon2id,
  timeCost: 3,
  memoryCost: 64 * 1024,
  parallelism: 1,
} as const;
