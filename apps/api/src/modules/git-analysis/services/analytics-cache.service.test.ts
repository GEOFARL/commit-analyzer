import { describe, expect, it, vi } from "vitest";

import { AnalyticsCacheService } from "./analytics-cache.service.js";

function makeCache(stored: Record<string, string> = {}) {
  const store = { ...stored };
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
  };
}

describe("AnalyticsCacheService", () => {
  it("calls loader on cache miss and stores result", async () => {
    const cache = makeCache();
    const svc = new AnalyticsCacheService(cache as never);
    const loader = vi.fn(() => Promise.resolve({ totalCommits: 5 }));

    const result = await svc.getOrSet("summary", "repo-1", loader);

    expect(loader).toHaveBeenCalledOnce();
    expect(result).toEqual({ totalCommits: 5 });
    expect(cache.setJson).toHaveBeenCalledOnce();
    expect(svc.metrics()).toEqual({ hits: 0, misses: 1 });
  });

  it("returns cached value without calling loader on hit", async () => {
    const preloaded = {
      "analytics:repo-1:summary": JSON.stringify({ totalCommits: 5 }),
    };
    const cache = makeCache(preloaded);
    const svc = new AnalyticsCacheService(cache as never);
    const loader = vi.fn(() => Promise.resolve({ totalCommits: 99 }));

    const result = await svc.getOrSet("summary", "repo-1", loader);

    expect(loader).not.toHaveBeenCalled();
    expect(result).toEqual({ totalCommits: 5 });
    expect(cache.setJson).not.toHaveBeenCalled();
    expect(svc.metrics()).toEqual({ hits: 1, misses: 0 });
  });

  it("appends suffix to key", async () => {
    const cache = makeCache();
    const svc = new AnalyticsCacheService(cache as never);
    await svc.getOrSet("timeline", "repo-1", () => Promise.resolve([]), "day");

    expect(cache.setJson).toHaveBeenCalledWith(
      "analytics:repo-1:timeline:day",
      [],
      expect.any(Number),
    );
  });

  it("accumulates hits and misses across calls", async () => {
    const preloaded = { "analytics:repo-1:heatmap": JSON.stringify([]) };
    const cache = makeCache(preloaded);
    const svc = new AnalyticsCacheService(cache as never);

    await svc.getOrSet("heatmap", "repo-1", () => Promise.resolve([]));
    await svc.getOrSet("summary", "repo-1", () => Promise.resolve({}));

    expect(svc.metrics()).toEqual({ hits: 1, misses: 1 });
  });

  it("invalidateRepo delegates to delByPattern with correct prefix", async () => {
    const cache = makeCache();
    const svc = new AnalyticsCacheService(cache as never);

    await svc.invalidateRepo("repo-42");

    expect(cache.delByPattern).toHaveBeenCalledWith("analytics:repo-42:*");
  });
});
