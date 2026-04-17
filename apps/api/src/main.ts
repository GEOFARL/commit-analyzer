import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { IoAdapter } from "@nestjs/platform-socket.io";

import { AppModule } from "./app.module.js";
import { getServerEnv } from "./common/config.js";
import { buildHelmetMiddleware } from "./common/security/headers.js";
import { RedisIoAdapter } from "./modules/ws/redis-io.adapter.js";

export const createApp = async (): Promise<NestExpressApplication> => {
  const env = getServerEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });

  if (env.NODE_ENV === "test") {
    app.useWebSocketAdapter(new IoAdapter(app));
  } else {
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis();
    app.useWebSocketAdapter(redisIoAdapter);
  }
  app.use(buildHelmetMiddleware(env));
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  return app;
};
