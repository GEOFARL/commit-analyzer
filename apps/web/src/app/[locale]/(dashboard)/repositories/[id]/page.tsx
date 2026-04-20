import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { getAnalyticsPageData } from "@/features/analytics/server";
import { SyncNowButton } from "@/features/sync/components/sync-now-button";
import { SyncProgressBanner } from "@/features/sync/components/sync-progress-banner";
import { SyncProgressProvider } from "@/features/sync/components/sync-progress-context";
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
      <SyncProgressProvider repoId={data.repo.id}>
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
              <li aria-hidden="true" className="flex items-center">
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className="truncate text-foreground" aria-current="page">
                {data.repo.fullName}
              </li>
            </ol>
          </nav>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-wrap-balance">
                {t("title", { repo: data.repo.fullName })}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("subtitle")}
              </p>
            </div>
            <SyncNowButton
              repoId={data.repo.id}
              lastSyncedAt={data.repo.lastSyncedAt}
              className="sm:flex-shrink-0"
            />
          </div>
        </div>
        <SyncProgressBanner repoId={data.repo.id} />
        <AnalyticsView {...data} />
      </SyncProgressProvider>
    </div>
  );
}
