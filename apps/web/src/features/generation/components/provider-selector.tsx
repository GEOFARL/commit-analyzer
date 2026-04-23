"use client";

import type { LlmApiKey, LlmProviderName } from "@commit-analyzer/contracts";
import { AlertCircle, KeyRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";

import { MODELS_BY_PROVIDER } from "../constants";

type Props = {
  configuredKeys: LlmApiKey[];
  provider: LlmProviderName | null;
  model: string | null;
  onProviderChange: (next: LlmProviderName) => void;
  onModelChange: (next: string) => void;
  disabled?: boolean;
};

export const ProviderSelector = ({
  configuredKeys,
  provider,
  model,
  onProviderChange,
  onModelChange,
  disabled,
}: Props) => {
  const t = useTranslations("generate.provider");
  const tProviders = useTranslations("llmKeys.providers");
  const providerId = useId();
  const modelId = useId();

  // Keys with status "invalid" would 412 at stream start; hide them so the
  // user isn't offered a broken option. "unknown" keys (never successfully
  // verified) stay available — they may still work at generate time.
  const usableKeys = configuredKeys.filter((k) => k.status !== "invalid");

  if (usableKeys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-4 text-sm">
        <div className="flex items-start gap-3">
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="flex flex-col gap-2">
            <p className="font-medium">{t("noKeysTitle")}</p>
            <p className="text-muted-foreground">{t("noKeysDescription")}</p>
            <Link
              href="/settings/llm-keys"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {t("addKeysCta")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const availableModels = provider ? MODELS_BY_PROVIDER[provider] : [];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor={providerId} className="text-sm font-medium">
          {t("providerLabel")}
        </label>
        <Select
          value={provider ?? undefined}
          onValueChange={(v) => onProviderChange(v as LlmProviderName)}
          disabled={disabled}
        >
          <SelectTrigger id={providerId} className="cursor-pointer">
            <SelectValue placeholder={t("providerPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {usableKeys.map((key) => (
              <SelectItem
                key={key.provider}
                value={key.provider}
                className="cursor-pointer"
              >
                {tProviders(key.provider)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={modelId} className="text-sm font-medium">
          {t("modelLabel")}
        </label>
        <Select
          value={model ?? undefined}
          onValueChange={onModelChange}
          disabled={disabled || !provider}
        >
          <SelectTrigger id={modelId} className="cursor-pointer">
            <SelectValue placeholder={t("modelPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            {availableModels.map((m) => (
              <SelectItem key={m} value={m} className="cursor-pointer">
                <span className="font-mono text-xs">{m}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
