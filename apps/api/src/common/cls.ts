import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { ClsModule, type ClsModuleOptions } from "nestjs-cls";

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

const clsModuleOptions: ClsModuleOptions = {
  global: true,
  middleware: {
    mount: true,
    generateId: true,
    idGenerator: (req: IncomingMessage) => generateRequestId(req),
    setup: (cls, _req, res: ServerResponse) => {
      const id = cls.getId();
      cls.set(REQUEST_ID_KEY, id);
      res.setHeader(REQUEST_ID_HEADER, id);
    },
  },
};

export const RequestClsModule = ClsModule.forRoot(clsModuleOptions);
