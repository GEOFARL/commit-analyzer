import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("login");

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("subtitle")}</p>
      <form action="/auth/sign-in" method="post">
        <button type="submit">{t("continueWithGithub")}</button>
      </form>
    </main>
  );
}
