import "reflect-metadata";

import type { CanActivate, Type } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants.js";
import { describe, expect, it } from "vitest";

import { AuthTsRestController } from "./auth-ts-rest.controller.js";
import { JwtOrApiKeyGuard } from "./jwt-or-api-key.guard.js";
import { SupabaseAuthGuard } from "./supabase-auth.guard.js";

type GuardClass = Type<CanActivate>;

const controllerGuards = (): GuardClass[] =>
  (Reflect.getMetadata(GUARDS_METADATA, AuthTsRestController) ??
    []) as GuardClass[];

const handlerGuards = (handlerName: string): GuardClass[] => {
  const handler =
    AuthTsRestController.prototype[
      handlerName as keyof AuthTsRestController
    ];
  return (
    (Reflect.getMetadata(GUARDS_METADATA, handler as object) ?? []) as
      GuardClass[]
  );
};

describe("AuthTsRestController guard wiring", () => {
  it("controller-level guard accepts either JWT or X-API-Key", () => {
    expect(controllerGuards()).toEqual([JwtOrApiKeyGuard]);
  });

  it.each(["me", "listApiKeys", "listLlmKeys"])(
    "%s relies on controller-level guard only (no method-level pin)",
    (handlerName) => {
      expect(handlerGuards(handlerName)).toEqual([]);
    },
  );

  it.each([
    "sync",
    "deleteAccount",
    "createApiKey",
    "revokeApiKey",
    "upsertLlmKey",
    "deleteLlmKey",
  ])("%s pins SupabaseAuthGuard at the method level", (handlerName) => {
    expect(handlerGuards(handlerName)).toEqual([SupabaseAuthGuard]);
  });
});
