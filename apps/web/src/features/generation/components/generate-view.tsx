"use client";

import type { LlmProviderName } from "@commit-analyzer/contracts";
import { Loader2, Sparkles, Square } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";

import { MODELS_BY_PROVIDER } from "../constants";
import { useGenerateStream } from "../hooks";
import type { GeneratePageData } from "../types";

import { DiffInput } from "./diff-input";
import { PolicyPicker } from "./policy-picker";
import { ProviderSelector } from "./provider-selector";
import { SuggestionList } from "./suggestion-list";

const MAX_DIFF_BYTES = 1_000_000;

const pickInitialProvider = (
  keys: GeneratePageData["configuredKeys"],
): LlmProviderName | null => {
  const usable = keys.filter((k) => k.status !== "invalid");
  const verified = usable.find((k) => k.status === "ok");
  return (verified ?? usable[0])?.provider ?? null;
};

export const GenerateView = ({
  configuredKeys,
  repos,
}: GeneratePageData) => {
  const t = useTranslations("generate");

  const [diff, setDiff] = useState("");
  const [provider, setProvider] = useState<LlmProviderName | null>(() =>
    pickInitialProvider(configuredKeys),
  );
  const [model, setModel] = useState<string | null>(() => {
    const initial = pickInitialProvider(configuredKeys);
    return initial ? (MODELS_BY_PROVIDER[initial][0] ?? null) : null;
  });
  const [repoId, setRepoId] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);

  const { state, start, cancel } = useGenerateStream();
  const streaming = state.status === "streaming";

  // Reset the model whenever the provider changes so we never send a model
  // string that the newly-selected provider does not recognise.
  const handleProviderChange = useCallback((next: LlmProviderName) => {
    setProvider(next);
    setModel(MODELS_BY_PROVIDER[next][0] ?? null);
  }, []);

  const diffBytes = new TextEncoder().encode(diff).length;
  const diffTooLarge = diffBytes > MAX_DIFF_BYTES;

  const canSubmit =
    !streaming &&
    diff.trim().length > 0 &&
    !diffTooLarge &&
    provider !== null &&
    model !== null;

  const handleSubmit = useCallback(() => {
    if (!provider || !model) return;
    void start({
      diff,
      provider,
      model,
      ...(repoId ? { repositoryId: repoId } : {}),
      ...(policyId ? { policyId } : {}),
    });
  }, [diff, provider, model, repoId, policyId, start]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6">
        <DiffInput value={diff} onChange={setDiff} disabled={streaming} />
        <ProviderSelector
          configuredKeys={configuredKeys}
          provider={provider}
          model={model}
          onProviderChange={handleProviderChange}
          onModelChange={setModel}
          disabled={streaming}
        />
        <PolicyPicker
          repos={repos}
          repoId={repoId}
          policyId={policyId}
          onRepoChange={(next) => {
            setRepoId(next);
            setPolicyId(null);
          }}
          onPolicyChange={setPolicyId}
          disabled={streaming}
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {diffTooLarge ? (
            <p className="mr-auto text-xs text-destructive">
              {t("diff.tooLarge")}
            </p>
          ) : null}
          {streaming ? (
            <Button
              type="button"
              variant="outline"
              onClick={cancel}
              className="cursor-pointer"
            >
              <Square aria-hidden="true" />
              {t("cancel")}
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="cursor-pointer"
          >
            {streaming ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles aria-hidden="true" />
            )}
            {streaming ? t("generating") : t("generate")}
          </Button>
        </div>

        {state.status === "error" && state.error ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"
          >
            <p className="font-medium text-destructive">
              {t("error.title")}
            </p>
            <p className="mt-1 text-destructive/80">
              <span className="font-mono text-xs">{state.error.code}</span>
              {" — "}
              {state.error.message}
            </p>
          </div>
        ) : null}

        {state.status === "cancelled" ? (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
            {t("cancelled")}
          </div>
        ) : null}
      </div>

      <SuggestionList
        suggestions={state.suggestions}
        streaming={streaming}
        empty={state.status === "idle"}
      />
    </section>
  );
};
