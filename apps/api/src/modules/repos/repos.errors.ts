import {
  ConflictException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

export class GithubTokenMissingError extends UnauthorizedException {
  constructor() {
    super("github access token missing");
  }
}

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

const makeRateLimited = (err: OctokitLike): GithubUpstreamError =>
  new GithubUpstreamError(
    HttpStatus.TOO_MANY_REQUESTS,
    "github rate limit exceeded",
    readRetryAfter(err),
  );

export const mapOctokitError = (err: unknown): GithubUpstreamError => {
  const maybe: OctokitLike = (err ?? {}) as OctokitLike;
  const status = typeof maybe.status === "number" ? maybe.status : 0;

  if (status === 401 || status === 403) {
    const isRateLimit =
      status === 403 &&
      typeof maybe.message === "string" &&
      /rate limit/i.test(maybe.message);
    return isRateLimit
      ? makeRateLimited(maybe)
      : new GithubUpstreamError(
          HttpStatus.BAD_GATEWAY,
          "github authorization rejected",
        );
  }
  if (status === 429) {
    return makeRateLimited(maybe);
  }
  return new GithubUpstreamError(
    HttpStatus.BAD_GATEWAY,
    "github upstream failure",
  );
};
