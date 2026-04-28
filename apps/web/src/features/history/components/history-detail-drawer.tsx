"use client";

import type { HistoryEntry } from "@commit-analyzer/contracts";
import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

import { HistorySuggestionCard } from "./history-suggestion-card";

type Props = {
  entry: HistoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const HistoryDetailDrawer = ({ entry, open, onOpenChange }: Props) => {
  const t = useTranslations("history");
  const format = useFormatter();
  const hasPolicyRules = Boolean(
    entry?.policyId &&
      entry.suggestions.some((s) => s.validation !== null),
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 sm:max-w-xl sm:w-[36rem]"
      >
        <SheetHeader>
          <div className="flex flex-col gap-1">
            <SheetTitle>{t("drawer.title")}</SheetTitle>
            <SheetDescription>{t("drawer.description")}</SheetDescription>
          </div>
        </SheetHeader>

        {entry ? (
          <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("drawer.metaCreated")}</dt>
              <dd>
                {format.dateTime(new Date(entry.createdAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </dd>
              <dt className="text-muted-foreground">{t("drawer.metaProvider")}</dt>
              <dd className="font-mono text-xs">{entry.provider}</dd>
              <dt className="text-muted-foreground">{t("drawer.metaModel")}</dt>
              <dd className="font-mono text-xs">{entry.model}</dd>
              <dt className="text-muted-foreground">{t("drawer.metaPolicy")}</dt>
              <dd>
                {entry.policyName ?? (
                  <Badge variant="outline">
                    {entry.policyId ? t("policy.missing") : t("policy.none")}
                  </Badge>
                )}
              </dd>
              <dt className="text-muted-foreground">{t("drawer.metaTokens")}</dt>
              <dd>{entry.tokensUsed}</dd>
            </dl>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold tracking-tight">
                {t("drawer.suggestions")}
              </h3>
              {entry.suggestions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("drawer.noSuggestions")}
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {entry.suggestions.map((suggestion, idx) => (
                    <HistorySuggestionCard
                      key={`${entry.id}-${idx}`}
                      index={idx}
                      suggestion={suggestion}
                      hasPolicyRules={hasPolicyRules}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};
