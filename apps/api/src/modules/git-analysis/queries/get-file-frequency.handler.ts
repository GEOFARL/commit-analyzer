import type { FileFrequency } from "@commit-analyzer/contracts";
import type { DataSource } from "@commit-analyzer/database";
import { Inject } from "@nestjs/common";
import { QueryHandler, type IQueryHandler } from "@nestjs/cqrs";

import { DATA_SOURCE } from "../../../common/database/tokens.js";
import { assertRepoOwnership } from "../repo-ownership.js";
import { AnalyticsCacheService } from "../services/analytics-cache.service.js";

import { GetFileFrequencyQuery } from "./get-file-frequency.query.js";

@QueryHandler(GetFileFrequencyQuery)
export class GetFileFrequencyHandler implements IQueryHandler<GetFileFrequencyQuery> {
  constructor(
    @Inject(DATA_SOURCE) private readonly ds: DataSource,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  async execute(query: GetFileFrequencyQuery): Promise<FileFrequency[]> {
    await assertRepoOwnership(this.ds, query.repoId, query.userId);

    return this.analyticsCache.getOrSet(
      "files",
      query.repoId,
      async () => {
        // COUNT(DISTINCT cf.commit_id) guards against GitHub's occasional
        // duplicate file entries in split-rename responses.
        const rows: {
          file_path: string;
          change_count: string;
        }[] = await this.ds.query(
          `SELECT cf.file_path,
                  COUNT(DISTINCT cf.commit_id)::text AS change_count
             FROM commit_files cf
             JOIN commits c ON c.id = cf.commit_id
            WHERE c.repository_id = $1
            GROUP BY cf.file_path
            ORDER BY COUNT(DISTINCT cf.commit_id) DESC, cf.file_path ASC
            LIMIT $2`,
          [query.repoId, query.limit],
        );
        return rows.map((r) => ({
          filePath: r.file_path,
          changeCount: Number(r.change_count),
        }));
      },
      String(query.limit),
    );
  }
}
