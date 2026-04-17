import type { Contributor } from "@commit-analyzer/contracts";
import type { DataSource } from "@commit-analyzer/database";
import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { DATA_SOURCE } from "../../../common/database/tokens.js";
import { assertRepoOwnership } from "../repo-ownership.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

import { GetContributorsQuery } from "./get-contributors.query.js";

@QueryHandler(GetContributorsQuery)
export class GetContributorsHandler implements IQueryHandler<GetContributorsQuery> {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async execute(query: GetContributorsQuery): Promise<Contributor[]> {
    await assertRepoOwnership(this.ds, query.repoId, query.userId);

    return this.analyticsCache.getOrSet(
      "contributors",
      query.repoId,
      async () => {
        const rows: {
          author_name: string;
          author_email: string;
          commit_count: string;
          avg_quality: string;
        }[] = await this.ds.query(
          `SELECT c.author_name,
                  c.author_email,
                  count(*)::text AS commit_count,
                  coalesce(round(avg(qs.overall_score), 2), 0)::text AS avg_quality
             FROM commits c
             LEFT JOIN commit_quality_scores qs ON qs.commit_id = c.id
            WHERE c.repository_id = $1
            GROUP BY c.author_name, c.author_email
            ORDER BY count(*) DESC
            LIMIT $2`,
          [query.repoId, query.limit],
        );
        return rows.map((r) => ({
          authorName: r.author_name,
          authorEmail: r.author_email,
          commitCount: Number(r.commit_count),
          avgQuality: Number(r.avg_quality),
        }));
      },
      String(query.limit),
    );
  }
}
