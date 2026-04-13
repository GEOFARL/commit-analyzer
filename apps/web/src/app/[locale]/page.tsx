import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LanguageToggle } from "@/components/language-toggle";
import { routing } from "@/i18n/routing";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("tagline")}</p>
      <button type="button">{t("cta")}</button>
      <LanguageToggle />
    </main>
  );
}
