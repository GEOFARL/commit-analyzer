"use client";

import type { HistoryEntry } from "@commit-analyzer/contracts";
import { ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";

type Props = {
  entry: HistoryEntry;
  onSelect: (id: string) => void;
};

const statusVariant = (
  status: HistoryEntry["status"],
): "success" | "destructive" | "secondary" => {
  if (status === "completed") return "success";
  if (status === "failed" || status === "cancelled") return "destructive";
  return "secondary";
};

export const HistoryRow = ({ entry, onSelect }: Props) => {
  const t = useTranslations("history");
  const format = useFormatter();

  const previewSuggestion = entry.suggestions[0];
  const previewHeader = previewSuggestion
    ? previewSuggestion.scope
      ? `${previewSuggestion.type}(${previewSuggestion.scope}): ${previewSuggestion.subject}`
      : `${previewSuggestion.type}: ${previewSuggestion.subject}`
    : "—";
  const moreCount = Math.max(0, entry.suggestions.length - 1);

  return (
    <button
      type="button"
      onClick={() => onSelect(entry.id)}
      className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={t("table.viewDetails")}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {format.dateTime(new Date(entry.createdAt), {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{entry.provider}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">{entry.model}</span>
          {entry.repositoryFullName ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{entry.repositoryFullName}</span>
            </>
          ) : null}
        </div>
        <p className="break-words font-mono text-sm font-medium">
          {previewHeader}
          {moreCount > 0 ? (
            <span className="ml-2 text-xs text-muted-foreground">
              {t("preview.more", { count: moreCount })}
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant(entry.status)}>
            {t(`status.${entry.status}`)}
          </Badge>
          {entry.policyName ? (
            <Badge variant="outline">{entry.policyName}</Badge>
          ) : (
            <Badge variant="outline">
              {entry.policyId ? t("policy.missing") : t("policy.none")}
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
};
