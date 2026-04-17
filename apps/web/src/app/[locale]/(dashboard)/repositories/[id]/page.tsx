import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { getAnalyticsPageData } from "@/features/analytics/server";
import { Link } from "@/i18n/navigation";

type PageParams = { locale: Locale; id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "analytics" });
  return { title: t("metadata.title") };
}

export default async function RepositoryAnalyticsPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("analytics");

  const data = await getAnalyticsPageData(id);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <nav aria-label={t("breadcrumb.label")} className="text-xs">
          <ol className="flex items-center gap-2 text-muted-foreground">
            <li>
              <Link
                href="/repositories"
                className="rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t("breadcrumb.repositories")}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="truncate text-foreground" aria-current="page">
              {data.repo.fullName}
            </li>
          </ol>
        </nav>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-wrap-balance">
          {t("title", { repo: data.repo.fullName })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <AnalyticsView {...data} />
    </div>
  );
}
