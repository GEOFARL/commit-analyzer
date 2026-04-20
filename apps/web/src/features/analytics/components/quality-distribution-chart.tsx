"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useQualityDistributionQuery } from "../hooks";
import type { AnalyticsPageData } from "../types";

import { ChartCard, ChartEmpty, ChartError } from "./chart-card";

type QualityDistributionChartProps = {
  repoId: string;
  initial: AnalyticsPageData["initialQualityDistribution"];
};

const BUCKET_ORDER = ["good", "average", "poor"] as const;

const BUCKET_COLOR: Record<(typeof BUCKET_ORDER)[number], string> = {
  good: "var(--primary)",
  average: "color-mix(in srgb, var(--foreground) 40%, transparent)",
  poor: "var(--destructive)",
};

export const QualityDistributionChart = ({
  repoId,
  initial,
}: QualityDistributionChartProps) => {
  const t = useTranslations("analytics");
  const query = useQualityDistributionQuery(repoId, initial);
  const items = query.data?.body.items ?? initial;

  const data = useMemo(() => {
    const byBucket = new Map(items.map((b) => [b.bucket, b.count]));
    return BUCKET_ORDER.map((bucket) => ({
      bucket,
      label: t(`quality.buckets.${bucket}`),
      count: byBucket.get(bucket) ?? 0,
    }));
  }, [items, t]);

  const total = data.reduce((acc, d) => acc + d.count, 0);

  return (
    <ChartCard
      title={t("quality.title")}
      description={t("quality.description")}
    >
      {query.isError ? (
        <ChartError message={t("error.load")} />
      ) : total === 0 ? (
        <ChartEmpty message={t("quality.empty")} />
      ) : (
        <div
          role="img"
          aria-label={t("quality.ariaLabel")}
          className="h-56 w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 12, bottom: 0, left: -12 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
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
                cursor={{ fill: "var(--muted)", fillOpacity: 0.3 }}
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="count"
                radius={[6, 6, 0, 0]}
                isAnimationActive={false}
              >
                {data.map((d) => (
                  <Cell key={d.bucket} fill={BUCKET_COLOR[d.bucket]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
};
