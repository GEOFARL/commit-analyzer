"use client";

import type { ApiKey } from "@commit-analyzer/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { toast } from "sonner";

import { tsr } from "@/lib/api/tsr";

import { apiKeyQueryKeys } from "./queries";
import type { ApiKeysEnvelope } from "./types";

export const useApiKeysQuery = (userId: string, initialItems: ApiKey[]) => {
  const query = tsr.auth.apiKeys.list.useQuery({
    queryKey: [...apiKeyQueryKeys.all(userId)],
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
      console.error("[api-keys] list error", query.error);
    }
  }, [query.error]);

  return query;
};

export const useCreateApiKeyMutation = (userId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("apiKeys");
  const queryKey = apiKeyQueryKeys.all(userId);

  return tsr.auth.apiKeys.create.useMutation({
    onError: () => {
      toast.error(t("toast.createError"));
    },
    onSuccess: (data) => {
      if (data.status === 201) {
        queryClient.setQueryData<ApiKeysEnvelope>([...queryKey], (prev) => {
          const items = prev?.body.items ?? [];
          const { key: _, ...apiKey } = data.body;
          return {
            status: 200,
            body: { items: [apiKey, ...items] },
            headers: prev?.headers ?? new Headers(),
          };
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });
};

export const useRevokeApiKeyMutation = (userId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("apiKeys");
  const queryKey = apiKeyQueryKeys.all(userId);

  return tsr.auth.apiKeys.revoke.useMutation({
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: [...queryKey] });
      const prev = queryClient.getQueryData<ApiKeysEnvelope>([...queryKey]);
      if (prev) {
        queryClient.setQueryData<ApiKeysEnvelope>([...queryKey], {
          ...prev,
          body: {
            items: prev.body.items.filter((k) => k.id !== vars.params.id),
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData([...queryKey], context.prev);
      }
      toast.error(t("toast.revokeError"));
    },
    onSuccess: () => {
      toast.success(t("toast.revoked"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });
};
