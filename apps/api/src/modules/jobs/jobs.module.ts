import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";

import { getServerEnv } from "../../common/config.js";

import { SyncProcessor } from "./processors/sync.processor.js";
import { SYNC_QUEUE } from "./queues/sync.queue.js";
import { QueueService } from "./services/queue.service.js";

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: () => {
        const { REDIS_URL } = getServerEnv();
        return { connection: { lazyConnect: true, maxRetriesPerRequest: null }, url: REDIS_URL };
      },
    }),
    BullModule.registerQueue({ name: SYNC_QUEUE }),
  ],
  providers: [SyncProcessor, QueueService],
  exports: [QueueService],
})
export class JobsModule {}
