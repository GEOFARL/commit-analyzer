import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ApiKeysView } from "@/features/api-keys/components/api-keys-view";
import { getApiKeysPageData } from "@/features/api-keys/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "apiKeys" });
  return { title: t("title") };
}

export default async function ApiKeysPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getApiKeysPageData();

  return <ApiKeysView userId={data.userId} initialItems={data.initialItems} />;
}
