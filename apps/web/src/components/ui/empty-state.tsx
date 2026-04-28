import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: "default" | "compact";
  className?: string;
};

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) => {
  const compact = size === "compact";
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/50 text-center",
        compact ? "min-h-40 px-4 py-8" : "px-6 py-12",
        className,
      )}
    >
      {icon ? (
        compact ? (
          <span aria-hidden="true" className="text-muted-foreground/60">
            {icon}
          </span>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            {icon}
          </div>
        )
      ) : null}
      <h3
        className={cn(
          "font-semibold",
          compact ? "text-sm text-muted-foreground" : "text-base",
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            "max-w-sm text-muted-foreground",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
};
