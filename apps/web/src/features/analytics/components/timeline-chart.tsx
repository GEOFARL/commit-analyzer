"use client";

import type { Granularity } from "@commit-analyzer/contracts";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useTimelineQuery } from "../hooks";
import type { AnalyticsPageData } from "../types";

import { ChartCard, ChartEmpty, ChartError } from "./chart-card";

type TimelineChartProps = {
  repoId: string;
  granularity: Granularity;
  initial: AnalyticsPageData["initialTimeline"];
};

export const TimelineChart = ({
  repoId,
  granularity,
  initial,
}: TimelineChartProps) => {
  const t = useTranslations("analytics");
  const query = useTimelineQuery(repoId, granularity, initial);
  const items = query.data?.body.items ?? initial;

  const data = useMemo(
    () => items.map((p) => ({ date: p.date, count: p.count })),
    [items],
  );

  return (
    <ChartCard
      title={t("timeline.title")}
      description={t("timeline.description")}
    >
      {query.isError ? (
        <ChartError message={t("error.load")} />
      ) : data.length === 0 ? (
        <ChartEmpty message={t("timeline.empty")} />
      ) : (
        <div
          role="img"
          aria-label={t("timeline.ariaLabel", { count: data.length })}
          className="h-64 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: "var(--foreground)" }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="var(--primary)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
};
