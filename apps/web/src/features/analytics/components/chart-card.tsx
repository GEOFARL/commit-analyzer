"use client";

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
