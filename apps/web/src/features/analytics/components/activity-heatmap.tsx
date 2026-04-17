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
          <div
            role="table"
            aria-label={t("heatmap.ariaLabel")}
            className="inline-flex min-w-full flex-col gap-1"
          >
            <div
              role="row"
              className="ml-10 grid grid-cols-[repeat(24,minmax(12px,1fr))] gap-1 text-[10px] text-muted-foreground"
            >
              {Array.from({ length: HOURS }).map((_, h) => (
                <span
                  role="columnheader"
                  key={h}
                  className="text-center tabular-nums"
                >
                  {h % 3 === 0 ? h : ""}
                </span>
              ))}
            </div>
            {grid.map((row, day) => (
              <div
                role="row"
                key={day}
                className="grid grid-cols-[2.5rem_repeat(24,minmax(12px,1fr))] items-center gap-1"
              >
                <span
                  role="rowheader"
                  className="text-right text-[10px] text-muted-foreground"
                >
                  {t(`heatmap.days.${DAY_KEYS[day] ?? "sun"}`)}
                </span>
                {row.map((count, hour) => {
                  const bucket = bucketFor(count, max);
                  return (
                    <div
                      role="cell"
                      key={hour}
                      title={t("heatmap.cellTitle", {
                        day: t(`heatmap.days.${DAY_KEYS[day] ?? "sun"}`),
                        hour,
                        count,
                      })}
                      className={cn(
                        "aspect-square rounded-sm",
                        BUCKET_BG[bucket],
                      )}
                    />
                  );
                })}
              </div>
            ))}
            <div className="ml-10 mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>{t("heatmap.less")}</span>
              {BUCKET_BG.map((bg, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  className={cn("h-3 w-3 rounded-sm", bg)}
                />
              ))}
              <span>{t("heatmap.more")}</span>
            </div>
          </div>
        </div>
      )}
    </ChartCard>
  );
};
