import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { CqrsModule } from "@nestjs/cqrs";

import { getServerEnv } from "../../common/config.js";
import { OctokitModule } from "../octokit/octokit.module.js";

import { RescoreProcessor } from "./processors/rescore.processor.js";
import { SyncProcessor } from "./processors/sync.processor.js";
import { RESCORE_QUEUE } from "./queues/rescore.queue.js";
import { SYNC_QUEUE } from "./queues/sync.queue.js";
import { QueueService } from "./services/queue.service.js";

@Module({
  imports: [
    CqrsModule,
    OctokitModule,
    BullModule.forRootAsync({
      useFactory: () => {
        const { REDIS_URL } = getServerEnv();
        return { connection: { lazyConnect: true, maxRetriesPerRequest: null }, url: REDIS_URL };
      },
    }),
    BullModule.registerQueue({ name: SYNC_QUEUE }),
    BullModule.registerQueue({ name: RESCORE_QUEUE }),
  ],
  providers: [SyncProcessor, RescoreProcessor, QueueService],
  exports: [QueueService],
})
export class JobsModule {}
