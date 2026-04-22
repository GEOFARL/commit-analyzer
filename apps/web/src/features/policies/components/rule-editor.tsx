"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { RuleFormState } from "../rule-form";

type Props = {
  uid: string;
  state: RuleFormState;
  errorKey: string | null;
  onChange: (next: RuleFormState) => void;
  onRemove: () => void;
};

const POLICY_ERROR_KEYS = [
  "nameRequired",
  "nameTooLong",
  "typesRequired",
  "scopesRequired",
  "regexInvalid",
  "subjectLengthRange",
] as const;
type PolicyErrorKey = (typeof POLICY_ERROR_KEYS)[number];

const isErrorKey = (key: string | null): key is PolicyErrorKey =>
  key !== null && (POLICY_ERROR_KEYS as readonly string[]).includes(key);

export const RuleEditor = ({
  uid,
  state,
  errorKey,
  onChange,
  onRemove,
}: Props) => {
  const tEditor = useTranslations("policies.editor");
  const tErrors = useTranslations("policies.errors");

  const errorId = errorKey ? `${uid}-error` : undefined;
  const errorText = isErrorKey(errorKey) ? tErrors(errorKey) : null;

  return (
    <article
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
      aria-labelledby={`${uid}-title`}
    >
      <RuleBody
        uid={uid}
        state={state}
        errorId={errorId}
        onChange={onChange}
        removeButton={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={tEditor("removeRule")}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        }
      />

      {errorText && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {errorText}
        </p>
      )}
    </article>
  );
};

type BodyProps = {
  uid: string;
  state: RuleFormState;
  errorId: string | undefined;
  onChange: (next: RuleFormState) => void;
  removeButton: ReactNode;
};

const RuleBody = (props: BodyProps) => {
  switch (props.state.ruleType) {
    case "allowedTypes":
      return (
        <AllowedTypesEditor
          uid={props.uid}
          state={props.state}
          errorId={props.errorId}
          onChange={props.onChange}
          removeButton={props.removeButton}
        />
      );
    case "allowedScopes":
      return (
        <AllowedScopesEditor
          uid={props.uid}
          state={props.state}
          errorId={props.errorId}
          onChange={props.onChange}
          removeButton={props.removeButton}
        />
      );
    case "maxSubjectLength":
      return (
        <MaxSubjectLengthEditor
          uid={props.uid}
          state={props.state}
          errorId={props.errorId}
          onChange={props.onChange}
          removeButton={props.removeButton}
        />
      );
    case "bodyRequired":
      return (
        <BodyRequiredEditor
          uid={props.uid}
          state={props.state}
          onChange={props.onChange}
          removeButton={props.removeButton}
        />
      );
    case "footerRequired":
      return (
        <FooterRequiredEditor
          uid={props.uid}
          state={props.state}
          onChange={props.onChange}
          removeButton={props.removeButton}
        />
      );
  }
};

const RuleHeader = ({
  uid,
  label,
  description,
  removeButton,
}: {
  uid: string;
  label: string;
  description: string;
  removeButton: ReactNode;
}) => (
  <header className="flex items-start justify-between gap-3">
    <div className="min-w-0">
      <h3 id={`${uid}-title`} className="text-sm font-semibold tracking-tight">
        {label}
      </h3>
      <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
    </div>
    {removeButton}
  </header>
);

const AllowedTypesEditor = ({
  uid,
  state,
  errorId,
  onChange,
  removeButton,
}: {
  uid: string;
  state: Extract<RuleFormState, { ruleType: "allowedTypes" }>;
  errorId: string | undefined;
  onChange: (next: RuleFormState) => void;
  removeButton: ReactNode;
}) => {
  const t = useTranslations("policies.kinds.allowedTypes");
  return (
    <>
      <RuleHeader
        uid={uid}
        label={t("label")}
        description={t("description")}
        removeButton={removeButton}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor={`${uid}-input`} className="text-xs font-medium">
          {t("valueLabel")}
        </label>
        <Input
          id={`${uid}-input`}
          autoComplete="off"
          spellCheck={false}
          value={state.raw}
          onChange={(e) => onChange({ ...state, raw: e.target.value })}
          placeholder={t("valuePlaceholder")}
          aria-describedby={errorId ?? `${uid}-hint`}
        />
        <p id={`${uid}-hint`} className="text-xs text-muted-foreground">
          {t("hint")}
        </p>
      </div>
    </>
  );
};

