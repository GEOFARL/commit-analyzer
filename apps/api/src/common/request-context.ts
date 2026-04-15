import type { EntityManager } from "@commit-analyzer/database";
import { ClsServiceManager } from "nestjs-cls";

export const CLS_USER_ID = "auth.userId";
export const CLS_AUTH_KIND = "auth.kind";
export const CLS_JWT_CLAIMS = "auth.jwtClaims";
export const CLS_TX_MANAGER = "db.txManager";

export type AuthKind = "session" | "api-key";

export type JwtClaims = Record<string, unknown> & { sub?: string };

export const getAuthUserId = (): string | undefined => {
  const cls = ClsServiceManager.getClsService();
  return cls.isActive() ? cls.get<string>(CLS_USER_ID) : undefined;
};

export const getAuthKind = (): AuthKind | undefined => {
  const cls = ClsServiceManager.getClsService();
  return cls.isActive() ? cls.get<AuthKind>(CLS_AUTH_KIND) : undefined;
};

export const getTxEntityManager = (): EntityManager | undefined => {
  const cls = ClsServiceManager.getClsService();
  return cls.isActive() ? cls.get<EntityManager>(CLS_TX_MANAGER) : undefined;
};
