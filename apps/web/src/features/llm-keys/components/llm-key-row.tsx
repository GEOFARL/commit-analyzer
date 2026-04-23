"use client";

import type { LlmApiKey } from "@commit-analyzer/contracts";
import { Loader2, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  llmKey: LlmApiKey;
  isDeleting: boolean;
  onDelete: (provider: LlmApiKey["provider"]) => void;
};

export const LlmKeyRow = ({ llmKey, isDeleting, onDelete }: Props) => {
  const t = useTranslations("llmKeys");
  const locale = useLocale();

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));

  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors sm:gap-4 sm:p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-sm sm:text-base">
            {t(`providers.${llmKey.provider}`)}
          </span>
          <Badge variant="secondary" className="font-mono text-xs shrink-0">
            {llmKey.maskedKey}
          </Badge>
          <Badge
            variant={llmKey.status === "ok" ? "default" : "secondary"}
            className="text-xs shrink-0"
          >
            {t(`status.${llmKey.status}`)}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t("created")} {formatDate(llmKey.createdAt)}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => onDelete(llmKey.provider)}
        disabled={isDeleting}
        aria-label={t("delete")}
      >
        {isDeleting ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 aria-hidden="true" />
        )}
        <span className="hidden sm:inline">{t("delete")}</span>
      </Button>
    </div>
  );
};
