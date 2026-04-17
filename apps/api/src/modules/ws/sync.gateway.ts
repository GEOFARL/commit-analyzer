import type { RepositoryRepository } from "@commit-analyzer/database";
import {
  Inject,
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { createAdapter } from "@socket.io/redis-adapter";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Redis } from "ioredis";
import type { Server, Socket } from "socket.io";

import { getServerEnv } from "../../common/config.js";
import { REPOSITORY_REPOSITORY } from "../../common/database/tokens.js";
import { SUPABASE_CLIENT } from "../auth/supabase-auth.guard.js";

@WebSocketGateway({
  namespace: "/sync",
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      const { WEB_ORIGIN } = getServerEnv();
      callback(null, !origin || origin === WEB_ORIGIN);
    },
    credentials: true,
  },
})
export class SyncGateway implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy {
  private readonly logger = new Logger(SyncGateway.name);

  @WebSocketServer()
  server!: Server;

  private pub: Redis | null = null;
  private sub: Redis | null = null;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(REPOSITORY_REPOSITORY) private readonly repos: RepositoryRepository,
  ) {}

  afterInit(server: Server): void {
    // Skip Redis adapter when running in tests: app.init() without app.listen()
    // leaves the socket.io Server partially initialized.
    if (getServerEnv().NODE_ENV === "test") return;
    const { REDIS_URL } = getServerEnv();
    this.pub = new Redis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: null as never });
    this.sub = this.pub.duplicate();
    server.adapter(createAdapter(this.pub, this.sub));
    this.logger.log("ws.adapter redis attached");
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([this.pub?.quit(), this.sub?.quit()]);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as Record<string, unknown>)["token"] as string | undefined ??
        client.handshake.headers["authorization"]?.toString().replace(/^Bearer /i, "");

      if (!token) {
        this.logger.debug(`ws.connect rejected reason=missing_token id=${client.id}`);
        client.disconnect(true);
        return;
      }

      const { data, error } = await this.supabase.auth.getUser(token);
      if (error || !data?.user) {
        this.logger.debug(`ws.connect rejected reason=token_rejected id=${client.id}`);
        client.disconnect(true);
        return;
      }

      const userId = data.user.id;
      client.data = { userId } as { userId: string };
      this.logger.debug(`ws.connect accepted id=${client.id} userId=${userId}`);
    } catch (err) {
      this.logger.error(`ws.connect error id=${client.id}: ${String(err)}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage("join")
  async handleJoin(
    client: Socket,
    payload: { repositoryId: string },
  ): Promise<{ ok: boolean }> {
    const userId = (client.data as { userId?: string }).userId;
    if (!userId) {
      throw new UnauthorizedException("not authenticated");
    }

    const repo = await this.repos.findByIdForUser(payload.repositoryId, userId);
    if (!repo) {
      this.logger.debug(
        `ws.join denied userId=${userId} repositoryId=${payload.repositoryId}`,
      );
      throw new UnauthorizedException("repository not found or not owned");
    }

    const room = `repo:${payload.repositoryId}`;
    await client.join(room);
    this.logger.debug(`ws.join userId=${userId} room=${room}`);
    return { ok: true };
  }

  emitProgress(repositoryId: string, syncJobId: string, done: number, total: number): void {
    this.server.to(`repo:${repositoryId}`).emit("sync.progress", {
      repositoryId,
      syncJobId,
      commitsProcessed: done,
      totalCommits: total,
    });
  }

  emitCompleted(repositoryId: string, syncJobId: string, commitsProcessed: number): void {
    this.server.to(`repo:${repositoryId}`).emit("sync.completed", {
      repositoryId,
      syncJobId,
      commitsProcessed,
    });
  }

  emitFailed(repositoryId: string, syncJobId: string, errorMessage: string): void {
    this.server.to(`repo:${repositoryId}`).emit("sync.failed", {
      repositoryId,
      syncJobId,
      errorMessage,
    });
  }
}
