import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ActivityView } from "@/features/audit/components/activity-view";
import { getActivityPageData } from "@/features/audit/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings.activity" });
  return { title: t("title") };
}

export default async function SettingsActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ eventType?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { eventType } = await searchParams;
  const data = await getActivityPageData({ rawEventType: eventType });

  return <ActivityView {...data} />;
}
