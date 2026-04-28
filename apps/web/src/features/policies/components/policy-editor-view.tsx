"use client";

import {
  policyRuleTypes,
  type PolicyRuleInput,
  type PolicyRuleTypeName,
} from "@commit-analyzer/contracts";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { AddRuleGrid } from "@/components/shared/policy-rules/add-rule-grid";
import { RuleEditor } from "@/components/shared/policy-rules/rule-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useActivatePolicyMutation,
  useDeletePolicyMutation,
  usePolicyQuery,
  useUpdatePolicyMutation,
} from "@/features/policies/hooks";
import type { PolicyEditorPageData } from "@/features/policies/types";
import { Link, useRouter } from "@/i18n/navigation";
import {
  defaultFormState,
  dtoToFormState,
  formStateToInput,
  nextEntryUid,
  type RuleFormEntry,
  type RuleFormState,
} from "@/lib/policy-rules/rule-form";

import { DeletePolicyDialog } from "./delete-policy-dialog";
import { ManualValidatePanel } from "./manual-validate-panel";

type RowErrors = Record<string, string>;

const buildEntries = (
  rules: PolicyEditorPageData["initialPolicy"]["rules"],
): RuleFormEntry[] =>
  rules.map((rule) => ({
    uid: nextEntryUid(),
    state: dtoToFormState(rule),
  }));

const snapshot = (name: string, entries: RuleFormEntry[]): string =>
  JSON.stringify({ name, rules: entries.map((e) => e.state) });

