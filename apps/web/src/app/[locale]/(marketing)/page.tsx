import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LanguageToggle } from "@/components/layout/language-toggle";
import { Link } from "@/i18n/navigation";

export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("tagline")}</p>
      <Link href="/login">{t("cta")}</Link>
      <LanguageToggle />
    </main>
  );
}
