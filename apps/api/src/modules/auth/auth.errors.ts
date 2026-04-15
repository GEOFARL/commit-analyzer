import { PG_UNIQUE_VIOLATION } from "./auth.constants.js";

export const isUniqueViolation = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { code?: unknown; driverError?: { code?: unknown } };
  if (candidate.code === PG_UNIQUE_VIOLATION) return true;
  return candidate.driverError?.code === PG_UNIQUE_VIOLATION;
};
