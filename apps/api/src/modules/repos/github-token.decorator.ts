import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { GithubTokenMissingError } from "./repos.errors.js";

export const GITHUB_TOKEN_HEADER = "x-github-token";

export const GithubToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const raw = req.headers[GITHUB_TOKEN_HEADER];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value || value.trim().length === 0) {
      throw new GithubTokenMissingError();
    }
    return value.trim();
  },
);
