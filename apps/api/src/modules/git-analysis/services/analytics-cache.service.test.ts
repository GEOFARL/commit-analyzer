import { describe, expect, it, vi } from "vitest";

import type { CacheService } from "../../../common/cache/cache.service.js";

import {
  ANALYTICS_CACHE_STATS_HITS,
  ANALYTICS_CACHE_STATS_MISSES,
  ANALYTICS_CACHE_TTL,
} from "./analytics-cache.constants.js";
import { AnalyticsCacheService } from "./analytics-cache.service.js";

function makeCache(stored: Record<string, string> = {}) {
  const store = { ...stored };
  const counters: Record<string, number> = {};
  return {
    getJson: vi.fn((key: string) => {
      const raw = store[key];
      return Promise.resolve(
        raw !== undefined ? (JSON.parse(raw) as unknown) : null,
      );
    }),
    setJson: vi.fn((key: string, value: unknown) => {
      store[key] = JSON.stringify(value);
      return Promise.resolve();
    }),
    del: vi.fn(() => Promise.resolve()),
    delByPattern: vi.fn(() => Promise.resolve(0)),
    incr: vi.fn((key: string) => {
      counters[key] = (counters[key] ?? 0) + 1;
      return Promise.resolve(counters[key]);
    }),
    getNumber: vi.fn((key: string) => Promise.resolve(counters[key] ?? 0)),
  };
}

describe("AnalyticsCacheService", () => {
  it("calls loader on cache miss, stores result with per-kind TTL", async () => {
    const cache = makeCache();
    const svc = new AnalyticsCacheService(cache as unknown as CacheService);
    const loader = vi.fn(() => Promise.resolve({ totalCommits: 5 }));

    const result = await svc.getOrSet("summary", "repo-1", loader);

    expect(loader).toHaveBeenCalledOnce();
    expect(result).toEqual({ totalCommits: 5 });
    expect(cache.setJson).toHaveBeenCalledWith(
      "analytics:repo-1:summary",
      { totalCommits: 5 },
      ANALYTICS_CACHE_TTL.summary,
    );
    expect(cache.incr).toHaveBeenCalledWith(ANALYTICS_CACHE_STATS_MISSES);
    await expect(svc.metrics()).resolves.toEqual({
      hits: 0,
      misses: 1,
      hitRate: 0,
    });
  });

  it("returns cached value without calling loader on hit", async () => {
    const preloaded = {
      "analytics:repo-1:summary": JSON.stringify({ totalCommits: 5 }),
    };
    const cache = makeCache(preloaded);
    const svc = new AnalyticsCacheService(cache as unknown as CacheService);
    const loader = vi.fn(() => Promise.resolve({ totalCommits: 99 }));

    const result = await svc.getOrSet("summary", "repo-1", loader);

    expect(loader).not.toHaveBeenCalled();
    expect(result).toEqual({ totalCommits: 5 });
    expect(cache.setJson).not.toHaveBeenCalled();
    expect(cache.incr).toHaveBeenCalledWith(ANALYTICS_CACHE_STATS_HITS);
    await expect(svc.metrics()).resolves.toEqual({
      hits: 1,
      misses: 0,
      hitRate: 1,
    });
  });

  it("appends suffix to key", async () => {
    const cache = makeCache();
    const svc = new AnalyticsCacheService(cache as unknown as CacheService);
    await svc.getOrSet("timeline", "repo-1", () => Promise.resolve([]), "day");

    expect(cache.setJson).toHaveBeenCalledWith(
      "analytics:repo-1:timeline:day",
      [],
      ANALYTICS_CACHE_TTL.timeline,
    );
  });

  it("metrics reports hit rate across mixed traffic", async () => {
    const preloaded = { "analytics:repo-1:heatmap": JSON.stringify([]) };
    const cache = makeCache(preloaded);
    const svc = new AnalyticsCacheService(cache as unknown as CacheService);

    await svc.getOrSet("heatmap", "repo-1", () => Promise.resolve([]));
    await svc.getOrSet("summary", "repo-1", () => Promise.resolve({}));

    await expect(svc.metrics()).resolves.toEqual({
      hits: 1,
      misses: 1,
      hitRate: 0.5,
    });
  });

  it("invalidateRepo delegates to delByPattern with correct prefix", async () => {
    const cache = makeCache();
    const svc = new AnalyticsCacheService(cache as unknown as CacheService);

    await svc.invalidateRepo("repo-42");

    expect(cache.delByPattern).toHaveBeenCalledWith("analytics:repo-42:*");
  });
});
