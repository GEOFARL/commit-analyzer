import { describe, expect, it, vi } from "vitest";

import { runWithConcurrency } from "./concurrency.js";

describe("runWithConcurrency", () => {
  it("preserves input order in results", async () => {
    const items = [1, 2, 3, 4, 5];
    const result = await runWithConcurrency(items, 2, async (n) =>
      Promise.resolve(n * 10),
    );
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  it("never runs more than `concurrency` in flight at once", async () => {
    let inFlight = 0;
    let peak = 0;
    const worker = vi.fn(async (_n: number) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return _n;
    });
    await runWithConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 3, worker);
    expect(peak).toBeLessThanOrEqual(3);
    expect(worker).toHaveBeenCalledTimes(8);
  });

  it("rethrows the first error after all tasks settle", async () => {
    const items = [1, 2, 3, 4];
    await expect(
      runWithConcurrency(items, 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return Promise.resolve(n);
      }),
    ).rejects.toThrow("boom");
  });

  it("returns empty array for empty input without invoking worker", async () => {
    const worker = vi.fn();
    const result = await runWithConcurrency<number, number>([], 5, worker);
    expect(result).toEqual([]);
    expect(worker).not.toHaveBeenCalled();
  });
});
