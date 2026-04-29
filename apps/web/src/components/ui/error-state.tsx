"use client";

import { AlertCircle, RefreshCcw } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ErrorStateProps = {
  title: string;
  description?: string;
  onRetry?: () => void;
  retryDisabled?: boolean;
  retryLabel?: string;
  size?: "default" | "compact";
  className?: string;
};

export const ErrorState = ({
  title,
  description,
  onRetry,
  retryDisabled,
  retryLabel,
  size = "default",
  className,
}: ErrorStateProps) => {
  const tCommon = useTranslations("common");
  const compact = size === "compact";

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between",
        compact && "min-h-40",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <AlertCircle
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <div className="flex flex-col">
          <span className="font-medium">{title}</span>
          {description ? (
            <span className="text-muted-foreground">{description}</span>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={retryDisabled}
          className="self-start sm:self-center"
        >
          <RefreshCcw aria-hidden="true" className="h-3.5 w-3.5" />
          {retryLabel ?? tCommon("retry")}
        </Button>
      ) : null}
    </div>
  );
};
