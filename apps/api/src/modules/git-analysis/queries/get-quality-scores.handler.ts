import type { QualityBucket } from "@commit-analyzer/contracts";
import type { DataSource } from "@commit-analyzer/database";
import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { DATA_SOURCE } from "../../../common/database/tokens.js";
import { assertRepoOwnership } from "../repo-ownership.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

import { GetQualityScoresQuery } from "./get-quality-scores.query.js";

@QueryHandler(GetQualityScoresQuery)
export class GetQualityScoresHandler implements IQueryHandler<GetQualityScoresQuery> {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async execute(query: GetQualityScoresQuery): Promise<QualityBucket[]> {
    await assertRepoOwnership(this.ds, query.repoId, query.userId);

    return this.analyticsCache.getOrSet(
      "qualityScores",
      query.repoId,
      async () => {
        const rows: { bucket: string; count: string }[] = await this.ds.query(
          `SELECT CASE
                    WHEN qs.overall_score >= 80 THEN 'good'
                    WHEN qs.overall_score >= 50 THEN 'average'
                    ELSE 'poor'
                  END AS bucket,
                  count(*)::text AS count
             FROM commits c
             JOIN commit_quality_scores qs ON qs.commit_id = c.id
            WHERE c.repository_id = $1
            GROUP BY 1
            ORDER BY 1`,
          [query.repoId],
        );
        return rows.map((r) => ({
          bucket: r.bucket as "good" | "average" | "poor",
          count: Number(r.count),
        }));
      },
    );
  }
}