export const PolicyEditorView = ({
  userId,
  repo,
  initialPolicy,
}: PolicyEditorPageData) => {
  const t = useTranslations("policies");
  const tErrors = useTranslations("policies.errors");
  const router = useRouter();

  const policyQuery = usePolicyQuery(
    userId,
    repo.id,
    initialPolicy.id,
    initialPolicy,
  );
  const updateMutation = useUpdatePolicyMutation(
    userId,
    repo.id,
    initialPolicy.id,
  );
  const activateMutation = useActivatePolicyMutation(userId, repo.id);
  const deleteMutation = useDeletePolicyMutation(userId, repo.id);

  const policy = policyQuery.data?.body ?? initialPolicy;

  const [name, setName] = useState(policy.name);
  const [entries, setEntries] = useState<RuleFormEntry[]>(() =>
    buildEntries(policy.rules),
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Baseline snapshot of last known server state for the editable fields.
  // After a successful save we update both the local form and the baseline
  // from the server response (see syncFromServer below). The baseline lets us
  // compute `dirty` without a deep equality on every render.
  const baselineRef = useRef<string>(
    snapshot(initialPolicy.name, buildEntries(initialPolicy.rules)),
  );
  const dirty = snapshot(name, entries) !== baselineRef.current;

  const syncFromServer = useCallback(
    (serverPolicy: PolicyEditorPageData["initialPolicy"]) => {
      const nextEntries = buildEntries(serverPolicy.rules);
      setName(serverPolicy.name);
      setEntries(nextEntries);
      setRowErrors({});
      setNameError(null);
      baselineRef.current = snapshot(serverPolicy.name, nextEntries);
    },
    [],
  );

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = true;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const usedKinds = useMemo(
    () => new Set(entries.map((e) => e.state.ruleType)),
    [entries],
  );
  const allKindsUsed = usedKinds.size === policyRuleTypes.length;

  const handleAddRule = useCallback((kind: PolicyRuleTypeName) => {
    setEntries((prev) => [
      ...prev,
      { uid: nextEntryUid(), state: defaultFormState(kind) },
    ]);
  }, []);

  const handleRuleChange = useCallback(
    (uid: string, next: RuleFormState) => {
      setEntries((prev) =>
        prev.map((e) => (e.uid === uid ? { ...e, state: next } : e)),
      );
      setRowErrors((prev) => {
        if (!(uid in prev)) return prev;
        const { [uid]: _, ...rest } = prev;
        return rest;
      });
    },
    [],
  );

  const handleRuleRemove = useCallback((uid: string) => {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
    setRowErrors((prev) => {
      if (!(uid in prev)) return prev;
      const { [uid]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleSave = useCallback(() => {
    const trimmedName = name.trim();
    let valid = true;

    if (!trimmedName) {
      setNameError(tErrors("nameRequired"));
      valid = false;
    } else if (trimmedName.length > 100) {
      setNameError(tErrors("nameTooLong"));
      valid = false;
    } else {
      setNameError(null);
    }

    const nextRowErrors: RowErrors = {};
    const validatedRules: PolicyRuleInput[] = [];
    for (const entry of entries) {
      const result = formStateToInput(entry.state);
      if (!result.ok) {
        nextRowErrors[entry.uid] = result.error;
        valid = false;
      } else {
        validatedRules.push(result.value);
      }
    }
    setRowErrors(nextRowErrors);
    if (!valid) return;

    updateMutation.mutate(
      {
        params: { repoId: repo.id, id: initialPolicy.id },
        body: { name: trimmedName, rules: validatedRules },
      },
      {
        onSuccess: (data) => {
          if (data.status === 200) syncFromServer(data.body);
        },
      },
    );
  }, [
    name,
    entries,
    updateMutation,
    repo.id,
    initialPolicy.id,
    tErrors,
    syncFromServer,
  ]);

  const handleActivate = useCallback(() => {
    activateMutation.mutate({
      params: { repoId: repo.id, id: initialPolicy.id },
      body: {},
    });
  }, [activateMutation, repo.id, initialPolicy.id]);

  const handleDeleteConfirm = useCallback(() => {
    deleteMutation.mutate(
      { params: { repoId: repo.id, id: initialPolicy.id } },
      {
        onSuccess: () => {
          setDeleteOpen(false);
          router.push(`/repositories/${repo.id}/policies`);
        },
        onError: () => {
          setDeleteOpen(false);
        },
      },
    );
  }, [deleteMutation, repo.id, initialPolicy.id, router]);

  const isSaving = updateMutation.isPending;
  const isActivating = activateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const hasRowErrors = Object.keys(rowErrors).length > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-3">
            <Link href={`/repositories/${repo.id}/policies`}>
              <ArrowLeft aria-hidden="true" />
              {t("editor.back")}
            </Link>
          </Button>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold tracking-tight text-wrap-balance">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
            {policy.name}
            {policy.isActive && (
              <Badge variant="success" className="ml-1 gap-1">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                {t("editor.active")}
              </Badge>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("editor.subtitle", { repo: repo.fullName })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
          <span
            className="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {dirty ? t("editor.unsaved") : t("editor.saved")}
          </span>
          {!policy.isActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleActivate}
              disabled={isActivating || dirty}
            >
              {isActivating ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              {t("editor.activate")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !dirty}
          >
            {isSaving && (
              <Loader2 className="animate-spin" aria-hidden="true" />
            )}
            {isSaving ? t("editor.saving") : t("editor.save")}
          </Button>
        </div>
      </div>

      {!policy.isActive && (
        <div
          role="status"
          className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{t("editor.inactiveHint")}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-6 min-w-0">

      <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <header>
          <h2 className="text-sm font-semibold tracking-tight">
            {t("editor.nameLabel")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("editor.nameHelp")}
          </p>
        </header>
        <Input
          id="policy-name"
          name="policy-name"
          autoComplete="off"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          maxLength={100}
          aria-invalid={nameError ? "true" : undefined}
          aria-describedby={nameError ? "policy-name-error" : undefined}
          className="sm:max-w-md"
        />
        {nameError && (
          <p
            id="policy-name-error"
            role="alert"
            className="text-xs text-destructive"
          >
            {nameError}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-5">
        <header>
          <h2 className="text-sm font-semibold tracking-tight">
            {t("editor.rulesTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {t("editor.rulesDescription")}
          </p>
        </header>

        {entries.length > 0 && (
          <ul className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li key={entry.uid}>
                <RuleEditor
                  uid={entry.uid}
                  state={entry.state}
                  errorKey={rowErrors[entry.uid] ?? null}
                  onChange={(next) => handleRuleChange(entry.uid, next)}
                  onRemove={() => handleRuleRemove(entry.uid)}
                />
              </li>
            ))}
          </ul>
        )}

        {!allKindsUsed && (
          <AddRuleGrid usedKinds={usedKinds} onAdd={handleAddRule} />
        )}
      </section>

        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <ManualValidatePanel
            repoId={repo.id}
            policyId={initialPolicy.id}
            hasSavedRules={policy.rules.length > 0}
            dirty={dirty}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
          disabled={policy.isActive || isDeleting}
        >
          {isDeleting ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 aria-hidden="true" />
          )}
          {t("editor.delete")}
        </Button>
        {hasRowErrors && (
          <p className="text-xs text-destructive" role="alert">
            <AlertCircle
              className="mr-1 inline h-3.5 w-3.5"
              aria-hidden="true"
            />
            {t("editor.hasErrors")}
          </p>
        )}
      </div>

      <DeletePolicyDialog
        open={deleteOpen}
        name={policy.name}
        isActive={policy.isActive}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};
