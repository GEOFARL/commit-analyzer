"use client";

import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ChartCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
};

export const ChartCard = ({
  title,
  description,
  action,
  className,
  children,
}: ChartCardProps) => (
  <section
    className={cn(
      "flex flex-col gap-4 rounded-2xl border bg-card p-5",
      className,
    )}
  >
    <header className="flex items-start justify-between gap-4">
      <div>
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
    {children}
  </section>
);

type ChartStateProps = {
  message: string;
};

export const ChartEmpty = ({ message }: ChartStateProps) => (
  <div
    className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center"
    role="status"
  >
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

export const ChartError = ({ message }: ChartStateProps) => (
  <div
    role="alert"
    className="flex min-h-40 items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
  >
    <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
    <span>{message}</span>
  </div>
);
