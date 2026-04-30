import { contracts } from "@commit-analyzer/contracts";
import type { AppRoute, AppRouter } from "@ts-rest/core";
import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./openapi-document.js";

const isRoute = (value: AppRoute | AppRouter): value is AppRoute =>
  typeof value === "object" &&
  value !== null &&
  "method" in value &&
  "path" in value;

const collectRoutes = (
  router: AppRouter,
  acc: Array<{ method: string; path: string }> = [],
): Array<{ method: string; path: string }> => {
  for (const value of Object.values(router)) {
    if (isRoute(value)) {
      acc.push({ method: value.method, path: value.path });
    } else {
      collectRoutes(value, acc);
    }
  }
  return acc;
};

const toOpenApiPath = (path: string): string =>
  path.replace(/:(\w+)/gu, "{$1}");

const expectedRoutes = collectRoutes(contracts as unknown as AppRouter).map(
  ({ method, path }) => ({ method, path: toOpenApiPath(path) }),
);

describe("buildOpenApiDocument", () => {
  const document = buildOpenApiDocument("https://api.example.com");

  it("uses OpenAPI 3 with project metadata", () => {
    expect(document.openapi).toMatch(/^3\./u);
    expect(document.info.title).toBe("Commit Analyzer API");
    expect(document.servers?.[0]?.url).toBe("https://api.example.com");
  });

  it("emits at least one operation", () => {
    expect(expectedRoutes.length).toBeGreaterThan(0);
    expect(Object.keys(document.paths ?? {}).length).toBeGreaterThan(0);
  });

  it.each(expectedRoutes)(
    "includes contract route $method $path",
    ({ method, path }) => {
      const entry = (document.paths ?? {})[path] as
        | Record<string, unknown>
        | undefined;
      expect(entry, `missing path ${path}`).toBeDefined();
      expect(
        entry?.[method.toLowerCase()],
        `missing ${method} ${path}`,
      ).toBeDefined();
    },
  );

  it("marks the SSE /generate endpoint with x-sse and rate-limit metadata", () => {
    const generatePath = (document.paths ?? {})["/generate"] as
      | Record<string, Record<string, unknown> & { description?: string }>
      | undefined;
    const op = generatePath?.post;
    expect(op).toBeDefined();
    expect(op?.["x-sse"]).toBe(true);
    expect(op?.["x-auth"]).toBe("jwtOrApiKey");
    expect(op?.["x-rate-limit"]).toBe("generate");
    expect(op?.description ?? "").toMatch(/Server-Sent Events/u);
  });

  it("does not mark non-streaming endpoints with x-sse", () => {
    const mePath = (document.paths ?? {})["/me"] as
      | Record<string, Record<string, unknown>>
      | undefined;
    const me = mePath?.get;
    expect(me).toBeDefined();
    expect(me?.["x-auth"]).toBeDefined();
    expect(me?.["x-rate-limit"]).toBeDefined();
    expect(me?.["x-sse"]).toBeUndefined();
  });

  it("documents the /sync Socket.IO namespace under x-websocket", () => {
    const ws = (
      document as unknown as { "x-websocket"?: Record<string, unknown> }
    )["x-websocket"];
    expect(ws).toBeDefined();
    expect(ws?.namespace).toBe("/sync");
    expect(ws?.transport).toBe("socket.io");
    const events = ws?.events as Record<string, unknown> | undefined;
    expect(events).toBeDefined();
    expect(Object.keys(events ?? {}).sort()).toEqual([
      "sync.completed",
      "sync.failed",
      "sync.progress",
    ]);
  });

  it("declares bearer and apiKey security schemes", () => {
    expect(document.components?.securitySchemes?.bearer).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(document.components?.securitySchemes?.apiKey).toMatchObject({
      type: "apiKey",
      in: "header",
      name: "X-API-Key",
    });
  });
});
