"use client";

import { AlertCircle, Loader2, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
      <div
        role="alert"
        className={cn(
          "flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
          />
          <div className="flex flex-col">
            <span className="font-medium text-destructive">
              {t("failed.title")}
            </span>
            {state.errorMessage ? (
              <span className="text-muted-foreground">
                {state.errorMessage}
              </span>
            ) : (
              <span className="text-muted-foreground">
                {t("failed.subtitle")}
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={retry}
          disabled={resync.isPending}
          className="self-start sm:self-center"
        >
          <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
          {resync.isPending ? t("retry.pending") : t("retry.label")}
        </Button>
      </div>
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
