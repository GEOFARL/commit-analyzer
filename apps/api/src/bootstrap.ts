import { createLogger } from "./common/logger.js";
import { createApp } from "./main.js";

const DEFAULT_PORT = 4000;

const bootstrap = async (): Promise<void> => {
  const app = await createApp();
  const logger = createLogger();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  await app.listen(port);
  logger.info({ port }, "api listening");
};

void bootstrap();
