import type { ServerEnv } from "@commit-analyzer/shared-types/env";
import helmet from "helmet";

export const DEFAULT_CONNECT_SRC = [
  "'self'",
  "https://*.supabase.co",
  "wss://*.supabase.co",
] as const;

export interface SecurityHeadersOptions {
  extraConnectSrc: readonly string[];
}

export const buildCspDirectives = ({
  extraConnectSrc,
}: SecurityHeadersOptions): Record<string, string[]> => ({
  "default-src": ["'self'"],
  "img-src": ["'self'", "https://avatars.githubusercontent.com", "data:"],
  "connect-src": [...DEFAULT_CONNECT_SRC, ...extraConnectSrc],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'"],
});

export const buildHelmetMiddleware = (env: Pick<ServerEnv, "CSP_CONNECT_SRC">) =>
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: buildCspDirectives({ extraConnectSrc: env.CSP_CONNECT_SRC }),
    },
    strictTransportSecurity: {
      maxAge: 63_072_000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    xContentTypeOptions: true,
  });
