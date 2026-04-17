"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import { useFileFrequencyQuery } from "../hooks";
import type { AnalyticsPageData } from "../types";

import { ChartCard, ChartEmpty, ChartError } from "./chart-card";

type FilesChurnTableProps = {
  repoId: string;
  limit: number;
  initial: AnalyticsPageData["initialFileFrequency"];
};

const numberFmt = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

export const FilesChurnTable = ({
  repoId,
  limit,
  initial,
}: FilesChurnTableProps) => {
  const t = useTranslations("analytics");
  const query = useFileFrequencyQuery(repoId, limit, initial);
  const items = query.data?.body.items ?? initial;

  return (
    <ChartCard
      title={t("files.title")}
      description={t("files.description")}
    >
      {query.isError ? (
        <ChartError message={t("error.load")} />
      ) : items.length === 0 ? (
        <ChartEmpty message={t("files.empty")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2 font-medium">
                  {t("files.columns.path")}
                </th>
                <th className="py-2 text-right font-medium">
                  {t("files.columns.changes")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((f, i) => (
                <tr
                  key={`${f.filePath}-${i}`}
                  className={cn("border-b last:border-0", "hover:bg-muted/40")}
                >
                  <td className="max-w-0 py-2 font-mono text-xs">
                    <span className="block truncate" title={f.filePath}>
                      {f.filePath}
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {numberFmt.format(f.changeCount)}
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
