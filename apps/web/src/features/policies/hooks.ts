"use client";

import type { PolicyDto } from "@commit-analyzer/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { tsr } from "@/lib/api/tsr";

import { policyQueryKeys } from "./queries";
import type { PoliciesListEnvelope, PolicyDetailEnvelope } from "./types";

const emptyHeaders = () => new Headers();

const STALE_MS = 60_000;

export const usePoliciesListQuery = (
  userId: string,
  repoId: string,
  initialItems: PolicyDto[],
) =>
  tsr.policies.list.useQuery({
    queryKey: [...policyQueryKeys.list(userId, repoId)],
    queryData: { params: { repoId } },
    initialData: {
      status: 200,
      body: { items: initialItems },
      headers: emptyHeaders(),
    },
    staleTime: STALE_MS,
    retry: 0,
  });

export const usePolicyQuery = (
  userId: string,
  repoId: string,
  policyId: string,
  initialPolicy: PolicyDto,
) =>
  tsr.policies.get.useQuery({
    queryKey: [...policyQueryKeys.detail(userId, repoId, policyId)],
    queryData: { params: { repoId, id: policyId } },
    initialData: {
      status: 200,
      body: initialPolicy,
      headers: emptyHeaders(),
    },
    staleTime: STALE_MS,
    retry: 0,
  });

export const useCreatePolicyMutation = (userId: string, repoId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("policies.toast");
  const listKey = policyQueryKeys.list(userId, repoId);

  return tsr.policies.create.useMutation({
    onError: () => toast.error(t("createError")),
    onSuccess: (data) => {
      if (data.status === 201) {
        toast.success(t("created"));
      }
    },
    // Create navigates the user to the editor route. The list page remounts on
    // return and the invalidation below refreshes it then — no optimistic list
    // cache write (it caused a flash of the list with the new item before the
    // editor mounted on /create).
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...listKey] });
    },
  });
};

export const useUpdatePolicyMutation = (
  userId: string,
  repoId: string,
  policyId: string,
) => {
  const queryClient = useQueryClient();
  const t = useTranslations("policies.toast");
  const listKey = policyQueryKeys.list(userId, repoId);
  const detailKey = policyQueryKeys.detail(userId, repoId, policyId);

  return tsr.policies.update.useMutation({
    onError: () => toast.error(t("saveError")),
    onSuccess: (data) => {
      if (data.status === 200) {
        toast.success(t("saved"));
        queryClient.setQueryData<PolicyDetailEnvelope>([...detailKey], {
          status: 200,
          body: data.body,
          headers: emptyHeaders(),
        });
        queryClient.setQueryData<PoliciesListEnvelope>([...listKey], (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            body: {
              items: prev.body.items.map((p) =>
                p.id === data.body.id ? data.body : p,
              ),
            },
          };
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...listKey] });
      void queryClient.invalidateQueries({ queryKey: [...detailKey] });
    },
  });
};

export const useActivatePolicyMutation = (userId: string, repoId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("policies.toast");
  const listKey = policyQueryKeys.list(userId, repoId);

  return tsr.policies.activate.useMutation({
    onMutate: async (vars): Promise<{ prev: PoliciesListEnvelope | undefined }> => {
      const detailKey = policyQueryKeys.detail(userId, repoId, vars.params.id);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: [...listKey] }),
        queryClient.cancelQueries({ queryKey: [...detailKey] }),
      ]);
      const prev = queryClient.getQueryData<PoliciesListEnvelope>([...listKey]);
      if (prev) {
        queryClient.setQueryData<PoliciesListEnvelope>([...listKey], {
          ...prev,
          body: {
            items: prev.body.items.map((p) => ({
              ...p,
              isActive: p.id === vars.params.id,
            })),
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData([...listKey], context.prev);
      }
      toast.error(t("activateError"));
    },
    onSuccess: (data, vars) => {
      if (data.status === 200) {
        toast.success(t("activated"));
        const detailKey = policyQueryKeys.detail(
          userId,
          repoId,
          vars.params.id,
        );
        queryClient.setQueryData<PolicyDetailEnvelope>([...detailKey], {
          status: 200,
          body: data.body,
          headers: emptyHeaders(),
        });
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...listKey] });
    },
  });
};

export const useDeletePolicyMutation = (userId: string, repoId: string) => {
  const queryClient = useQueryClient();
  const t = useTranslations("policies.toast");
  const listKey = policyQueryKeys.list(userId, repoId);

  return tsr.policies.delete.useMutation({
    onMutate: async (vars): Promise<{ prev: PoliciesListEnvelope | undefined }> => {
      const detailKey = policyQueryKeys.detail(userId, repoId, vars.params.id);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: [...listKey] }),
        queryClient.cancelQueries({ queryKey: [...detailKey] }),
      ]);
      const prev = queryClient.getQueryData<PoliciesListEnvelope>([...listKey]);
      if (prev) {
        queryClient.setQueryData<PoliciesListEnvelope>([...listKey], {
          ...prev,
          body: {
            items: prev.body.items.filter((p) => p.id !== vars.params.id),
          },
        });
      }
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData([...listKey], context.prev);
      }
      toast.error(t("deleteError"));
    },
    onSuccess: (_data, vars) => {
      const detailKey = policyQueryKeys.detail(userId, repoId, vars.params.id);
      queryClient.removeQueries({ queryKey: [...detailKey] });
      toast.success(t("deleted"));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: [...listKey] });
    },
  });
};
