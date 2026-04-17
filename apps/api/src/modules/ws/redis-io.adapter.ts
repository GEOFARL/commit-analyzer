import type { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Redis } from "ioredis";
import type { ServerOptions } from "socket.io";

import { getServerEnv } from "../../common/config.js";

export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: ReturnType<typeof createAdapter>;
  private pub?: Redis;
  private sub?: Redis;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<void> {
    const { REDIS_URL } = getServerEnv();
    this.pub = new Redis(REDIS_URL, { maxRetriesPerRequest: null as never });
    this.sub = this.pub.duplicate();
    await Promise.all([
      this.pub.status === "ready" ? Promise.resolve() : new Promise<void>((resolve) => this.pub!.once("ready", resolve)),
      this.sub.status === "ready" ? Promise.resolve() : new Promise<void>((resolve) => this.sub!.once("ready", resolve)),
    ]);
    this.adapterConstructor = createAdapter(this.pub, this.sub);
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options) as {
      adapter: (constructor: ReturnType<typeof createAdapter>) => void;
    };
    if (this.adapterConstructor) {
      server.adapter(this.adapterConstructor);
    }
    return server;
  }

  override async close(): Promise<void> {
    await Promise.all([this.pub?.quit(), this.sub?.quit()]);
  }
}
