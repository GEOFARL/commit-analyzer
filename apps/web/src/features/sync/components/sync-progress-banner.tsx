"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";

import { useResyncRepoMutation, type SyncProgressState } from "../hooks";

import { useSyncProgressContext } from "./sync-progress-context";

interface SyncProgressBannerProps {
  repoId: string;
  className?: string;
}

const computePercent = (state: SyncProgressState): number => {
  if (state.totalCommits <= 0) return 0;
  const pct = (state.commitsProcessed / state.totalCommits) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
};

export const SyncProgressBanner = ({
  repoId,
  className,
}: SyncProgressBannerProps) => {
  const t = useTranslations("sync");
  const resync = useResyncRepoMutation();
  const { state, markEnqueued } = useSyncProgressContext();

  if (state.status === "idle" || state.status === "completed") {
    return null;
  }

  if (state.status === "failed") {
    const retry = () => {
      resync.mutate(
        { params: { repoId }, body: {} },
        {
          onSuccess: () => {
            markEnqueued();
            toast.info(t("toast.retryQueued"));
          },
          onError: () => {
            toast.error(t("toast.retryError"));
          },
        },
      );
    };

    return (
      <ErrorState
        title={t("failed.title")}
        description={state.errorMessage ?? t("failed.subtitle")}
        onRetry={retry}
        retryDisabled={resync.isPending}
        retryLabel={resync.isPending ? t("retry.pending") : t("retry.label")}
        className={className}
      />
    );
  }

  const percent = computePercent(state);
  const stage =
    state.totalCommits > 0 ? t("stage.syncing") : t("stage.starting");
  const valueText =
    state.totalCommits > 0
      ? t("progress.valueText", {
          percent,
          done: state.commitsProcessed,
          total: state.totalCommits,
        })
      : t("stage.starting");

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border bg-muted/40 p-4 text-sm",
        className,
      )}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-foreground">
          <Loader2
            className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none"
            aria-hidden="true"
          />
          <span className="font-medium">{stage}</span>
          {state.totalCommits > 0 && (
            <span className="text-muted-foreground tabular-nums">
              {t("progress.counts", {
                done: state.commitsProcessed,
                total: state.totalCommits,
              })}
            </span>
          )}
        </div>
        <span
          className="font-medium tabular-nums text-muted-foreground"
          aria-hidden="true"
        >
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={valueText}
        aria-label={t("progress.ariaLabel")}
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
