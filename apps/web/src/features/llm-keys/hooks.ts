"use client";

import type { LlmApiKey, LlmProviderName } from "@commit-analyzer/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";

import { tsr } from "@/lib/api/tsr";

import { llmKeyQueryKeys } from "./queries";
import type { LlmKeysEnvelope } from "./types";

export const useLlmKeysQuery = (
  userId: string,
  initialItems: LlmApiKey[],
) => {
  const query = tsr.llmKeys.list.useQuery({
    queryKey: [...llmKeyQueryKeys.all(userId)],
    queryData: {},
    initialData: {
      status: 200,
      body: { items: initialItems },
      headers: new Headers(),
    },
    staleTime: 0,
    retry: 0,
  });

  useEffect(() => {
    if (query.error) {
      console.error("[llm-keys] list error", query.error);
    }
  }, [query.error]);

  return query;
};

export const useUpsertLlmKeyMutation = (userId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("llmKeys");
  const queryKey = llmKeyQueryKeys.all(userId);

  return tsr.llmKeys.upsert.useMutation({
    onSuccess: (data) => {
      if (data.status === 200) {
        queryClient.setQueryData<LlmKeysEnvelope>([...queryKey], (prev) => {
          const items = prev?.body.items ?? [];
          const remaining = items.filter(
            (k) => k.provider !== data.body.provider,
          );
          return {
            status: 200,
            body: { items: [data.body, ...remaining] },
            headers: prev?.headers ?? new Headers(),
          };
        });
        toast.success(t("toast.saved"));
      }
    },
    onError: () => {
      // Specific 422 reason is surfaced inline by the dialog; a toast only
      // fires for unexpected failures (network, 401, 5xx).
      toast.error(t("toast.saveError"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });
};

export const useDeleteLlmKeyMutation = (userId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("llmKeys");
  const queryKey = llmKeyQueryKeys.all(userId);

  return tsr.llmKeys.remove.useMutation({
    onMutate: async (vars: { params: { provider: LlmProviderName } }) => {
      await queryClient.cancelQueries({ queryKey: [...queryKey] });
      const prev = queryClient.getQueryData<LlmKeysEnvelope>([...queryKey]);
      if (prev) {
        queryClient.setQueryData<LlmKeysEnvelope>([...queryKey], {
          ...prev,
          body: {
            items: prev.body.items.filter(
              (k) => k.provider !== vars.params.provider,
            ),
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      const ctx = context as { prev?: LlmKeysEnvelope } | undefined;
      if (ctx?.prev) {
        queryClient.setQueryData([...queryKey], ctx.prev);
      }
      toast.error(t("toast.deleteError"));
    },
    onSuccess: () => {
      toast.success(t("toast.deleted"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });
};
