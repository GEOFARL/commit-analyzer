import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { AuthModule } from "../auth/auth.module.js";

import { AnalyticsController } from "./analytics.controller.js";
import { OnRepositorySyncedHandler } from "./events/on-repository-synced.handler.js";
import { GetContributorsHandler } from "./queries/get-contributors.handler.js";
import { GetFileFrequencyHandler } from "./queries/get-file-frequency.handler.js";
import { GetHeatmapHandler } from "./queries/get-heatmap.handler.js";
import { GetQualityScoresHandler } from "./queries/get-quality-scores.handler.js";
import { GetQualityTrendsHandler } from "./queries/get-quality-trends.handler.js";
import { GetSummaryHandler } from "./queries/get-summary.handler.js";
import { GetTimelineHandler } from "./queries/get-timeline.handler.js";
import { AnalyticsCacheService } from "./services/analytics-cache.service.js";

const QUERY_HANDLERS = [
  GetTimelineHandler,
  GetHeatmapHandler,
  GetQualityScoresHandler,
  GetQualityTrendsHandler,
  GetContributorsHandler,
  GetFileFrequencyHandler,
  GetSummaryHandler,
];

const EVENT_HANDLERS = [OnRepositorySyncedHandler];

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsCacheService, ...QUERY_HANDLERS, ...EVENT_HANDLERS],
})
export class GitAnalysisModule {}
