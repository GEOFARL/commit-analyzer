import type { Redis } from "ioredis";
import { beforeEach, describe, expect, it } from "vitest";

import { CacheService } from "../../../common/cache/cache.service.js";
import { RepoRescoredEvent } from "../../../shared/events/repo-rescored.event.js";
import { RepoSyncedEvent } from "../../../shared/events/repo-synced.event.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

import { OnRepositorySyncedHandler } from "./on-repository-synced.handler.js";

/**
 * Minimal in-memory ioredis stand-in. Implements only the commands the
 * invalidation path exercises (`set`, `get`, `scan`, `del`) with real glob
 * semantics (`*`) so SCAN/MATCH behaves like production.
 */
function createFakeRedis(initial: Record<string, string> = {}): Redis {
  const store = new Map<string, string>(Object.entries(initial));

  const globToRegex = (pattern: string): RegExp => {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`^${escaped.replace(/\*/g, ".*")}$`);
  };

  const redis = {
    get(key: string) {
      return Promise.resolve(store.get(key) ?? null);
    },
    set(key: string, value: string) {
      store.set(key, value);
      return Promise.resolve("OK" as const);
    },
    del(...keys: string[]) {
      let removed = 0;
      for (const k of keys) {
        if (store.delete(k)) removed += 1;
      }
      return Promise.resolve(removed);
    },
    scan(
      cursor: string,
      _match: "MATCH",
      pattern: string,
      _count: "COUNT",
      _n: number,
    ) {
      const re = globToRegex(pattern);
      const all = [...store.keys()].filter((k) => re.test(k));
      return Promise.resolve([
        "0",
        cursor === "0" ? all : [],
      ] as [string, string[]]);
    },
    keys() {
      return [...store.keys()];
    },
  };

  return redis as unknown as Redis;
}

describe("OnRepositorySyncedHandler", () => {
  let redis: Redis;
  let handler: OnRepositorySyncedHandler;

  beforeEach(() => {
    redis = createFakeRedis({
      "analytics:repo-1:summary": "{}",
      "analytics:repo-1:timeline": "[]",
      "analytics:repo-1:heatmap:day": "[]",
      "analytics:repo-2:summary": "{}",
      "analytics:repo-2:timeline": "[]",
      "analytics:stats:hits": "5",
      "analytics:stats:misses": "3",
      "unrelated:repo-1": "keep",
    });
    const cache = new CacheService(redis);
    const analyticsCache = new AnalyticsCacheService(cache);
    handler = new OnRepositorySyncedHandler(analyticsCache);
  });

  it("wipes only target repo keys on RepoSyncedEvent", async () => {
    await handler.handle(
      new RepoSyncedEvent("repo-1", "user-1", "sync-job-1", 42),
    );

    const remaining = (redis as unknown as { keys(): string[] }).keys();
    expect(remaining).not.toContain("analytics:repo-1:summary");
    expect(remaining).not.toContain("analytics:repo-1:timeline");
    expect(remaining).not.toContain("analytics:repo-1:heatmap:day");

    expect(remaining).toContain("analytics:repo-2:summary");
    expect(remaining).toContain("analytics:repo-2:timeline");
    expect(remaining).toContain("unrelated:repo-1");
  });

  it("preserves cross-repo stats counters (no leaks beyond target)", async () => {
    await handler.handle(
      new RepoSyncedEvent("repo-1", "user-1", "sync-job-1", 42),
    );

    const remaining = (redis as unknown as { keys(): string[] }).keys();
    // stats counters live under `analytics:stats:*` — invalidation for
    // `analytics:repo-1:*` must not touch them.
    expect(remaining).toContain("analytics:stats:hits");
    expect(remaining).toContain("analytics:stats:misses");
  });

  it("wipes keys on RepoRescoredEvent just like sync", async () => {
    await handler.handle(new RepoRescoredEvent("repo-1", "rescore-9", 10));

    const remaining = (redis as unknown as { keys(): string[] }).keys();
    expect(remaining.filter((k) => k.startsWith("analytics:repo-1:"))).toEqual(
      [],
    );
    expect(remaining).toContain("analytics:repo-2:summary");
  });

  it("is a no-op when no keys match (no throw, no unrelated deletions)", async () => {
    await handler.handle(
      new RepoSyncedEvent("repo-999", "user-1", "sync-job-x", 0),
    );

    const remaining = (redis as unknown as { keys(): string[] }).keys();
    expect(remaining).toHaveLength(8);
  });
});
