import { analyticsContract } from "@commit-analyzer/contracts";
import { Controller, UseGuards } from "@nestjs/common";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";

import { ThrottleTierDecorator } from "../../common/throttler/throttle-tier.decorator.js";
import { CurrentUser } from "../auth/current-user.decorator.js";
import { SupabaseAuthGuard } from "../auth/supabase-auth.guard.js";

import { AnalyticsService } from "./analytics.service.js";

@Controller()
@UseGuards(SupabaseAuthGuard)
@ThrottleTierDecorator("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @TsRestHandler(analyticsContract.timeline)
  timeline(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.timeline, async ({ params, query }) => ({
      status: 200 as const,
      body: { items: await this.analytics.timeline(params.repoId, userId, query.granularity) },
    }));
  }

  @TsRestHandler(analyticsContract.heatmap)
  heatmap(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.heatmap, async ({ params }) => ({
      status: 200 as const,
      body: { items: await this.analytics.heatmap(params.repoId, userId) },
    }));
  }

  @TsRestHandler(analyticsContract.qualityDistribution)
  qualityDistribution(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.qualityDistribution, async ({ params }) => ({
      status: 200 as const,
      body: { items: await this.analytics.qualityDistribution(params.repoId, userId) },
    }));
  }

  @TsRestHandler(analyticsContract.qualityTrend)
  qualityTrend(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.qualityTrend, async ({ params, query }) => ({
      status: 200 as const,
      body: { items: await this.analytics.qualityTrend(params.repoId, userId, query.granularity) },
    }));
  }

  @TsRestHandler(analyticsContract.contributors)
  contributors(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.contributors, async ({ params, query }) => ({
      status: 200 as const,
      body: { items: await this.analytics.contributors(params.repoId, userId, query.limit) },
    }));
  }

  @TsRestHandler(analyticsContract.filesChurn)
  filesChurn(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.filesChurn, async ({ params, query }) => ({
      status: 200 as const,
      body: { items: await this.analytics.filesChurn(params.repoId, userId, query.limit) },
    }));
  }

  @TsRestHandler(analyticsContract.summary)
  getSummary(@CurrentUser() userId: string): unknown {
    return tsRestHandler(analyticsContract.summary, async ({ params }) => ({
      status: 200 as const,
      body: await this.analytics.summary(params.repoId, userId),
    }));
  }
}
