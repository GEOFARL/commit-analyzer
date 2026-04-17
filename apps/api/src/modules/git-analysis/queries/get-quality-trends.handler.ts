import type { QualityTrendPoint } from "@commit-analyzer/contracts";
import type { DataSource } from "@commit-analyzer/database";
import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { DATA_SOURCE } from "../../../common/database/tokens.js";
import { assertRepoOwnership } from "../repo-ownership.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

import { GetQualityTrendsQuery } from "./get-quality-trends.query.js";

@QueryHandler(GetQualityTrendsQuery)
export class GetQualityTrendsHandler implements IQueryHandler<GetQualityTrendsQuery> {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async execute(query: GetQualityTrendsQuery): Promise<QualityTrendPoint[]> {
    await assertRepoOwnership(this.ds, query.repoId, query.userId);

    const suffix = query.granularity;
    const cached = await this.analyticsCache.get<QualityTrendPoint[]>("qualityTrends", query.repoId, suffix);
    if (cached) return cached;

    const rows: { date: string; avg_score: string }[] = await this.ds.query(
      `SELECT date_trunc($1, c.authored_at)::date::text AS date,
              round(avg(qs.overall_score), 2)::text AS avg_score
         FROM commits c
         JOIN commit_quality_scores qs ON qs.commit_id = c.id
        WHERE c.repository_id = $2
        GROUP BY 1
        ORDER BY 1`,
      [query.granularity, query.repoId],
    );

    const result = rows.map((r) => ({
      date: r.date,
      avgScore: Number(r.avg_score),
    }));
    await this.analyticsCache.set("qualityTrends", query.repoId, result, suffix);
    return result;
  }
}
