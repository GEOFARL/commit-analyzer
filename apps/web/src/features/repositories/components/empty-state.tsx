import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/50 px-6 py-12 text-center",
      className,
    )}
  >
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
      {icon}
    </div>
    <h3 className="text-base font-semibold">{title}</h3>
    {description ? (
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    ) : null}
    {action}
  </div>
);
