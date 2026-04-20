import type { RepositoryRepository } from "@commit-analyzer/database";
import {
  Inject,
  Logger,
  OnModuleDestroy,
  UnauthorizedException,
} from "@nestjs/common";
import {
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { SupabaseClient } from "@supabase/supabase-js";
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
export class SyncGateway implements OnGatewayInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    @Inject(REPOSITORY_REPOSITORY) private readonly repos: RepositoryRepository,
  ) {}

  afterInit(server: Server): void {
    // Auth runs as Socket.IO middleware during handshake — if we put it in
    // handleConnection (async), Nest binds @SubscribeMessage handlers
    // synchronously right after firing the connection subject, so the
    // client's `join` emit can race past `supabase.auth.getUser` and find
    // `socket.data.userId` still unset. That throws in handleJoin, the
    // socket never joins the repo room, and progress events are dropped.
    server.use((socket, next) => {
      void this.authenticate(socket, next);
    });
    this.logger.log("ws.gateway initialized");
  }

  async onModuleDestroy(): Promise<void> {
    // Redis pub/sub clients are owned by RedisIoAdapter; its close() handles cleanup.
  }

  private async authenticate(
    socket: Socket,
    next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const token =
        ((socket.handshake.auth as Record<string, unknown>)["token"] as
          | string
          | undefined) ??
        socket.handshake.headers["authorization"]
          ?.toString()
          .replace(/^Bearer /i, "");

      if (!token) {
        this.logger.debug(`ws.connect rejected reason=missing_token id=${socket.id}`);
        next(new Error("missing token"));
        return;
      }

      const { data, error } = await this.supabase.auth.getUser(token);
      if (error || !data?.user) {
        this.logger.debug(`ws.connect rejected reason=token_rejected id=${socket.id}`);
        next(new Error("invalid token"));
        return;
      }

      socket.data = { userId: data.user.id } as { userId: string };
      this.logger.debug(`ws.connect accepted id=${socket.id} userId=${data.user.id}`);
      next();
    } catch (err) {
      this.logger.error(`ws.connect error id=${socket.id}: ${String(err)}`);
      next(new Error("auth error"));
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
