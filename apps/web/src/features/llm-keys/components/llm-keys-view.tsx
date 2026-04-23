"use client";

import type { LlmProviderName } from "@commit-analyzer/contracts";
import { AlertCircle, KeyRound, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  useDeleteLlmKeyMutation,
  useLlmKeysQuery,
  useUpsertLlmKeyMutation,
} from "@/features/llm-keys/hooks";
import type { LlmKeysPageData, UpsertError } from "@/features/llm-keys/types";

import { DeleteLlmKeyDialog } from "./delete-llm-key-dialog";
import { LlmKeyRow } from "./llm-key-row";
import { UpsertLlmKeyDialog } from "./upsert-llm-key-dialog";

type ServerErrorBody = { error?: { code?: string; message?: string } };

// tsr's `onError` delivers a typed FetchError; this narrows the 422 body so we
// can display the provider's reason ("provider rejected the API key" etc.)
// inline in the dialog instead of a generic toast.
const parseServerError = (err: unknown): UpsertError => {
  const maybeFetch = err as { status?: number; body?: unknown } | undefined;
  const body = (maybeFetch?.body ?? {}) as ServerErrorBody;
  return {
    code: body.error?.code ?? "unknown_error",
    message: body.error?.message ?? "Unknown error",
  };
};

export const LlmKeysView = ({ userId, initialItems }: LlmKeysPageData) => {
  const t = useTranslations("llmKeys");

  const query = useLlmKeysQuery(userId, initialItems);
  const upsertMutation = useUpsertLlmKeyMutation(userId);
  const deleteMutation = useDeleteLlmKeyMutation(userId);

  const items = query.data?.body.items ?? initialItems;
  const configuredProviders = useMemo(
    () => new Set(items.map((k) => k.provider)),
    [items],
  );

  const [upsertOpen, setUpsertOpen] = useState(false);
  const [pendingDeleteProvider, setPendingDeleteProvider] =
    useState<LlmProviderName | null>(null);

  const handleUpsert = useCallback(
    async (
      provider: LlmProviderName,
      key: string,
    ): Promise<UpsertError | null> => {
      try {
        await upsertMutation.mutateAsync({
          params: { provider },
          body: { key },
        });
        return null;
      } catch (err) {
        return parseServerError(err);
      }
    },
    [upsertMutation],
  );

  const handleDelete = useCallback(
    (provider: LlmProviderName) => {
      deleteMutation.mutate({ params: { provider } });
      setPendingDeleteProvider(null);
    },
    [deleteMutation],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-balance text-lg font-semibold tracking-tight">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          className="w-full cursor-pointer sm:w-auto"
          onClick={() => setUpsertOpen(true)}
        >
          <Plus />
          {t("addKey")}
        </Button>
      </header>

      {query.isError ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("error.load")}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          <KeyRound className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-xs">{t("empty.description")}</p>
          <Button
            variant="secondary"
            size="sm"
            className="cursor-pointer"
            onClick={() => setUpsertOpen(true)}
          >
            <Plus />
            {t("empty.cta")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((llmKey) => (
            <LlmKeyRow
              key={llmKey.id}
              llmKey={llmKey}
              isDeleting={
                deleteMutation.isPending &&
                deleteMutation.variables?.params.provider === llmKey.provider
              }
              onDelete={setPendingDeleteProvider}
            />
          ))}
        </div>
      )}

      <UpsertLlmKeyDialog
        open={upsertOpen}
        onClose={() => setUpsertOpen(false)}
        onSubmit={handleUpsert}
        configuredProviders={configuredProviders}
      />

      <DeleteLlmKeyDialog
        provider={pendingDeleteProvider}
        onClose={() => setPendingDeleteProvider(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
