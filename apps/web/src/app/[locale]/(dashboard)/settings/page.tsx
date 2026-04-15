import { Settings as SettingsIcon } from "lucide-react";
import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ComingSoonCard } from "@/components/layout/coming-soon-card";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: "placeholders.settings",
  });
  return { title: t("title") };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("placeholders");

  return (
    <ComingSoonCard
      icon={<SettingsIcon className="h-5 w-5" />}
      title={t("settings.title")}
      description={t("settings.description")}
      badge={t("comingInPhase", { phase: 2 })}
    />
  );
}
