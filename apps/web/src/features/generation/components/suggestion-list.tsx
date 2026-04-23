"use client";

import type { SuggestionFrame } from "@commit-analyzer/contracts";
import { Loader2, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { SuggestionCard } from "./suggestion-card";

type Props = {
  suggestions: SuggestionFrame[];
  streaming: boolean;
  empty: boolean;
};

export const SuggestionList = ({ suggestions, streaming, empty }: Props) => {
  const t = useTranslations("generate.list");

  if (suggestions.length === 0) {
    if (streaming) {
      return (
        <div
          className="flex items-center gap-2 rounded-lg border border-dashed p-6 text-sm text-muted-foreground"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("streamingEmpty")}
        </div>
      );
    }
    if (empty) {
      return (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center">
          <Sparkles
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm font-medium">{t("idleTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("idleHint")}</p>
        </div>
      );
    }
    return null;
  }

  const sorted = [...suggestions].sort((a, b) => a.index - b.index);

  return (
    <div
      className="flex flex-col gap-3"
      aria-live="polite"
      aria-busy={streaming}
    >
      {sorted.map((s) => (
        <SuggestionCard key={s.index} suggestion={s} />
      ))}
      {streaming ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t("streamingMore")}
        </div>
      ) : null}
    </div>
  );
};
