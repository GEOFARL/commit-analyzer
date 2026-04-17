"use client";

import {
  BadgeCheck,
  GitCommit,
  Sparkles,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { useSummaryQuery } from "../hooks";
import type { AnalyticsPageData } from "../types";

import { ChartError } from "./chart-card";

type SummaryCardsProps = {
  repoId: string;
  initial: AnalyticsPageData["initialSummary"];
};

const formatNumber = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);

const formatScore = (n: number) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(n);

const formatPercent = (n: number) =>
  new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0,
  }).format(n);

export const SummaryCards = ({ repoId, initial }: SummaryCardsProps) => {
  const t = useTranslations("analytics");
  const query = useSummaryQuery(repoId, initial);
  const data = query.data?.body ?? initial;

  if (query.isError) {
    return <ChartError message={t("error.load")} />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <SummaryTile
        icon={<GitCommit className="h-4 w-4" aria-hidden="true" />}
        label={t("summary.totalCommits")}
        value={formatNumber(data.totalCommits)}
      />
      <SummaryTile
        icon={<Users className="h-4 w-4" aria-hidden="true" />}
        label={t("summary.totalContributors")}
        value={formatNumber(data.totalContributors)}
      />
      <SummaryTile
        icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        label={t("summary.avgQuality")}
        value={formatScore(data.avgQuality)}
      />
      <SummaryTile
        icon={<BadgeCheck className="h-4 w-4" aria-hidden="true" />}
        label={t("summary.ccCompliance")}
        value={`${formatPercent(data.ccCompliancePercent)}%`}
      />
    </div>
  );
};

const SummaryTile = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex flex-col gap-2 rounded-2xl border bg-card p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      {icon}
      <span>{label}</span>
    </div>
    <p className="text-2xl font-semibold tabular-nums tracking-tight">
      {value}
    </p>
  </div>
);
