import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { GenerateView } from "@/features/generation/components/generate-view";
import { getGeneratePageData } from "@/features/generation/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "generate" });
  return { title: t("title") };
}

export default async function GeneratePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getGeneratePageData();

  return <GenerateView {...data} />;
}
