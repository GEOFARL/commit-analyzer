"use client";

import type { ConnectedRepo } from "@commit-analyzer/contracts";
import { Loader2, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { usePoliciesForRepoQuery } from "../hooks";

const NONE_VALUE = "__none__";

type Props = {
  repos: ConnectedRepo[];
  repoId: string | null;
  policyId: string | null;
  onRepoChange: (next: string | null) => void;
  onPolicyChange: (next: string | null) => void;
  disabled?: boolean;
};

export const PolicyPicker = ({
  repos,
  repoId,
  policyId,
  onRepoChange,
  onPolicyChange,
  disabled,
}: Props) => {
  const t = useTranslations("generate.policy");
  const repoFieldId = useId();
  const policyFieldId = useId();

  const policiesQuery = usePoliciesForRepoQuery(repoId);
  const policies =
    policiesQuery.data?.status === 200 ? policiesQuery.data.body.items : [];

  // Clear stale policy selection when the repo changes or the fetched list no
  // longer includes the previously selected policy.
  useEffect(() => {
    if (!policyId) return;
    if (!repoId) {
      onPolicyChange(null);
      return;
    }
    if (!policiesQuery.isSuccess) return;
    const stillPresent = policies.some((p) => p.id === policyId);
    if (!stillPresent) onPolicyChange(null);
  }, [policyId, repoId, policiesQuery.isSuccess, policies, onPolicyChange]);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-2">
        <label htmlFor={repoFieldId} className="text-sm font-medium">
          {t("repoLabel")}
        </label>
        <Select
          value={repoId ?? NONE_VALUE}
          onValueChange={(v) => onRepoChange(v === NONE_VALUE ? null : v)}
          disabled={disabled || repos.length === 0}
        >
          <SelectTrigger id={repoFieldId} className="cursor-pointer">
            <SelectValue placeholder={t("repoPlaceholder")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE} className="cursor-pointer">
              {t("noRepo")}
            </SelectItem>
            {repos.map((r) => (
              <SelectItem key={r.id} value={r.id} className="cursor-pointer">
                <span className="truncate">{r.fullName}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={policyFieldId} className="text-sm font-medium">
          {t("policyLabel")}
        </label>
        <Select
          value={policyId ?? NONE_VALUE}
          onValueChange={(v) => onPolicyChange(v === NONE_VALUE ? null : v)}
          disabled={disabled || !repoId}
        >
          <SelectTrigger id={policyFieldId} className="cursor-pointer">
            <SelectValue
              placeholder={
                repoId ? t("policyPlaceholder") : t("policyDisabled")
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE} className="cursor-pointer">
              {t("noPolicy")}
            </SelectItem>
            {policies.map((p) => (
              <SelectItem key={p.id} value={p.id} className="cursor-pointer">
                <span className="flex items-center gap-2">
                  {p.isActive ? (
                    <ShieldCheck
                      className="h-3.5 w-3.5 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="truncate">{p.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {policiesQuery.isFetching && repoId ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t("loading")}
          </p>
        ) : null}
      </div>
    </div>
  );
};
