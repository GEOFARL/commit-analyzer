"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useContributorsQuery } from "../hooks";
import type { AnalyticsPageData } from "../types";

import { ChartCard, ChartEmpty, ChartError } from "./chart-card";

type ContributorsTableProps = {
  repoId: string;
  limit: number;
  initial: AnalyticsPageData["initialContributors"];
};

const numberFmt = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const scoreFmt = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const ContributorsTable = ({
  repoId,
  limit,
  initial,
}: ContributorsTableProps) => {
  const t = useTranslations("analytics");
  const query = useContributorsQuery(repoId, limit, initial);
  const items = query.data?.body.items ?? initial;

  return (
    <ChartCard
      title={t("contributors.title")}
      description={t("contributors.description")}
    >
      {query.isError ? (
        <ChartError message={t("error.load")} />
      ) : items.length === 0 ? (
        <ChartEmpty message={t("contributors.empty")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-medium">
                  {t("contributors.columns.author")}
                </th>
                <th className="py-2 text-right font-medium">
                  {t("contributors.columns.commits")}
                </th>
                <th className="py-2 text-right font-medium">
                  {t("contributors.columns.avgQuality")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => (
                <tr
                  key={`${c.authorEmail}-${i}`}
                  className={cn(
                    "border-b last:border-0",
                    "hover:bg-muted/40",
                  )}
                >
                  <td className="max-w-0 py-2">
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {c.authorName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {c.authorEmail}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {numberFmt.format(c.commitCount)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {scoreFmt.format(c.avgQuality)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ChartCard>
  );
};
