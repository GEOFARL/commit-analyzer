"use client";

import type { SuggestionFrame } from "@commit-analyzer/contracts";
import { Check, Copy, ShieldAlert, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { formatAsCommitMessage } from "../format";

type Props = {
  suggestion: SuggestionFrame;
};

const COPY_FEEDBACK_MS = 1500;

export const SuggestionCard = ({ suggestion }: Props) => {
  const t = useTranslations("generate.card");
  const tRules = useTranslations("generate.rules");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const text = formatAsCommitMessage(suggestion);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t("copied"));
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      toast.error(t("copyError"));
    }
  }, [suggestion, t]);

  const headerLine = `${suggestion.type}${
    suggestion.scope ? `(${suggestion.scope})` : ""
  }: ${suggestion.subject}`;

  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {suggestion.compliant ? (
            <Badge variant="success" className="gap-1">
              <ShieldCheck className="h-3 w-3" aria-hidden="true" />
              {t("compliant")}
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1">
              <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              {t("nonCompliant")}
            </Badge>
          )}
          {suggestion.validation?.results.map((r, i) => (
            <Badge
              key={`${r.ruleType}-${i}`}
              variant={r.passed ? "secondary" : "destructive"}
              className="gap-1"
              title={r.message}
            >
              {r.passed ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-3 w-3" aria-hidden="true" />
              )}
              {tRules(r.ruleType)}
            </Badge>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => void handleCopy()}
          className="cursor-pointer shrink-0"
          aria-label={t("copy")}
        >
          {copied ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
          <span className="hidden sm:inline">
            {copied ? t("copied") : t("copy")}
          </span>
        </Button>
      </header>
      <pre className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3 font-mono text-xs leading-relaxed">
        {headerLine}
        {suggestion.body ? `\n\n${suggestion.body}` : ""}
        {suggestion.footer ? `\n\n${suggestion.footer}` : ""}
      </pre>
      {suggestion.validation &&
        suggestion.validation.results.some(
          (r) => !r.passed && r.message,
        ) ? (
        <ul className="flex flex-col gap-1 text-xs text-destructive">
          {suggestion.validation.results
            .filter((r) => !r.passed && r.message)
            .map((r, i) => (
              <li key={`msg-${r.ruleType}-${i}`}>
                <span className="font-medium">{tRules(r.ruleType)}:</span>{" "}
                {r.message}
              </li>
            ))}
        </ul>
      ) : null}
    </article>
  );
};
