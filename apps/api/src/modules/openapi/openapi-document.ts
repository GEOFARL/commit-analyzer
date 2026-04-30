import {
  contracts,
  SYNC_EVENT_NAMES,
  SYNC_WS_NAMESPACE,
  syncCompletedPayloadSchema,
  syncFailedPayloadSchema,
  syncProgressPayloadSchema,
  type RouteMetadata,
} from "@commit-analyzer/contracts";
import type { AppRoute, AppRouter } from "@ts-rest/core";
import { generateOpenApi } from "@ts-rest/open-api";
import type { OpenAPIObject, OperationObject } from "openapi3-ts";
import { zodToJsonSchema } from "zod-to-json-schema";

const isRouteMetadata = (value: unknown): value is RouteMetadata =>
  !!value && typeof value === "object" && "auth" in value && "rateLimit" in value;

const operationMapper = (
  operation: OperationObject,
  appRoute: AppRoute,
): OperationObject => {
  const metadata = isRouteMetadata(appRoute.metadata) ? appRoute.metadata : null;
  if (!metadata) return operation;

  const next: OperationObject & Record<string, unknown> = {
    ...operation,
    "x-auth": metadata.auth,
    "x-rate-limit": metadata.rateLimit,
  };

  if (metadata.streaming === "sse") {
    next["x-sse"] = true;
    next.description = [
      operation.description,
      "Server-Sent Events stream — frames `suggestion`, `token`, `done`, `error`. " +
        "Heartbeat `: ping` every 15s. Consume via `EventSource` or fetch streaming.",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  return next;
};

const buildWebsocketExtension = (): Record<string, unknown> => ({
  namespace: SYNC_WS_NAMESPACE,
  transport: "socket.io",
  events: {
    [SYNC_EVENT_NAMES.progress]: {
      direction: "server-to-client",
      payload: zodToJsonSchema(syncProgressPayloadSchema, { target: "openApi3" }),
    },
    [SYNC_EVENT_NAMES.completed]: {
      direction: "server-to-client",
      payload: zodToJsonSchema(syncCompletedPayloadSchema, { target: "openApi3" }),
    },
    [SYNC_EVENT_NAMES.failed]: {
      direction: "server-to-client",
      payload: zodToJsonSchema(syncFailedPayloadSchema, { target: "openApi3" }),
    },
  },
});

export const buildOpenApiDocument = (apiUrl: string): OpenAPIObject => {
  // `c.noBody()` produces a unique-symbol response that the open-api package's
  // `AppRouter` type cannot model. Runtime is fine — narrow via `unknown`.
  const router = contracts as unknown as AppRouter;
  const document = generateOpenApi(
    router,
    {
      info: {
        title: "Commit Analyzer API",
        version: "1.0.0",
        description:
          "REST API derived from `@commit-analyzer/contracts`. " +
          "SSE endpoints carry the `x-sse` extension; the `/sync` Socket.IO " +
          "namespace is documented under `x-websocket` at the document root.",
      },
      servers: [{ url: apiUrl }],
      tags: [
        { name: "auth" },
        { name: "audit" },
        { name: "analytics" },
        { name: "repos" },
        { name: "policies" },
        { name: "generation" },
      ],
      components: {
        securitySchemes: {
          bearer: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "Supabase JWT",
          },
          apiKey: {
            type: "apiKey",
            in: "header",
            name: "X-API-Key",
          },
        },
      },
    },
    {
      setOperationId: "concatenated-path",
      operationMapper,
    },
  );

  (document as OpenAPIObject & Record<string, unknown>)["x-websocket"] =
    buildWebsocketExtension();

  return document;
};
