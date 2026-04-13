import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import { getServerEnv } from "./config.js";
import { createLogger } from "./logger.js";
import { buildHelmetMiddleware } from "./security/headers.js";

const DEFAULT_PORT = 3001;

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

const bootstrap = async (): Promise<void> => {
  const app = await createApp();
  const logger = createLogger();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);
  logger.info({ port }, "api listening");
};

const isEntrypoint =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/main.ts") === true ||
  process.argv[1]?.endsWith("/main.js") === true;

if (isEntrypoint) {
  void bootstrap();
}
