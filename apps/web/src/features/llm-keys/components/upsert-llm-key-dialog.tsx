"use client";

import type { LlmProviderName } from "@commit-analyzer/contracts";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { LLM_PROVIDERS, type UpsertError } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (
    provider: LlmProviderName,
    apiKey: string,
  ) => Promise<UpsertError | null>;
  configuredProviders: ReadonlySet<LlmProviderName>;
};

const MIN_KEY_LENGTH = 8;

export const UpsertLlmKeyDialog = ({
  open,
  onClose,
  onSubmit,
  configuredProviders,
}: Props) => {
  const t = useTranslations("llmKeys.upsertDialog");
  const tProviders = useTranslations("llmKeys.providers");

  const [provider, setProvider] = useState<LlmProviderName>("openai");
  const [apiKey, setApiKey] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<UpsertError | null>(null);

  const reset = useCallback(() => {
    setProvider("openai");
    setApiKey("");
    setRevealed(false);
    setSubmitting(false);
    setServerError(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = apiKey.trim();
    if (trimmed.length < MIN_KEY_LENGTH) return;
    setServerError(null);
    setSubmitting(true);
    const error = await onSubmit(provider, trimmed);
    setSubmitting(false);
    if (error) {
      setServerError(error);
      return;
    }
    handleClose();
  };

  const isReplacing = configuredProviders.has(provider);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) handleClose();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="llm-provider" className="text-sm font-medium">
              {t("providerLabel")}
            </label>
            <Select
              value={provider}
              onValueChange={(v) => {
                setProvider(v as LlmProviderName);
                setServerError(null);
              }}
            >
              <SelectTrigger id="llm-provider" className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LLM_PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p} className="cursor-pointer">
                    {tProviders(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isReplacing && (
              <p className="text-xs text-muted-foreground">
                {t("replacingHint")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="llm-api-key" className="text-sm font-medium">
              {t("keyLabel")}
            </label>
            <div className="relative">
              <Input
                id="llm-api-key"
                name="llm-api-key"
                type={revealed ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setServerError(null);
                }}
                placeholder={t("keyPlaceholder")}
                className="pr-10 font-mono text-xs sm:text-sm"
                autoFocus
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 cursor-pointer"
                onClick={() => setRevealed((r) => !r)}
                aria-label={revealed ? t("hideKey") : t("revealKey")}
              >
                {revealed ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("keyHelp")}</p>
          </div>

          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{serverError.message}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="cursor-pointer"
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={apiKey.trim().length < MIN_KEY_LENGTH || submitting}
              className="cursor-pointer"
            >
              {submitting && (
                <Loader2 className="animate-spin" aria-hidden="true" />
              )}
              {t("verifyAndSave")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
