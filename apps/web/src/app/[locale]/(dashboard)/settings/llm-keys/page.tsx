import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LlmKeysView } from "@/features/llm-keys/components/llm-keys-view";
import { getLlmKeysPageData } from "@/features/llm-keys/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "llmKeys" });
  return { title: t("title") };
}

export default async function LlmKeysPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getLlmKeysPageData();

  return <LlmKeysView userId={data.userId} initialItems={data.initialItems} />;
}
