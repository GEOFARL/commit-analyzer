"use client";

import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link, useRouter } from "@/i18n/navigation";
import { QUICK_GENERATE_DIFF_STORAGE_KEY } from "@/lib/storage-keys";
import { cn } from "@/lib/utils";

type Props = {
  hasLlmKey: boolean;
};

const MAX_BYTES = 1_000_000;

export const QuickGenerate = ({ hasLlmKey }: Props) => {
  const t = useTranslations("dashboard.quickGenerate");
  const router = useRouter();
  const textareaId = useId();
  const [diff, setDiff] = useState("");

  const diffBytes = new TextEncoder().encode(diff).length;
  const diffTooLarge = diffBytes > MAX_BYTES;
  const canSubmit = diff.trim().length > 0 && !diffTooLarge;

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSubmit) return;
      try {
        sessionStorage.setItem(QUICK_GENERATE_DIFF_STORAGE_KEY, diff);
      } catch {
        // sessionStorage unavailable (private mode, quota) — navigate anyway so
        // the user can paste on the generate page.
      }
      router.push("/generate");
    },
    [canSubmit, diff, router],
  );

  if (!hasLlmKey) {
    return (
      <Card className="flex flex-col gap-3 border-dashed bg-muted/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-500">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{t("noKey.title")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("noKey.description")}
            </p>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href="/settings/llm-keys">
            {t("noKey.cta")}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </Card>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border bg-card p-5 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={textareaId} className="text-sm font-medium">
          {t("label")}
        </label>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
      <textarea
        id={textareaId}
        value={diff}
        onChange={(e) => setDiff(e.target.value)}
        spellCheck={false}
        placeholder={t("placeholder")}
        className={cn(
          "block min-h-[140px] w-full resize-y rounded-lg border bg-background px-3 py-2 font-mono text-xs leading-relaxed",
          "placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {diffTooLarge
            ? t("tooLarge")
            : t("chars", { count: diff.length })}
        </span>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          <Sparkles aria-hidden="true" />
          {t("continue")}
        </Button>
      </div>
    </form>
  );
};
