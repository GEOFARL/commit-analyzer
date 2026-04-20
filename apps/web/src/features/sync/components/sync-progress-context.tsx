"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { analyticsQueryKeyPrefix } from "@/lib/query-keys/analytics";

import { useSyncProgress, type SyncProgressState } from "../hooks";

interface SyncProgressContextValue {
  state: SyncProgressState;
  /**
   * Optimistically transition the banner/button to a "syncing" state right after
   * the resync mutation returns 202 — the first WebSocket progress event can lag
   * the HTTP response by hundreds of ms, and without this nudge the UI briefly
   * snaps back to idle and looks broken.
   */
  markEnqueued: () => void;
}

const SyncProgressContext = createContext<SyncProgressContextValue | null>(null);

const ENQUEUED_FALLBACK_STATE: SyncProgressState = {
  status: "syncing",
  commitsProcessed: 0,
  totalCommits: 0,
  errorMessage: null,
  syncJobId: null,
};

interface SyncProgressProviderProps {
  repoId: string;
  children: ReactNode;
}

export const SyncProgressProvider = ({
  repoId,
  children,
}: SyncProgressProviderProps) => {
  const t = useTranslations("sync");
  const queryClient = useQueryClient();
  const [optimisticEnqueued, setOptimisticEnqueued] = useState(false);

  const live = useSyncProgress(repoId, {
    onCompleted: () => {
      setOptimisticEnqueued(false);
      toast.success(t("toast.completed"));
      void queryClient.invalidateQueries({
        queryKey: [...analyticsQueryKeyPrefix(repoId)],
      });
    },
    onFailed: () => {
      setOptimisticEnqueued(false);
      toast.error(t("toast.failed"));
    },
  });

  useEffect(() => {
    if (live.status !== "idle") setOptimisticEnqueued(false);
  }, [live.status]);

  useEffect(() => {
    setOptimisticEnqueued(false);
  }, [repoId]);

  const value = useMemo<SyncProgressContextValue>(() => {
    const state =
      optimisticEnqueued && live.status === "idle"
        ? ENQUEUED_FALLBACK_STATE
        : live;
    return { state, markEnqueued: () => setOptimisticEnqueued(true) };
  }, [live, optimisticEnqueued]);

  return (
    <SyncProgressContext.Provider value={value}>
      {children}
    </SyncProgressContext.Provider>
  );
};

export const useSyncProgressContext = (): SyncProgressContextValue => {
  const ctx = useContext(SyncProgressContext);
  if (!ctx) {
    throw new Error(
      "useSyncProgressContext must be used inside <SyncProgressProvider>",
    );
  }
  return ctx;
};
