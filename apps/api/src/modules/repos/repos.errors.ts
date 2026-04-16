import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from "@nestjs/common";

import { GithubTokenExpiredError } from "../../shared/github-token-expired.error.js";

export { GithubTokenExpiredError };

export class GithubUpstreamError extends HttpException {
  constructor(status: number, message: string, retryAfterSeconds?: number) {
    const payload: Record<string, unknown> = { message, code: "github_upstream" };
    if (retryAfterSeconds !== undefined) {
      payload.retryAfter = retryAfterSeconds;
    }
    super(payload, status);
  }
}

export class RepoAlreadyConnectedError extends ConflictException {
  constructor() {
    super("repository already connected");
  }
}

export class RepoNotFoundError extends NotFoundException {
  constructor() {
    super("repository not found");
  }
}

interface OctokitLike {
  status?: number;
  message?: string;
  response?: { headers?: Record<string, string> };
}

const readRetryAfter = (err: OctokitLike): number | undefined => {
  const header = err.response?.headers?.["retry-after"];
  if (typeof header !== "string") return undefined;
  const parsed = Number.parseInt(header, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
};

// GitHub signals rate limiting in three different ways depending on the
// endpoint and whether it's a primary or secondary limit:
//   - HTTP 429 (straightforward)
//   - HTTP 403 with a `rate limit` / `secondary rate limit` message
//   - HTTP 403 with `x-ratelimit-remaining: 0` (primary limit exhausted)
//   - HTTP 403 with a `retry-after` header (secondary limit)
// We collapse all of these to 429 so clients get consistent back-pressure.
const looksRateLimited = (err: OctokitLike): boolean => {
  if (err.status === 429) return true;
  if (err.status !== 403) return false;
  const headers = err.response?.headers ?? {};
  if (headers["x-ratelimit-remaining"] === "0") return true;
  if (typeof headers["retry-after"] === "string") return true;
  if (typeof err.message === "string" && /rate limit/i.test(err.message)) {
    return true;
  }
  return false;
};

const makeRateLimited = (err: OctokitLike): GithubUpstreamError =>
  new GithubUpstreamError(
    HttpStatus.TOO_MANY_REQUESTS,
    "github rate limit exceeded",
    readRetryAfter(err),
  );

export const mapOctokitError = (err: unknown): HttpException => {
  const maybe: OctokitLike = (err ?? {}) as OctokitLike;
  const status = typeof maybe.status === "number" ? maybe.status : 0;

  if (looksRateLimited(maybe)) {
    return makeRateLimited(maybe);
  }
  if (status === 401) {
    return new GithubTokenExpiredError();
  }
  if (status === 403) {
    return new GithubUpstreamError(
      HttpStatus.BAD_GATEWAY,
      "github authorization rejected",
    );
  }
  return new GithubUpstreamError(
    HttpStatus.BAD_GATEWAY,
    "github upstream failure",
  );
};
