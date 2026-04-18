"use client";

import {
  SYNC_EVENT_NAMES,
  SYNC_WS_NAMESPACE,
  syncCompletedPayloadSchema,
  syncFailedPayloadSchema,
  syncProgressPayloadSchema,
  type SyncCompletedPayload,
  type SyncFailedPayload,
  type SyncProgressPayload,
} from "@commit-analyzer/contracts";
import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { tsr } from "@/lib/api/tsr";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type SyncStatus = "idle" | "syncing" | "completed" | "failed";

export interface SyncProgressState {
  status: SyncStatus;
  commitsProcessed: number;
  totalCommits: number;
  errorMessage: string | null;
  syncJobId: string | null;
}

const INITIAL_STATE: SyncProgressState = {
  status: "idle",
  commitsProcessed: 0,
  totalCommits: 0,
  errorMessage: null,
  syncJobId: null,
};

const resolveWsBaseUrl = (): string => {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? "";
  if (!raw && process.env.NODE_ENV !== "production") {
    // Without an explicit API URL the client defaults to same-origin, which
    // silently breaks in dev where web (:3000) and api (:3001) run on
    // different ports. Surface this rather than letting the user watch a
    // banner that never progresses.
    console.warn(
      "[sync] NEXT_PUBLIC_API_URL is not set; WebSocket will fall back to same-origin.",
    );
  }
  return raw.replace(/\/+$/, "");
};

interface UseSyncProgressOptions {
  onCompleted?: (payload: SyncCompletedPayload) => void;
  onFailed?: (payload: SyncFailedPayload) => void;
}

/**
 * Subscribes to sync events for a single repository over the `/sync` Socket.io
 * namespace. Re-joins the repo room automatically on reconnect and resets
 * state when `repoId` changes so a previous repo's banner doesn't leak.
 */
export const useSyncProgress = (
  repoId: string,
  options: UseSyncProgressOptions = {},
): SyncProgressState => {
  const [state, setState] = useState<SyncProgressState>(INITIAL_STATE);
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  useEffect(() => {
    if (!repoId) return;

    setState(INITIAL_STATE);

    let disposed = false;
    let socket: Socket | null = null;

    const connect = async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token || disposed) return;

      const base = resolveWsBaseUrl();
      const url = `${base}${SYNC_WS_NAMESPACE}`;

      socket = io(url, {
        auth: { token },
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1_000,
        reconnectionDelayMax: 10_000,
      });

      const joinRoom = () => {
        socket?.emit("join", { repositoryId: repoId });
      };

      socket.on("connect", joinRoom);

      socket.on(SYNC_EVENT_NAMES.progress, (raw: unknown) => {
        const parsed = syncProgressPayloadSchema.safeParse(raw);
        if (!parsed.success || parsed.data.repositoryId !== repoId) return;
        const payload: SyncProgressPayload = parsed.data;
        setState({
          status: "syncing",
          commitsProcessed: payload.commitsProcessed,
          totalCommits: payload.totalCommits,
          errorMessage: null,
          syncJobId: payload.syncJobId,
        });
      });

      socket.on(SYNC_EVENT_NAMES.completed, (raw: unknown) => {
        const parsed = syncCompletedPayloadSchema.safeParse(raw);
        if (!parsed.success || parsed.data.repositoryId !== repoId) return;
        const payload: SyncCompletedPayload = parsed.data;
        setState((prev) => ({
          status: "completed",
          commitsProcessed: payload.commitsProcessed,
          totalCommits: Math.max(prev.totalCommits, payload.commitsProcessed),
          errorMessage: null,
          syncJobId: payload.syncJobId,
        }));
        callbacksRef.current.onCompleted?.(payload);
      });

      socket.on(SYNC_EVENT_NAMES.failed, (raw: unknown) => {
        const parsed = syncFailedPayloadSchema.safeParse(raw);
        if (!parsed.success || parsed.data.repositoryId !== repoId) return;
        const payload: SyncFailedPayload = parsed.data;
        setState((prev) => ({
          status: "failed",
          commitsProcessed: prev.commitsProcessed,
          totalCommits: prev.totalCommits,
          errorMessage: payload.errorMessage,
          syncJobId: payload.syncJobId,
        }));
        callbacksRef.current.onFailed?.(payload);
      });
    };

    void connect();

    return () => {
      disposed = true;
      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
      }
    };
  }, [repoId]);

  return state;
};

export const useResyncRepoMutation = () => tsr.repos.resync.useMutation();
