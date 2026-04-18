/**
 * Run `worker` over every element of `items` with at most `concurrency`
 * in flight at once. Preserves input order in the returned array.
 *
 * If any worker rejects, in-flight tasks still complete, then the first
 * error is re-thrown. Matches the failure semantics the sync processor
 * relies on: a single bad `getCommit` call fails the whole sync job.
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;
  let firstError: Error | undefined;

  const run = async (): Promise<void> => {
    while (cursor < items.length) {
      const idx = cursor++;
      try {
        results[idx] = await worker(items[idx]!, idx);
      } catch (err) {
        firstError ??= err instanceof Error ? err : new Error(String(err));
      }
    }
  };

  const runners = Array.from({ length: limit }, () => run());
  await Promise.all(runners);

  if (firstError) throw firstError;
  return results;
}
