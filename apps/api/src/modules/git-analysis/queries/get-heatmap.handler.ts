import type { HeatmapCell } from "@commit-analyzer/contracts";
import type { DataSource } from "@commit-analyzer/database";
import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { DATA_SOURCE } from "../../../common/database/tokens.js";
import { assertRepoOwnership } from "../repo-ownership.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

import { GetHeatmapQuery } from "./get-heatmap.query.js";

@QueryHandler(GetHeatmapQuery)
export class GetHeatmapHandler implements IQueryHandler<GetHeatmapQuery> {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async execute(query: GetHeatmapQuery): Promise<HeatmapCell[]> {
    await assertRepoOwnership(this.ds, query.repoId, query.userId);

    return this.analyticsCache.getOrSet("heatmap", query.repoId, async () => {
      const rows: { day: string; hour: string; count: string }[] =
        await this.ds.query(
          `SELECT extract(dow FROM c.authored_at)::int AS day,
                  extract(hour FROM c.authored_at)::int AS hour,
                  count(*)::text AS count
             FROM commits c
            WHERE c.repository_id = $1
            GROUP BY 1, 2
            ORDER BY 1, 2`,
          [query.repoId],
        );

      return rows.map((r) => ({
        day: Number(r.day),
        hour: Number(r.hour),
        count: Number(r.count),
      }));
    });
  }
}
