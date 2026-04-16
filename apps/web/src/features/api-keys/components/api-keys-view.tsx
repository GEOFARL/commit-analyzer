"use client";

import { AlertCircle, Key, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
} from "@/features/api-keys/hooks";
import type { ApiKeysPageData } from "@/features/api-keys/types";

import { ApiKeyRow } from "./api-key-row";
import { CreateApiKeyDialog } from "./create-api-key-dialog";
import { RevokeApiKeyDialog } from "./revoke-api-key-dialog";

export const ApiKeysView = ({ userId, initialItems }: ApiKeysPageData) => {
  const t = useTranslations("apiKeys");

  const query = useApiKeysQuery(userId, initialItems);
  const createMutation = useCreateApiKeyMutation(userId);
  const revokeMutation = useRevokeApiKeyMutation(userId);

  const items = query.data?.body.items ?? initialItems;

  const [createOpen, setCreateOpen] = useState(false);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);

  const handleCreate = useCallback(
    async (name: string): Promise<string | null> => {
      try {
        const result = await createMutation.mutateAsync({
          body: { name },
        });
        if (result.status === 201) {
          return result.body.key;
        }
        return null;
      } catch {
        return null;
      }
    },
    [createMutation],
  );

  const handleRevoke = useCallback(
    (id: string) => {
      revokeMutation.mutate({ params: { id } });
      setPendingRevokeId(null);
    },
    [revokeMutation],
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-balance text-lg font-semibold tracking-tight">
            <Key className="h-5 w-5" aria-hidden="true" />
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setCreateOpen(true)}
        >
          <Plus />
          {t("createKey")}
        </Button>
      </header>

      {query.isError ? (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("error.load")}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          <Key className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm font-medium">{t("empty.title")}</p>
          <p className="text-xs">{t("empty.description")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((apiKey) => (
            <ApiKeyRow
              key={apiKey.id}
              apiKey={apiKey}
              isRevoking={
                revokeMutation.isPending &&
                revokeMutation.variables?.params.id === apiKey.id
              }
              onRevoke={setPendingRevokeId}
            />
          ))}
        </div>
      )}

      <CreateApiKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <RevokeApiKeyDialog
        apiKeyId={pendingRevokeId}
        apiKeyName={items.find((k) => k.id === pendingRevokeId)?.name ?? ""}
        onClose={() => setPendingRevokeId(null)}
        onConfirm={handleRevoke}
      />
    </div>
  );
};
