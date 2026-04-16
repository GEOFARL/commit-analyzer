import { startMockServer } from "./mock-server";

export default async function globalSetup() {
  await startMockServer();
}
