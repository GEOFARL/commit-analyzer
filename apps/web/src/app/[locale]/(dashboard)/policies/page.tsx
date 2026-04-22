import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { RepoPolicyPicker } from "@/features/policies/components/repo-policy-picker";
import { getPolicyPickerPageData } from "@/features/policies/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "policies" });
  return { title: t("metadata.picker") };
}

export default async function PoliciesPickerPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("policies.picker");

  const data = await getPolicyPickerPageData();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-wrap-balance">
          <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          {t("title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>
      <RepoPolicyPicker {...data} />
    </div>
  );
}
