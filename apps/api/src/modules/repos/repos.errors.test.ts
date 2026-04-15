import { HttpStatus } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { GithubUpstreamError, mapOctokitError } from "./repos.errors.js";

describe("mapOctokitError", () => {
  it("maps 401 to 502 upstream error", () => {
    const err = mapOctokitError({ status: 401, message: "Bad credentials" });
    expect(err).toBeInstanceOf(GithubUpstreamError);
    expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
  });

  it("maps 403 rate-limit to 429 with Retry-After", () => {
    const err = mapOctokitError({
      status: 403,
      message: "API rate limit exceeded",
      response: { headers: { "retry-after": "42" } },
    });
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    const body = err.getResponse() as { retryAfter?: number };
    expect(body.retryAfter).toBe(42);
  });

  it("maps 403 non-rate-limit to 502", () => {
    const err = mapOctokitError({ status: 403, message: "forbidden" });
    expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
  });

  it("maps 403 with x-ratelimit-remaining: 0 to 429", () => {
    const err = mapOctokitError({
      status: 403,
      message: "forbidden",
      response: { headers: { "x-ratelimit-remaining": "0" } },
    });
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it("maps 403 with retry-after (secondary limit) to 429", () => {
    const err = mapOctokitError({
      status: 403,
      message: "forbidden",
      response: { headers: { "retry-after": "17" } },
    });
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    const body = err.getResponse() as { retryAfter?: number };
    expect(body.retryAfter).toBe(17);
  });

  it("maps raw 429 to 429", () => {
    const err = mapOctokitError({ status: 429, message: "too many" });
    expect(err.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
  });

  it("maps unknown errors to 502", () => {
    const err = mapOctokitError(new Error("boom"));
    expect(err.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
  });
});
