import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

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

// Minimal structural type so this file stays dep-free until T-1.4 pulls in
// `nestjs-cls` alongside the full Nest runtime. The shape matches
// `ClsModuleOptions["middleware"]` so `ClsModule.forRoot({ middleware })`
// will accept it directly.
interface ClsStoreLike {
  getId(): string;
  set(key: string, value: unknown): void;
}

export interface RequestIdMiddlewareOptions {
  mount: true;
  generateId: true;
  idGenerator: (req: IncomingMessage) => string;
  setup: (cls: ClsStoreLike, req: IncomingMessage, res: ServerResponse) => void;
}

// Shared config for `ClsModule.forRoot({ middleware: clsMiddlewareOptions })`.
// Full guard setup (auth claims, tenant scope) lands in T-1.4; this ships the
// request-id propagation story so logs and outbound calls can correlate today.
export const clsMiddlewareOptions: RequestIdMiddlewareOptions = {
  mount: true,
  generateId: true,
  idGenerator: generateRequestId,
  setup: (cls, _req, res) => {
    const id = cls.getId();
    cls.set(REQUEST_ID_KEY, id);
    res.setHeader(REQUEST_ID_HEADER, id);
  },
};
