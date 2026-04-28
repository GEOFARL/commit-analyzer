"use client";

import type { HistorySuggestion } from "@commit-analyzer/contracts";
import { CheckCircle2, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { formatSuggestionHeader } from "@/lib/commit-format";

type Props = {
  index: number;
  suggestion: HistorySuggestion;
  hasPolicyRules: boolean;
};

export const HistorySuggestionCard = ({
  index,
  suggestion,
  hasPolicyRules,
}: Props) => {
  const t = useTranslations("history");
  const header = formatSuggestionHeader(suggestion);

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            #{index + 1}
          </span>
          <p className="break-words font-mono text-sm font-medium">{header}</p>
        </div>
        <Badge
          variant={suggestion.compliant ? "success" : "destructive"}
          className="shrink-0 gap-1"
        >
          {suggestion.compliant ? (
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          ) : (
            <XCircle className="h-3 w-3" aria-hidden="true" />
          )}
          {suggestion.compliant
            ? t("compliance.compliant")
            : t("compliance.nonCompliant")}
        </Badge>
      </div>

      {suggestion.body ? (
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          {suggestion.body}
        </pre>
      ) : null}
      {suggestion.footer ? (
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          {suggestion.footer}
        </pre>
      ) : null}

      {hasPolicyRules ? (
        suggestion.validation && suggestion.validation.results.length > 0 ? (
          <div className="flex flex-col gap-2">
            <ul
              className="flex flex-wrap gap-2"
              aria-label={t("drawer.rules")}
            >
              {suggestion.validation.results.map((result, ruleIdx) => (
                <li key={`${result.ruleType}-${ruleIdx}`}>
                  <Badge
                    variant={result.passed ? "success" : "destructive"}
                    className="gap-1"
                    title={
                      result.message
                        ? `${result.message} — ${t("drawer.revalidationNote")}`
                        : t("drawer.revalidationNote")
                    }
                  >
                    {result.passed ? (
                      <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-3 w-3" aria-hidden="true" />
                    )}
                    {result.ruleType}
                  </Badge>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t("drawer.revalidationNote")}
            </p>
          </div>
        ) : null
      ) : (
        <p className="text-xs text-muted-foreground">{t("drawer.noRules")}</p>
      )}
    </article>
  );
};
