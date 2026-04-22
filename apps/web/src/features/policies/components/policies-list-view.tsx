"use client";

import type { PolicyDto } from "@commit-analyzer/contracts";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useActivatePolicyMutation,
  useCreatePolicyMutation,
  useDeletePolicyMutation,
  usePoliciesListQuery,
} from "@/features/policies/hooks";
import type { PoliciesListPageData } from "@/features/policies/types";
import { Link, useRouter } from "@/i18n/navigation";

import { CreatePolicyDialog } from "./create-policy-dialog";
import { DeletePolicyDialog } from "./delete-policy-dialog";

export const PoliciesListView = ({
  userId,
  repo,
  initialItems,
}: PoliciesListPageData) => {
  const t = useTranslations("policies");
  const format = useFormatter();
  const router = useRouter();

  const listQuery = usePoliciesListQuery(userId, repo.id, initialItems);
  const createMutation = useCreatePolicyMutation(userId, repo.id);
  const activateMutation = useActivatePolicyMutation(userId, repo.id);
  const deleteMutation = useDeletePolicyMutation(userId, repo.id);

  const items = listQuery.data?.body.items ?? initialItems;

  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PolicyDto | null>(null);

  const handleCreate = useCallback(
    async (name: string): Promise<string | null> => {
      try {
        const result = await createMutation.mutateAsync({
          params: { repoId: repo.id },
          body: { name, rules: [] },
        });
        if (result.status === 201) {
          const id = result.body.id;
          router.push(`/repositories/${repo.id}/policies/${id}`);
          setCreateOpen(false);
          return id;
        }
        return null;
      } catch {
        return null;
      }
    },
    [createMutation, repo.id, router],
  );

  const handleActivate = useCallback(
    (policyId: string) => {
      activateMutation.mutate({ params: { repoId: repo.id, id: policyId }, body: {} });
    },
    [activateMutation, repo.id],
  );

  const handleDelete = useCallback(() => {
    if (!pendingDelete) return;
    deleteMutation.mutate({
      params: { repoId: repo.id, id: pendingDelete.id },
    });
    setPendingDelete(null);
  }, [deleteMutation, repo.id, pendingDelete]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-balance text-lg font-semibold tracking-tight">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            {t("list.title", { repo: repo.fullName })}
          </h2>
          <p className="text-sm text-muted-foreground">{t("list.subtitle")}</p>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={() => setCreateOpen(true)}
        >
          <Plus aria-hidden="true" />
          {t("list.createPolicy")}
        </Button>
      </header>

      {listQuery.isError ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("list.error.load")}</span>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
          <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">
            {t("list.empty.title")}
          </p>
          <p className="max-w-sm text-xs">{t("list.empty.description")}</p>
          <Button variant="secondary" size="sm" onClick={() => setCreateOpen(true)}>
            <Plus aria-hidden="true" />
            {t("list.empty.cta")}
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((policy) => {
            const isActivating =
              activateMutation.isPending &&
              activateMutation.variables?.params.id === policy.id;
            const isDeleting =
              deleteMutation.isPending &&
              deleteMutation.variables?.params.id === policy.id;
            return (
              <li key={policy.id}>
                <article
                  className="group flex flex-col gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 sm:flex-row sm:items-center sm:gap-6"
                  aria-labelledby={`policy-${policy.id}-name`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      {policy.isActive ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                          {t("list.active")}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("list.inactive")}</Badge>
                      )}
                      <Badge variant="secondary" className="tabular-nums">
                        {t("list.rulesCount", { count: policy.rules.length })}
                      </Badge>
                    </div>
                    <h3
                      id={`policy-${policy.id}-name`}
                      className="truncate text-base font-semibold text-foreground"
                    >
                      {policy.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {t("list.updatedAt", {
                        date: format.dateTime(new Date(policy.updatedAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                      })}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    {!policy.isActive && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleActivate(policy.id)}
                        disabled={isActivating}
                      >
                        {isActivating ? (
                          <Loader2 className="animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 aria-hidden="true" />
                        )}
                        {isActivating
                          ? t("list.actions.activating")
                          : t("list.actions.activate")}
                      </Button>
                    )}
                    <Button
                      asChild
                      type="button"
                      variant="outline"
                      size="sm"
                    >
                      <Link
                        href={`/repositories/${repo.id}/policies/${policy.id}`}
                      >
                        <Pencil aria-hidden="true" />
                        {t("list.actions.edit")}
                        <ChevronRight
                          className="h-3.5 w-3.5 opacity-60"
                          aria-hidden="true"
                        />
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPendingDelete(policy)}
                      disabled={isDeleting || policy.isActive}
                    >
                      {isDeleting ? (
                        <Loader2 className="animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 aria-hidden="true" />
                      )}
                      {isDeleting
                        ? t("list.actions.deleting")
                        : t("list.actions.delete")}
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <CreatePolicyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeletePolicyDialog
        open={pendingDelete !== null}
        name={pendingDelete?.name ?? ""}
        isActive={pendingDelete?.isActive ?? false}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};
