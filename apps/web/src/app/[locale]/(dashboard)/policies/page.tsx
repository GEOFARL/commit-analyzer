import { ShieldCheck } from "lucide-react";
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
    namespace: "placeholders.policies",
  });
  return { title: t("title") };
}

export default async function PoliciesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("placeholders");

  return (
    <ComingSoonCard
      icon={<ShieldCheck className="h-5 w-5" />}
      title={t("policies.title")}
      description={t("policies.description")}
      badge={t("comingInPhase", { phase: 2 })}
    />
  );
}
