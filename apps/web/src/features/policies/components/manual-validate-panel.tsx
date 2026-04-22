"use client";

import {
  type RuleResultDto,
  type ValidationResultDto,
} from "@commit-analyzer/contracts";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useValidatePolicyMutation } from "@/features/policies/hooks";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 400;

const EXAMPLES = [
  {
    key: "valid",
    message:
      "feat(auth): add passwordless login\n\n" +
      "Implements a one-time-password flow for email-based sign-in.\n\n" +
      "Refs #42",
  },
  {
    key: "invalid",
    message: "banana(auth): do the thing",
  },
  {
    key: "long",
    message:
      "feat(ui): completely redesign the dashboard navigation bar with a whole bunch of new options\n\n" +
      "Body explains the change.",
  },
  {
    key: "noBody",
    message: "feat(auth): add login",
  },
] as const;

type ExampleKey = (typeof EXAMPLES)[number]["key"];
type ExampleLabelKey = `examples.${ExampleKey}`;

type PanelStatus = "idle" | "debouncing" | "checking" | "success" | "error";

type Props = {
  repoId: string;
  policyId: string;
  hasSavedRules: boolean;
  dirty: boolean;
};

export const ManualValidatePanel = ({
  repoId,
  policyId,
  hasSavedRules,
  dirty,
}: Props) => {
  const t = useTranslations("policies.validate");
  const textareaId = useId();
  const liveId = useId();

  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<PanelStatus>("idle");
  const [result, setResult] = useState<ValidationResultDto | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const requestTokenRef = useRef(0);

  const mutation = useValidatePolicyMutation();
  const { mutate } = mutation;

  const runValidation = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) {
        setStatus("idle");
        setResult(null);
        return;
      }

      const token = ++requestTokenRef.current;
      setStatus("checking");
      mutate(
        {
          params: { repoId, id: policyId },
          body: { message: raw },
        },
        {
          onSuccess: (data) => {
            if (token !== requestTokenRef.current) return;
            if (data.status === 200) {
              setResult(data.body);
              setStatus("success");
            } else {
              setResult(null);
              setStatus("error");
            }
          },
          onError: () => {
            if (token !== requestTokenRef.current) return;
            setResult(null);
            setStatus("error");
          },
        },
      );
    },
    [mutate, policyId, repoId],
  );

  const scheduleValidation = useCallback(
    (raw: string) => {
      clearTimeout(debounceRef.current);
      const trimmed = raw.trim();
      if (!trimmed) {
        requestTokenRef.current++;
        setStatus("idle");
        setResult(null);
        return;
      }
      setStatus("debouncing");
      debounceRef.current = setTimeout(() => runValidation(raw), DEBOUNCE_MS);
    },
    [runValidation],
  );

  useEffect(() => {
    return () => clearTimeout(debounceRef.current);
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const next = e.target.value;
      setMessage(next);
      scheduleValidation(next);
    },
    [scheduleValidation],
  );

  const handleExample = useCallback(
    (sample: string) => {
      setMessage(sample);
      scheduleValidation(sample);
    },
    [scheduleValidation],
  );

  const handleClear = useCallback(() => {
    clearTimeout(debounceRef.current);
    requestTokenRef.current++;
    setMessage("");
    setStatus("idle");
    setResult(null);
  }, []);

  const handleRetry = useCallback(() => {
    runValidation(message);
  }, [message, runValidation]);

  const failedCount = useMemo(() => {
    if (!result) return 0;
    return result.results.filter((r) => !r.passed).length;
  }, [result]);

  const isBusy = status === "debouncing" || status === "checking";

  return (
    <aside
      aria-label={t("title")}
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Sparkles className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {t("title")}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t("description")}</p>
        </div>
        {message.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="-mr-2 h-7 px-2 text-xs"
          >
            {t("clear")}
          </Button>
        )}
      </header>

      <div className="flex flex-col gap-2">
        <label htmlFor={textareaId} className="text-xs font-medium">
          {t("textareaLabel")}
        </label>
        <textarea
          id={textareaId}
          value={message}
          onChange={handleChange}
          placeholder={t("placeholder")}
          spellCheck={false}
          autoComplete="off"
          rows={6}
          className={cn(
            "min-h-[10rem] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm leading-relaxed placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium" id={`${textareaId}-examples`}>
          {t("examplesLabel")}
        </span>
        <div
          role="group"
          aria-labelledby={`${textareaId}-examples`}
          className="flex flex-wrap gap-2"
        >
          {EXAMPLES.map((ex) => (
            <Button
              key={ex.key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleExample(ex.message)}
              className="h-7 px-2.5 text-xs"
            >
              {t(`examples.${ex.key}` satisfies ExampleLabelKey)}
            </Button>
          ))}
        </div>
      </div>

      {dirty && (
        <p
          role="note"
          className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-300"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{t("unsavedHint")}</span>
        </p>
      )}

      <div
        id={liveId}
        aria-live="polite"
        aria-busy={isBusy}
        className="flex flex-col gap-3"
      >
        <StatusHeader
          status={status}
          messageEmpty={message.trim().length === 0}
          hasSavedRules={hasSavedRules}
          failedCount={failedCount}
          onRetry={handleRetry}
        />

        {status === "success" && result && result.results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {result.results.map((r, idx) => (
              <ResultRow key={`${r.ruleType}-${idx}`} result={r} />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
};

type StatusHeaderProps = {
  status: PanelStatus;
  messageEmpty: boolean;
  hasSavedRules: boolean;
  failedCount: number;
  onRetry: () => void;
};

const StatusHeader = ({
  status,
  messageEmpty,
  hasSavedRules,
  failedCount,
  onRetry,
}: StatusHeaderProps) => {
  const t = useTranslations("policies.validate");

  if (messageEmpty) {
    return (
      <p className="text-xs text-muted-foreground">{t("emptyHint")}</p>
    );
  }

  if (status === "debouncing" || status === "checking") {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        <span>{t("checking")}</span>
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        <div className="flex items-start gap-2">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{t("errorTitle")}</span>
            <span className="text-destructive/80">{t("errorBody")}</span>
          </div>
        </div>
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-7 px-2.5 text-xs"
          >
            {t("retry")}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "success") {
    if (!hasSavedRules) {
      return (
        <p className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span>{t("noRules")}</span>
        </p>
      );
    }

    if (failedCount === 0) {
      return (
        <p className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          <span className="font-medium">{t("passedAll")}</span>
        </p>
      );
    }

    return (
      <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        <span className="font-medium">
          {t("failedSome", { count: failedCount })}
        </span>
      </p>
    );
  }

  return null;
};

const ResultRow = ({ result }: { result: RuleResultDto }) => {
  const t = useTranslations("policies.validate");
  const label = t(`ruleLabels.${result.ruleType}`);
  const message =
    !result.passed && !result.message
      ? t(`defaultMessages.${result.ruleType}`)
      : result.message;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3",
        result.passed
          ? "border-border bg-muted/20"
          : "border-destructive/20 bg-destructive/[0.04]",
      )}
    >
      <span className="mt-0.5 shrink-0" aria-hidden="true">
        {result.passed ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs font-medium">{label}</span>
          <Badge
            variant={result.passed ? "success" : "destructive"}
            className="shrink-0"
          >
            {result.passed ? t("passed") : t("failed")}
          </Badge>
        </div>
        {message && (
          <span className="text-xs text-muted-foreground break-words">
            {message}
          </span>
        )}
      </div>
    </li>
  );
};
