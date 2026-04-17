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
    // TODO: T-X.Y — file-level path data not tracked yet (only filesChanged
    // count per commit). Returns results once a commit_files table is added.
    return [];
  }
}
