import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

export const REQUEST_ID_HEADER = "x-request-id";
export const REQUEST_ID_KEY = "requestId";

const headerValue = (value: string | string[] | undefined): string | undefined => {
  if (Array.isArray(value)) return value[0];
  return value;
};

export const generateRequestId = (req?: IncomingMessage): string => {
  const existing = req && headerValue(req.headers[REQUEST_ID_HEADER]);
  return existing && existing.trim().length > 0 ? existing : randomUUID();
};
