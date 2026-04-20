"use client";

import { Loader2, RefreshCcw } from "lucide-react";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useResyncRepoMutation } from "../hooks";

import { useSyncProgressContext } from "./sync-progress-context";

interface SyncNowButtonProps {
  repoId: string;
  lastSyncedAt: string | null;
  className?: string;
}

export const SyncNowButton = ({
  repoId,
  lastSyncedAt,
  className,
}: SyncNowButtonProps) => {
  const t = useTranslations("sync");
  const format = useFormatter();
  // Refresh the relative-time label every minute so "Last synced 2m ago" stays
  // accurate without a full page reload.
  const now = useNow({ updateInterval: 60_000 });
  const resync = useResyncRepoMutation();
  const { state, markEnqueued } = useSyncProgressContext();

  const isRunning = state.status === "syncing";
  const isPending = resync.isPending || isRunning;

  const onClick = () => {
    resync.mutate(
      { params: { repoId }, body: {} },
      {
        onSuccess: () => {
          markEnqueued();
          toast.info(t("toast.queued"));
        },
        onError: () => {
          toast.error(t("toast.queueError"));
        },
      },
    );
  };

  const lastSyncedLabel = lastSyncedAt
    ? t("lastSynced.label", {
        time: format.relativeTime(new Date(lastSyncedAt), now),
      })
    : t("lastSynced.never");

  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3",
        className,
      )}
    >
      <span className="text-xs text-muted-foreground tabular-nums">
        {lastSyncedLabel}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onClick}
        disabled={isPending}
        aria-label={t("syncNow.ariaLabel")}
      >
        {isPending ? (
          <Loader2
            className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        {isPending ? t("syncNow.pending") : t("syncNow.label")}
      </Button>
    </div>
  );
};
