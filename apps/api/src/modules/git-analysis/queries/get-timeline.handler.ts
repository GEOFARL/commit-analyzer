import type { TimelinePoint } from "@commit-analyzer/contracts";
import type { DataSource } from "@commit-analyzer/database";
import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { DATA_SOURCE } from "../../../common/database/tokens.js";
import { assertRepoOwnership } from "../repo-ownership.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

import { GetTimelineQuery } from "./get-timeline.query.js";

@QueryHandler(GetTimelineQuery)
export class GetTimelineHandler implements IQueryHandler<GetTimelineQuery> {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async execute(query: GetTimelineQuery): Promise<TimelinePoint[]> {
    await assertRepoOwnership(this.ds, query.repoId, query.userId);

    const suffix = query.granularity;
    const cached = await this.analyticsCache.get<TimelinePoint[]>("timeline", query.repoId, suffix);
    if (cached) return cached;

    const rows: { date: string; count: string }[] = await this.ds.query(
      `SELECT date_trunc($1, c.authored_at)::date::text AS date,
              count(*)::text AS count
         FROM commits c
        WHERE c.repository_id = $2
        GROUP BY 1
        ORDER BY 1`,
      [query.granularity, query.repoId],
    );

    const result = rows.map((r) => ({ date: r.date, count: Number(r.count) }));
    await this.analyticsCache.set("timeline", query.repoId, result, suffix);
    return result;
  }
}
