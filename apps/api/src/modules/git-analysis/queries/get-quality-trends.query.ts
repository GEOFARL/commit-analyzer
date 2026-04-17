import type { Granularity } from "@commit-analyzer/contracts";

export class GetQualityTrendsQuery {
  constructor(
    public readonly repoId: string,
    public readonly userId: string,
    public readonly granularity: Granularity,
  ) {}
}
