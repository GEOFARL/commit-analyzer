import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

import { GithubTokenMissingError } from "./repos.errors.js";

// INTERIM: Module A spec §6 mandates sourcing the GitHub token from the
// decrypted `users.access_token_enc` column written by the auth callback.
// T-1.7 didn't wire that callback yet, so T-1.8 ships an interim header
// read from the web client's Supabase session. Tracking follow-up: #117.
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
