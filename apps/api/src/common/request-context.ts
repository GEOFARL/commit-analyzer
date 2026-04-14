import { ClsServiceManager } from "nestjs-cls";

export const CLS_USER_ID = "auth.userId";
export const CLS_AUTH_KIND = "auth.kind";

export type AuthKind = "session" | "api-key";

export const getAuthUserId = (): string | undefined => {
  const cls = ClsServiceManager.getClsService();
  return cls.isActive() ? cls.get<string>(CLS_USER_ID) : undefined;
};

export const getAuthKind = (): AuthKind | undefined => {
  const cls = ClsServiceManager.getClsService();
  return cls.isActive() ? cls.get<AuthKind>(CLS_AUTH_KIND) : undefined;
};
