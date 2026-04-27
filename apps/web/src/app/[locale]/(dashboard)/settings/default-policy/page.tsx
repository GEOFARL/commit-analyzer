import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { DefaultPolicyView } from "@/features/default-policy/components/default-policy-view";
import { getDefaultPolicyPageData } from "@/features/default-policy/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "defaultPolicy" });
  return { title: t("title") };
}

export default async function DefaultPolicyPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await getDefaultPolicyPageData();

  return (
    <DefaultPolicyView
      userId={data.userId}
      initialTemplate={data.initialTemplate}
    />
  );
}