const AllowedScopesEditor = ({
  uid,
  state,
  errorId,
  onChange,
  removeButton,
}: {
  uid: string;
  state: Extract<RuleFormState, { ruleType: "allowedScopes" }>;
  errorId: string | undefined;
  onChange: (next: RuleFormState) => void;
  removeButton: ReactNode;
}) => {
  const t = useTranslations("policies.kinds.allowedScopes");
  return (
    <>
      <RuleHeader
        uid={uid}
        label={t("label")}
        description={t("description")}
        removeButton={removeButton}
      />
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:max-w-xs">
          <label htmlFor={`${uid}-mode`} className="text-xs font-medium">
            {t("modeLabel")}
          </label>
          <Select
            value={state.mode}
            onValueChange={(value) => {
              const next: "list" | "regex" =
                value === "regex" ? "regex" : "list";
              onChange({ ...state, mode: next });
            }}
          >
            <SelectTrigger id={`${uid}-mode`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="list">{t("modeList")}</SelectItem>
              <SelectItem value="regex">{t("modeRegex")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {state.mode === "list" ? (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${uid}-list`} className="text-xs font-medium">
              {t("listLabel")}
            </label>
            <Input
              id={`${uid}-list`}
              autoComplete="off"
              spellCheck={false}
              value={state.raw}
              onChange={(e) => onChange({ ...state, raw: e.target.value })}
              placeholder={t("listPlaceholder")}
              aria-describedby={errorId ?? `${uid}-list-hint`}
            />
            <p
              id={`${uid}-list-hint`}
              className="text-xs text-muted-foreground"
            >
              {t("listHint")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label htmlFor={`${uid}-regex`} className="text-xs font-medium">
              {t("regexLabel")}
            </label>
            <Input
              id={`${uid}-regex`}
              autoComplete="off"
              spellCheck={false}
              value={state.pattern}
              onChange={(e) => onChange({ ...state, pattern: e.target.value })}
              placeholder={t("regexPlaceholder")}
              aria-describedby={errorId ?? `${uid}-regex-hint`}
              className="font-mono"
            />
            <p
              id={`${uid}-regex-hint`}
              className="text-xs text-muted-foreground"
            >
              {t("regexHint")}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

const MaxSubjectLengthEditor = ({
  uid,
  state,
  errorId,
  onChange,
  removeButton,
}: {
  uid: string;
  state: Extract<RuleFormState, { ruleType: "maxSubjectLength" }>;
  errorId: string | undefined;
  onChange: (next: RuleFormState) => void;
  removeButton: ReactNode;
}) => {
  const t = useTranslations("policies.kinds.maxSubjectLength");
  return (
    <>
      <RuleHeader
        uid={uid}
        label={t("label")}
        description={t("description")}
        removeButton={removeButton}
      />
      <div className="flex flex-col gap-2">
        <label htmlFor={`${uid}-input`} className="text-xs font-medium">
          {t("valueLabel")}
        </label>
        <Input
          id={`${uid}-input`}
          type="number"
          inputMode="numeric"
          min={1}
          max={500}
          autoComplete="off"
          value={state.value}
          onChange={(e) => onChange({ ...state, value: e.target.value })}
          aria-describedby={errorId ?? `${uid}-hint`}
          className="sm:max-w-[12rem] tabular-nums"
        />
        <p id={`${uid}-hint`} className="text-xs text-muted-foreground">
          {t("hint")}
        </p>
      </div>
    </>
  );
};

const BodyRequiredEditor = ({
  uid,
  state,
  onChange,
  removeButton,
}: {
  uid: string;
  state: Extract<RuleFormState, { ruleType: "bodyRequired" }>;
  onChange: (next: RuleFormState) => void;
  removeButton: ReactNode;
}) => {
  const t = useTranslations("policies.kinds.bodyRequired");
  return (
    <>
      <RuleHeader
        uid={uid}
        label={t("label")}
        description={t("description")}
        removeButton={removeButton}
      />
      <BooleanToggle
        uid={uid}
        label={t("toggleLabel")}
        value={state.value}
        onToggle={(next) => onChange({ ...state, value: next })}
      />
    </>
  );
};

const FooterRequiredEditor = ({
  uid,
  state,
  onChange,
  removeButton,
}: {
  uid: string;
  state: Extract<RuleFormState, { ruleType: "footerRequired" }>;
  onChange: (next: RuleFormState) => void;
  removeButton: ReactNode;
}) => {
  const t = useTranslations("policies.kinds.footerRequired");
  return (
    <>
      <RuleHeader
        uid={uid}
        label={t("label")}
        description={t("description")}
        removeButton={removeButton}
      />
      <BooleanToggle
        uid={uid}
        label={t("toggleLabel")}
        value={state.value}
        onToggle={(next) => onChange({ ...state, value: next })}
      />
    </>
  );
};

const BooleanToggle = ({
  uid,
  label,
  value,
  onToggle,
}: {
  uid: string;
  label: string;
  value: boolean;
  onToggle: (next: boolean) => void;
}) => (
  <label
    htmlFor={`${uid}-toggle`}
    className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed bg-muted/30 p-3 text-sm"
  >
    <input
      id={`${uid}-toggle`}
      type="checkbox"
      checked={value}
      onChange={(e) => onToggle(e.target.checked)}
      className="h-4 w-4 cursor-pointer rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    />
    <span className="font-medium">{label}</span>
  </label>
);
