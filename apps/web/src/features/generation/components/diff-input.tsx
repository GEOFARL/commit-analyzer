"use client";

import {
  validateUnifiedDiff,
  type DiffStats,
  type DiffValidationIssue,
} from "@commit-analyzer/diff-parser/validate";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  FileCode2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { DiffViewer } from "./diff-viewer";

export type DiffValidity =
  | { status: "pending" }
  | { status: "valid"; stats: DiffStats }
  | { status: "invalid"; issues: DiffValidationIssue[]; stats: DiffStats };

type Props = {
  value: string;
  onChange: (next: string) => void;
  onValidityChange?: (validity: DiffValidity) => void;
  disabled?: boolean;
};

const MAX_BYTES = 1_000_000;

export const DiffInput = ({
  value,
  onChange,
  onValidityChange,
  disabled,
}: Props) => {
  const t = useTranslations("generate.diff");
  const editorId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const deferredValue = useDeferredValue(value);
  const validity = useMemo<DiffValidity>(() => {
    if (deferredValue.trim().length === 0) return { status: "pending" };
    const res = validateUnifiedDiff(deferredValue);
    if (res.valid) return { status: "valid", stats: res.stats };
    return { status: "invalid", issues: res.issues, stats: res.stats };
  }, [deferredValue]);

  useEffect(() => {
    onValidityChange?.(validity);
  }, [validity, onValidityChange]);

  const handleEditorChange = useCallback(
    (next: string) => {
      onChange(next);
      setFileName(null);
    },
    [onChange],
  );
  // DiffEditor's updateListener only fires handleEditorChange on user input —
  // the value-sync effect inside the editor dispatches programmatic
  // transactions without a userEvent annotation, so setFileName(null) no
  // longer clobbers the pill after an Upload → subsequent remount of value.

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        toast.error(t("pasteEmpty"));
        return;
      }
      onChange(text);
      setFileName(null);
      toast.success(t("pasteSuccess"));
    } catch {
      toast.error(t("pasteError"));
    }
  }, [onChange, t]);

  const readFile = useCallback(
    async (file: File) => {
      if (file.size > MAX_BYTES) {
        toast.error(t("fileTooLarge"));
        return;
      }
      const text = await file.text();
      onChange(text);
      setFileName(file.name);
    },
    [onChange, t],
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);
      const file = event.dataTransfer.files[0];
      if (!file) return;
      void readFile(file);
    },
    [readFile],
  );

  const firstIssue =
    validity.status === "invalid" ? validity.issues[0] : undefined;

  const resolveIssueReason = (issue: DiffValidationIssue): string => {
    switch (issue.code) {
      case "empty":
        return t("validation.issueEmpty");
      case "missing-header":
        return t("validation.issueMissingHeader");
      case "bad-hunk-header":
        return t("validation.issueBadHunkHeader");
      case "hunk-count-mismatch":
        return t("validation.issueHunkCountMismatch");
      case "bad-line-prefix":
        return t("validation.issueBadLinePrefix");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={editorId} className="text-sm font-medium">
          {t("label")}
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".patch,.diff,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="cursor-pointer"
          >
            <FileCode2 aria-hidden="true" />
            <span className="hidden sm:inline">{t("uploadFile")}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handlePaste()}
            disabled={disabled}
            className="cursor-pointer"
          >
            <ClipboardPaste aria-hidden="true" />
            <span className="hidden sm:inline">{t("paste")}</span>
          </Button>
        </div>
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "rounded-lg transition-colors",
          "focus-within:ring-2 focus-within:ring-ring",
          dragOver && "ring-2 ring-primary/30",
        )}
      >
        <DiffViewer
          editorId={editorId}
          value={value}
          onChange={handleEditorChange}
          disabled={disabled}
          placeholder={t("placeholder")}
          ariaLabel={t("label")}
        />
      </div>

      {validity.status === "valid" ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
        >
          <CheckCircle2
            aria-hidden="true"
            className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"
          />
          <span>
            {t("validation.statsBanner", {
              files: validity.stats.files,
              additions: validity.stats.additions,
              deletions: validity.stats.deletions,
            })}
          </span>
        </div>
      ) : null}

      {validity.status === "invalid" && firstIssue ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{t("validation.invalidTitle")}</span>
            <span>
              {firstIssue.file
                ? t("validation.locationWithFile", {
                    file: firstIssue.file,
                    line: firstIssue.line,
                    reason: resolveIssueReason(firstIssue),
                  })
                : t("validation.locationWithoutFile", {
                    line: firstIssue.line,
                    reason: resolveIssueReason(firstIssue),
                  })}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{fileName ? t("fromFile", { name: fileName }) : t("hint")}</span>
        <span>{t("chars", { count: value.length })}</span>
      </div>
    </div>
  );
};
