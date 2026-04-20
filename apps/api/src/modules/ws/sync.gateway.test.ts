import "reflect-metadata";

import type { Repository as RepoEntity, RepositoryRepository } from "@commit-analyzer/database";
import { UnauthorizedException } from "@nestjs/common";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Server, Socket } from "socket.io";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SyncGateway } from "./sync.gateway.js";

vi.mock("../../common/config.js", () => ({
  getServerEnv: () => ({ WEB_ORIGIN: "http://localhost:3000" }),
}));

const USER_ID = "11111111-1111-1111-1111-111111111111";
const REPO_ID = "22222222-2222-2222-2222-222222222222";

type NextFn = (err?: Error) => void;

interface TestSocket {
  socket: Socket;
  join: ReturnType<typeof vi.fn>;
}

const makeSocket = (
  overrides: Partial<{
    auth: Record<string, unknown>;
    headers: Record<string, string>;
    data: Record<string, unknown>;
  }> = {},
): TestSocket => {
  const join = vi.fn();
  const socket = {
    id: "sock-1",
    handshake: {
      auth: overrides.auth ?? {},
      headers: overrides.headers ?? {},
    },
    data: overrides.data ?? {},
    join,
  } as unknown as Socket;
  return { socket, join };
};

describe("SyncGateway", () => {
  let supabase: { auth: { getUser: ReturnType<typeof vi.fn> } };
  let repos: { findByIdForUser: ReturnType<typeof vi.fn> };
  let gateway: SyncGateway;

  beforeEach(() => {
    supabase = { auth: { getUser: vi.fn() } };
    repos = { findByIdForUser: vi.fn() };
    gateway = new SyncGateway(
      supabase as unknown as SupabaseClient,
      repos as unknown as RepositoryRepository,
    );
  });

  describe("afterInit middleware", () => {
    it("registers a handshake middleware on the namespace server", () => {
      const use = vi.fn();
      gateway.afterInit({ use } as unknown as Server);
      expect(use).toHaveBeenCalledOnce();
    });

    it("rejects sockets without a token before any message can fire", async () => {
      const use = vi.fn();
      gateway.afterInit({ use } as unknown as Server);
      const middleware = use.mock.calls[0]![0] as (
        socket: Socket,
        next: NextFn,
      ) => void;

      const { socket } = makeSocket();
      const next = vi.fn();
      middleware(socket, next);
      await vi.waitFor(() => expect(next).toHaveBeenCalled());

      const err = next.mock.calls[0]![0] as Error;
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toBe("missing token");
      expect(supabase.auth.getUser).not.toHaveBeenCalled();
    });

    it("rejects sockets whose token Supabase can't validate", async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "jwt expired" },
      });
      const use = vi.fn();
      gateway.afterInit({ use } as unknown as Server);
      const middleware = use.mock.calls[0]![0] as (
        socket: Socket,
        next: NextFn,
      ) => void;

      const { socket } = makeSocket({ auth: { token: "bad.jwt" } });
      const next = vi.fn();
      middleware(socket, next);
      await vi.waitFor(() => expect(next).toHaveBeenCalled());

      const err = next.mock.calls[0]![0] as Error;
      expect(err.message).toBe("invalid token");
    });

    it("sets userId on the socket BEFORE next() is called", async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      });
      const use = vi.fn();
      gateway.afterInit({ use } as unknown as Server);
      const middleware = use.mock.calls[0]![0] as (
        socket: Socket,
        next: NextFn,
      ) => void;

      const { socket } = makeSocket({ auth: { token: "good.jwt" } });
      const next = vi.fn(() => {
        // Guarantees Nest's @SubscribeMessage handlers — bound right after
        // middleware resolves — will see a populated socket.data.
        expect((socket.data as { userId?: string }).userId).toBe(USER_ID);
      });
      middleware(socket, next);
      await vi.waitFor(() => expect(next).toHaveBeenCalledWith());
    });

    it("accepts `authorization: Bearer <token>` header in addition to auth.token", async () => {
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      });
      const use = vi.fn();
      gateway.afterInit({ use } as unknown as Server);
      const middleware = use.mock.calls[0]![0] as (
        socket: Socket,
        next: NextFn,
      ) => void;

      const { socket } = makeSocket({
        headers: { authorization: "Bearer hdr.jwt" },
      });
      const next = vi.fn();
      middleware(socket, next);
      await vi.waitFor(() => expect(next).toHaveBeenCalledWith());
      expect(supabase.auth.getUser).toHaveBeenCalledWith("hdr.jwt");
    });
  });

  describe("handleJoin", () => {
    it("joins repo:<id> when userId is set and repo is owned", async () => {
      repos.findByIdForUser.mockResolvedValue({ id: REPO_ID } as RepoEntity);
      const { socket, join } = makeSocket({ data: { userId: USER_ID } });

      const result = await gateway.handleJoin(socket, { repositoryId: REPO_ID });

      expect(result).toEqual({ ok: true });
      expect(repos.findByIdForUser).toHaveBeenCalledWith(REPO_ID, USER_ID);
      expect(join).toHaveBeenCalledWith(`repo:${REPO_ID}`);
    });

    it("throws when socket.data.userId is missing (pre-fix regression guard)", async () => {
      const { socket, join } = makeSocket({ data: {} });
      await expect(
        gateway.handleJoin(socket, { repositoryId: REPO_ID }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(repos.findByIdForUser).not.toHaveBeenCalled();
      expect(join).not.toHaveBeenCalled();
    });

    it("throws when repo is not owned by user", async () => {
      repos.findByIdForUser.mockResolvedValue(null);
      const { socket, join } = makeSocket({ data: { userId: USER_ID } });

      await expect(
        gateway.handleJoin(socket, { repositoryId: REPO_ID }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(join).not.toHaveBeenCalled();
    });
  });
});
