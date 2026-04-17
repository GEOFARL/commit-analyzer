import type {
  Contributor,
  FileChurn,
  Granularity,
  HeatmapCell,
  QualityBucket,
  QualityTrendPoint,
  Summary,
  TimelinePoint,
} from "@commit-analyzer/contracts";
import type { DataSource } from "@commit-analyzer/database";
import { Inject, Injectable } from "@nestjs/common";
import { NotFoundException } from "@nestjs/common";

import { DATA_SOURCE } from "../../common/database/tokens.js";

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(DATA_SOURCE)
    private readonly ds: DataSource,
  ) {}

  async timeline(
    repoId: string,
    userId: string,
    granularity: Granularity,
  ): Promise<TimelinePoint[]> {
    await this.assertRepoOwnership(repoId, userId);

    const trunc = granularity === "week" ? "week" : "day";
    const rows: { date: string; count: string }[] = await this.ds.query(
      `SELECT date_trunc($1, c.authored_at)::date::text AS date,
              count(*)::text AS count
         FROM commits c
        WHERE c.repository_id = $2
        GROUP BY 1
        ORDER BY 1`,
      [trunc, repoId],
    );

    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  async heatmap(repoId: string, userId: string): Promise<HeatmapCell[]> {
    await this.assertRepoOwnership(repoId, userId);

    const rows: { day: string; hour: string; count: string }[] =
      await this.ds.query(
        `SELECT extract(dow FROM c.authored_at)::int AS day,
                extract(hour FROM c.authored_at)::int AS hour,
                count(*)::text AS count
           FROM commits c
          WHERE c.repository_id = $1
          GROUP BY 1, 2
          ORDER BY 1, 2`,
        [repoId],
      );

    return rows.map((r) => ({
      day: Number(r.day),
      hour: Number(r.hour),
      count: Number(r.count),
    }));
  }

  async qualityDistribution(
    repoId: string,
    userId: string,
  ): Promise<QualityBucket[]> {
    await this.assertRepoOwnership(repoId, userId);

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
      [repoId],
    );

    return rows.map((r) => ({ bucket: r.bucket, count: Number(r.count) }));
  }

  async qualityTrend(
    repoId: string,
    userId: string,
    granularity: Granularity,
  ): Promise<QualityTrendPoint[]> {
    await this.assertRepoOwnership(repoId, userId);

    const trunc = granularity === "week" ? "week" : "day";
    const rows: { date: string; avg_score: string }[] = await this.ds.query(
      `SELECT date_trunc($1, c.authored_at)::date::text AS date,
              round(avg(qs.overall_score), 2)::text AS avg_score
         FROM commits c
         JOIN commit_quality_scores qs ON qs.commit_id = c.id
        WHERE c.repository_id = $2
        GROUP BY 1
        ORDER BY 1`,
      [trunc, repoId],
    );

    return rows.map((r) => ({
      date: r.date,
      avgScore: Number(r.avg_score),
    }));
  }

  async contributors(
    repoId: string,
    userId: string,
    limit: number,
  ): Promise<Contributor[]> {
    await this.assertRepoOwnership(repoId, userId);

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
      [repoId, limit],
    );

    return rows.map((r) => ({
      authorName: r.author_name,
      authorEmail: r.author_email,
      commitCount: Number(r.commit_count),
      avgQuality: Number(r.avg_quality),
    }));
  }

  async filesChurn(
    repoId: string,
    userId: string,
    _limit: number,
  ): Promise<FileChurn[]> {
    await this.assertRepoOwnership(repoId, userId);
    // File-level path data is not tracked yet (only filesChanged count per
    // commit). This endpoint will return results once a commit_files table
    // is introduced by a future task.
    return [];
  }

  async summary(repoId: string, userId: string): Promise<Summary> {
    await this.assertRepoOwnership(repoId, userId);

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
      [repoId],
    );

    return {
      totalCommits: Number(row.total_commits),
      totalContributors: Number(row.total_contributors),
      avgQuality: Number(row.avg_quality),
      ccCompliancePercent: Number(row.cc_compliance),
    };
  }

  private async assertRepoOwnership(
    repoId: string,
    userId: string,
  ): Promise<void> {
    const result: { id: string }[] = await this.ds.query(
      `SELECT id FROM repositories WHERE id = $1 AND user_id = $2 LIMIT 1`,
      [repoId, userId],
    );
    if (result.length === 0) {
      throw new NotFoundException("repository not found");
    }
  }
}
