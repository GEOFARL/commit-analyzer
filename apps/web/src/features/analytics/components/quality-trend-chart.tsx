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

import { useQualityTrendQuery } from "../hooks";
import type { AnalyticsPageData } from "../types";

import { ChartCard, ChartEmpty, ChartError } from "./chart-card";

type QualityTrendChartProps = {
  repoId: string;
  granularity: Granularity;
  initial: AnalyticsPageData["initialQualityTrend"];
};

export const QualityTrendChart = ({
  repoId,
  granularity,
  initial,
}: QualityTrendChartProps) => {
  const t = useTranslations("analytics");
  const query = useQualityTrendQuery(repoId, granularity, initial);
  const items = query.data?.body.items ?? initial;

  const data = useMemo(
    () => items.map((p) => ({ date: p.date, avgScore: p.avgScore })),
    [items],
  );

  return (
    <ChartCard
      title={t("qualityTrend.title")}
      description={t("qualityTrend.description")}
    >
      {query.isError ? (
        <ChartError message={t("error.load")} />
      ) : data.length === 0 ? (
        <ChartEmpty message={t("qualityTrend.empty")} />
      ) : (
        <div className="h-64 w-full">
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
                domain={[0, 10]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="avgScore"
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
