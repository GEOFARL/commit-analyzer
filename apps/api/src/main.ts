import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import { getServerEnv } from "./config.js";
import { buildHelmetMiddleware } from "./security/headers.js";

export const createApp = async (): Promise<NestExpressApplication> => {
  const env = getServerEnv();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
  });

  app.use(buildHelmetMiddleware(env));
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });

  return app;
};
