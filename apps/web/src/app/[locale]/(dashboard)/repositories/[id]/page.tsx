import type { Metadata } from "next";
import Link from "next/link";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { getAnalyticsPageData } from "@/features/analytics/server";

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
        <nav className="text-xs text-muted-foreground">
          <Link
            href={`/${locale}/repositories`}
            className="hover:text-foreground"
          >
            {t("breadcrumb.repositories")}
          </Link>
          <span aria-hidden="true" className="mx-2">
            /
          </span>
          <span className="text-foreground">{data.repo.fullName}</span>
        </nav>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-wrap-balance">
          {t("title", { repo: data.repo.fullName })}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <Suspense fallback={null}>
        <AnalyticsView {...data} />
      </Suspense>
    </div>
  );
}
