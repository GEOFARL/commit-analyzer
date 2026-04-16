"use client";

import type { ApiKey } from "@commit-analyzer/contracts";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Props = {
  apiKey: ApiKey;
  isRevoking: boolean;
  onRevoke: (id: string) => void;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export const ApiKeyRow = ({ apiKey, isRevoking, onRevoke }: Props) => {
  const t = useTranslations("apiKeys");

  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">{apiKey.name}</span>
          <Badge variant="secondary" className="font-mono text-xs shrink-0">
            {apiKey.prefix}…
          </Badge>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t("created")} {formatDate(apiKey.createdAt)}
          </span>
          <span>
            {t("lastUsed")}{" "}
            {apiKey.lastUsedAt ? formatDate(apiKey.lastUsedAt) : t("never")}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => onRevoke(apiKey.id)}
        disabled={isRevoking}
      >
        {isRevoking ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {t("revoke")}
      </Button>
    </div>
  );
};
