"use client";

import type { DefaultPolicyTemplate } from "@commit-analyzer/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { tsr } from "@/lib/api/tsr";

import { defaultPolicyQueryKeys } from "./queries";
import type { DefaultPolicyEnvelope } from "./types";

const STALE_MS = 60_000;

const emptyHeaders = () => new Headers();

export const useDefaultPolicyQuery = (
  userId: string,
  initialTemplate: DefaultPolicyTemplate | null,
) =>
  tsr.policies.defaults.get.useQuery({
    queryKey: [...defaultPolicyQueryKeys.template(userId)],
    queryData: {},
    initialData: {
      status: 200,
      body: { template: initialTemplate },
      headers: emptyHeaders(),
    },
    staleTime: STALE_MS,
    retry: 0,
  });

export const useUpdateDefaultPolicyMutation = (userId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("defaultPolicy.toast");
  const queryKey = defaultPolicyQueryKeys.template(userId);

  return tsr.policies.defaults.update.useMutation({
    onSuccess: (data) => {
      if (data.status === 200) {
        toast.success(t("saved"));
        queryClient.setQueryData<DefaultPolicyEnvelope>([...queryKey], {
          status: 200,
          body: data.body,
          headers: emptyHeaders(),
        });
      }
    },
    onError: () => toast.error(t("saveError")),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });
};

export const useClearDefaultPolicyMutation = (userId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("defaultPolicy.toast");
  const queryKey = defaultPolicyQueryKeys.template(userId);

  return tsr.policies.defaults.clear.useMutation({
    onSuccess: (data) => {
      if (data.status === 204) {
        toast.success(t("cleared"));
        queryClient.setQueryData<DefaultPolicyEnvelope>([...queryKey], {
          status: 200,
          body: { template: null },
          headers: emptyHeaders(),
        });
      }
    },
    onError: () => toast.error(t("clearError")),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...queryKey] });
    },
  });
};
