"use client";

import type { HeatmapCell } from "@commit-analyzer/contracts";
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import { useHeatmapQuery } from "../hooks";
import type { AnalyticsPageData } from "../types";

import { ChartCard, ChartEmpty, ChartError } from "./chart-card";

type ActivityHeatmapProps = {
  repoId: string;
  initial: AnalyticsPageData["initialHeatmap"];
};

const DAYS = 7;
const HOURS = 24;

type DayKey = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
const DAY_KEYS: readonly DayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

const bucketFor = (count: number, max: number) => {
  if (count === 0 || max === 0) return 0;
  const ratio = count / max;
  if (ratio < 0.25) return 1;
  if (ratio < 0.5) return 2;
  if (ratio < 0.75) return 3;
  return 4;
};

const BUCKET_BG = [
  "bg-muted/40",
  "bg-primary/15",
  "bg-primary/35",
  "bg-primary/60",
  "bg-primary/90",
] as const;

export const ActivityHeatmap = ({ repoId, initial }: ActivityHeatmapProps) => {
  const t = useTranslations("analytics");
  const query = useHeatmapQuery(repoId, initial);
  const items = query.data?.body.items ?? initial;

  const { grid, max, total } = useMemo(() => {
    const g: number[][] = Array.from({ length: DAYS }, () =>
      Array.from({ length: HOURS }, () => 0),
    );
    let localMax = 0;
    let localTotal = 0;
    for (const cell of items as HeatmapCell[]) {
      const row = g[cell.day];
      if (!row) continue;
      if (cell.hour < 0 || cell.hour >= HOURS) continue;
      row[cell.hour] = cell.count;
      localTotal += cell.count;
      if (cell.count > localMax) localMax = cell.count;
    }
    return { grid: g, max: localMax, total: localTotal };
  }, [items]);

  return (
    <ChartCard
      title={t("heatmap.title")}
      description={t("heatmap.description")}
    >
      {query.isError ? (
        <ChartError message={t("error.load")} />
      ) : total === 0 ? (
        <ChartEmpty message={t("heatmap.empty")} />
      ) : (
        <div className="overflow-x-auto">
          <table
            aria-label={t("heatmap.ariaLabel")}
            className="min-w-full border-separate border-spacing-1"
          >
            <thead>
              <tr>
                <th scope="col" className="w-10">
                  <span className="sr-only">{t("heatmap.dayHeader")}</span>
                </th>
                {Array.from({ length: HOURS }).map((_, h) => (
                  <th
                    key={h}
                    scope="col"
                    className="text-center text-[10px] font-normal text-muted-foreground tabular-nums"
                  >
                    <span aria-hidden="true">{h % 3 === 0 ? h : ""}</span>
                    <span className="sr-only">
                      {t("heatmap.hourLabel", { hour: h })}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_KEYS.map((dayKey, day) => {
                const row = grid[day] ?? [];
                const dayLabel = t(`heatmap.days.${dayKey}`);
                return (
                  <tr key={dayKey}>
                    <th
                      scope="row"
                      className="pr-2 text-right text-[10px] font-normal text-muted-foreground"
                    >
                      {dayLabel}
                    </th>
                    {row.map((count, hour) => {
                      const bucket = bucketFor(count, max);
                      const label = t("heatmap.cellTitle", {
                        day: dayLabel,
                        hour,
                        count,
                      });
                      const showCount = bucket >= 3;
                      return (
                        <td
                          key={hour}
                          aria-label={label}
                          title={label}
                          className={cn(
                            "aspect-square rounded-sm text-center align-middle text-[9px] font-medium tabular-nums leading-none",
                            bucket >= 3
                              ? "text-primary-foreground"
                              : "text-transparent",
                            BUCKET_BG[bucket],
                          )}
                        >
                          {showCount ? count : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="ml-10 mt-2 flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
            <span aria-hidden="true">0</span>
            <span
              aria-hidden="true"
              className="flex items-center gap-1"
            >
              {BUCKET_BG.map((bg, i) => (
                <span
                  key={i}
                  className={cn("h-3 w-3 rounded-sm", bg)}
                />
              ))}
            </span>
            <span aria-hidden="true">{max}</span>
            <span aria-hidden="true" className="ml-2 uppercase tracking-wide">
              {t("heatmap.more")}
            </span>
            <span className="sr-only">{t("heatmap.legend")}</span>
          </div>
        </div>
      )}
    </ChartCard>
  );
};
