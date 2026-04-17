import type { Summary } from "@commit-analyzer/contracts";
import type { DataSource } from "@commit-analyzer/database";
import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { DATA_SOURCE } from "../../../common/database/tokens.js";
import { assertRepoOwnership } from "../repo-ownership.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

import { GetSummaryQuery } from "./get-summary.query.js";

@QueryHandler(GetSummaryQuery)
export class GetSummaryHandler implements IQueryHandler<GetSummaryQuery> {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async execute(query: GetSummaryQuery): Promise<Summary> {
    await assertRepoOwnership(this.ds, query.repoId, query.userId);

    const cached = await this.analyticsCache.get<Summary>("summary", query.repoId);
    if (cached) return cached;

    const [row]: [
      {
        total_commits: string;
        total_contributors: string;
        avg_quality: string;
        cc_compliance: string;
      },
    ] = await this.ds.query(
      `SELECT count(*)::text AS total_commits,
              count(DISTINCT c.author_email)::text AS total_contributors,
              coalesce(round(avg(qs.overall_score), 2), 0)::text AS avg_quality,
              CASE WHEN count(*) = 0 THEN '0'
                   ELSE round(
                     100.0 * count(*) FILTER (WHERE qs.is_conventional) / count(*),
                     2
                   )::text
              END AS cc_compliance
         FROM commits c
         LEFT JOIN commit_quality_scores qs ON qs.commit_id = c.id
        WHERE c.repository_id = $1`,
      [query.repoId],
    );

    const result: Summary = {
      totalCommits: Number(row.total_commits),
      totalContributors: Number(row.total_contributors),
      avgQuality: Number(row.avg_quality),
      ccCompliancePercent: Number(row.cc_compliance),
    };
    await this.analyticsCache.set("summary", query.repoId, result);
    return result;
  }
}
