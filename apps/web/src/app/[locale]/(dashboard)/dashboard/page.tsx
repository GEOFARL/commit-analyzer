import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("dashboard");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("placeholder")}</p>
    </main>
  );
}
