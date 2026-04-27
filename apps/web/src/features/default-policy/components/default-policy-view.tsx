"use client";

import {
  policyRuleTypes,
  type DefaultPolicyTemplate,
  type PolicyRuleInput,
  type PolicyRuleTypeName,
} from "@commit-analyzer/contracts";
import {
  AlertCircle,
  Eraser,
  Info,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AddRuleGrid } from "@/components/shared/policy-rules/add-rule-grid";
import { RuleEditor } from "@/components/shared/policy-rules/rule-editor";
import { Button } from "@/components/ui/button";
import {
  defaultFormState,
  formStateToInput,
  inputToFormState,
  nextEntryUid,
  type RuleFormEntry,
  type RuleFormState,
} from "@/lib/policy-rules/rule-form";

import {
  useClearDefaultPolicyMutation,
  useDefaultPolicyQuery,
  useUpdateDefaultPolicyMutation,
} from "../hooks";
import type { DefaultPolicyPageData } from "../types";

import { ClearDefaultPolicyDialog } from "./clear-default-policy-dialog";

type RowErrors = Record<string, string>;

const TEMPLATE_DEFAULTS: DefaultPolicyTemplate = { enabled: true, rules: [] };

const buildEntries = (rules: PolicyRuleInput[]): RuleFormEntry[] =>
  rules.map((rule) => ({
    uid: nextEntryUid(),
    state: inputToFormState(rule),
  }));

const snapshot = (enabled: boolean, entries: RuleFormEntry[]): string =>
  JSON.stringify({ enabled, rules: entries.map((e) => e.state) });

export const DefaultPolicyView = ({
  userId,
  initialTemplate,
}: DefaultPolicyPageData) => {
  const t = useTranslations("defaultPolicy");

  const query = useDefaultPolicyQuery(userId, initialTemplate);
  const updateMutation = useUpdateDefaultPolicyMutation(userId);
  const clearMutation = useClearDefaultPolicyMutation(userId);

  const template = query.data?.body.template ?? initialTemplate;
  const seed = template ?? TEMPLATE_DEFAULTS;

  const [enabled, setEnabled] = useState(seed.enabled);
  const [entries, setEntries] = useState<RuleFormEntry[]>(() =>
    buildEntries(seed.rules),
  );
  const [rowErrors, setRowErrors] = useState<RowErrors>({});
  const [clearOpen, setClearOpen] = useState(false);

  const baselineRef = useRef<string>(snapshot(seed.enabled, buildEntries(seed.rules)));
  const dirty = snapshot(enabled, entries) !== baselineRef.current;

  const syncFromTemplate = useCallback(
    (next: DefaultPolicyTemplate | null) => {
      const value = next ?? TEMPLATE_DEFAULTS;
      const nextEntries = buildEntries(value.rules);
      setEnabled(value.enabled);
      setEntries(nextEntries);
      setRowErrors({});
      baselineRef.current = snapshot(value.enabled, nextEntries);
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

  const handleRuleChange = useCallback((uid: string, next: RuleFormState) => {
    setEntries((prev) =>
      prev.map((e) => (e.uid === uid ? { ...e, state: next } : e)),
    );
    setRowErrors((prev) => {
      if (!(uid in prev)) return prev;
      const { [uid]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleRuleRemove = useCallback((uid: string) => {
    setEntries((prev) => prev.filter((e) => e.uid !== uid));
    setRowErrors((prev) => {
      if (!(uid in prev)) return prev;
      const { [uid]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  const handleSave = useCallback(() => {
    const nextRowErrors: RowErrors = {};
    const validatedRules: PolicyRuleInput[] = [];
    let valid = true;
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
      { body: { enabled, rules: validatedRules } },
      {
        onSuccess: (data) => {
          if (data.status === 200) syncFromTemplate(data.body.template);
        },
      },
    );
  }, [entries, enabled, updateMutation, syncFromTemplate]);

  const handleConfirmClear = useCallback(() => {
    clearMutation.mutate(
      {},
      {
        onSuccess: (data) => {
          if (data.status === 204) {
            syncFromTemplate(null);
            setClearOpen(false);
          }
        },
        onError: () => setClearOpen(false),
      },
    );
  }, [clearMutation, syncFromTemplate]);

  const isSaving = updateMutation.isPending;
  const isClearing = clearMutation.isPending;
  const hasRowErrors = Object.keys(rowErrors).length > 0;
  const hasStoredTemplate = template !== null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h2 className="flex items-center gap-2 text-balance text-lg font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <div
        role="note"
        className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-primary/80"
      >
        <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-pretty">{t("helper")}</p>
      </div>

      <section
        aria-labelledby="enabled-heading"
        className="flex flex-col gap-3 rounded-xl border bg-card p-5"
      >
        <header>
          <h3
            id="enabled-heading"
            className="text-sm font-semibold tracking-tight"
          >
            {t("enabled.title")}
          </h3>
          <p className="text-xs text-muted-foreground text-pretty">
            {t("enabled.description")}
          </p>
        </header>
        <label
          htmlFor="default-policy-enabled"
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm"
        >
          <input
            id="default-policy-enabled"
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 cursor-pointer rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span className="font-medium">{t("enabled.toggleLabel")}</span>
        </label>
      </section>

      <section className="flex flex-col gap-5">
        <header>
          <h3 className="text-sm font-semibold tracking-tight">
            {t("rulesTitle")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t("rulesDescription")}
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

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            onClick={handleSave}
            disabled={isSaving || isClearing || !dirty}
          >
            {isSaving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {isSaving ? t("saving") : t("save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setClearOpen(true)}
            disabled={!hasStoredTemplate || isSaving || isClearing}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            {isClearing ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Eraser aria-hidden="true" />
            )}
            {t("clear")}
          </Button>
          <span
            className="text-xs text-muted-foreground"
            aria-live="polite"
          >
            {dirty ? t("unsaved") : t("saved")}
          </span>
        </div>
        {hasRowErrors && (
          <p className="text-xs text-destructive" role="alert">
            <AlertCircle
              className="mr-1 inline h-3.5 w-3.5"
              aria-hidden="true"
            />
            {t("hasErrors")}
          </p>
        )}
      </div>

      <ClearDefaultPolicyDialog
        open={clearOpen}
        loading={isClearing}
        onClose={() => {
          if (!isClearing) setClearOpen(false);
        }}
        onConfirm={handleConfirmClear}
      />
    </div>
  );
};
