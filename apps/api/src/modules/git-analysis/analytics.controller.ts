import { analyticsContract, type Summary } from "@commit-analyzer/contracts";
import { Controller, Get, UseGuards } from "@nestjs/common";
import { QueryBus } from "@nestjs/cqrs";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { ThrottleTierDecorator } from "../../common/throttler/throttle-tier.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";

import { GetContributorsQuery } from "./queries/get-contributors.query.js";
import { GetFileFrequencyQuery } from "./queries/get-file-frequency.query.js";
import { GetHeatmapQuery } from "./queries/get-heatmap.query.js";
import { GetQualityScoresQuery } from "./queries/get-quality-scores.query.js";
import { GetQualityTrendsQuery } from "./queries/get-quality-trends.query.js";
import { GetSummaryQuery } from "./queries/get-summary.query.js";
import { GetTimelineQuery } from "./queries/get-timeline.query.js";
import { AnalyticsCacheService } from "./services/analytics-cache.service.js";

@Controller()
@UseGuards(SupabaseAuthGuard)
@ThrottleTierDecorator("analytics")
export class AnalyticsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly analyticsCache: AnalyticsCacheService,
  ) {}

  @Get("analytics/cache-metrics")
  cacheMetrics(): Promise<{ hits: number; misses: number; hitRate: number }> {
    return this.analyticsCache.metrics();
  }

  @TsRestHandler(analyticsContract.timeline)
  timeline(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.timeline, async ({ params, query }) => ({
      status: 200 as const,
      body: {
        items: await this.queryBus.execute(
          new GetTimelineQuery(params.repoId, userId, query.granularity),
        ),
      },
    }));
  }

  @TsRestHandler(analyticsContract.heatmap)
  heatmap(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.heatmap, async ({ params }) => ({
      status: 200 as const,
      body: {
        items: await this.queryBus.execute(
          new GetHeatmapQuery(params.repoId, userId),
        ),
      },
    }));
  }

  @TsRestHandler(analyticsContract.qualityScores)
  qualityScores(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.qualityScores, async ({ params }) => ({
      status: 200 as const,
      body: {
        items: await this.queryBus.execute(
          new GetQualityScoresQuery(params.repoId, userId),
        ),
      },
    }));
  }

  @TsRestHandler(analyticsContract.qualityTrends)
  qualityTrends(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.qualityTrends, async ({ params, query }) => ({
      status: 200 as const,
      body: {
        items: await this.queryBus.execute(
          new GetQualityTrendsQuery(params.repoId, userId, query.granularity),
        ),
      },
    }));
  }

  @TsRestHandler(analyticsContract.contributors)
  contributors(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.contributors, async ({ params, query }) => ({
      status: 200 as const,
      body: {
        items: await this.queryBus.execute(
          new GetContributorsQuery(params.repoId, userId, query.limit),
        ),
      },
    }));
  }

  @TsRestHandler(analyticsContract.fileFrequency)
  fileFrequency(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.fileFrequency, async ({ params, query }) => ({
      status: 200 as const,
      body: {
        items: await this.queryBus.execute(
          new GetFileFrequencyQuery(params.repoId, userId, query.limit),
        ),
      },
    }));
  }

  @TsRestHandler(analyticsContract.summary)
  getSummary(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.summary, async ({ params }) => ({
      status: 200 as const,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
      body: (await this.queryBus.execute(
        new GetSummaryQuery(params.repoId, userId),
      )) as Summary,
    }));
  }
}
