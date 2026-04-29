import { startMockServer, stopMockServer } from "../e2e/mock-server";

await startMockServer();
process.stdout.write("mock-server-ready\n");

const shutdown = async (): Promise<void> => {
  await stopMockServer();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
