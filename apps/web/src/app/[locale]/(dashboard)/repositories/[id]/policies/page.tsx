import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { PoliciesListView } from "@/features/policies/components/policies-list-view";
import { getPoliciesListPageData } from "@/features/policies/server";
import { Link } from "@/i18n/navigation";

type PageParams = { locale: Locale; id: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "policies" });
  return { title: t("metadata.list") };
}

export default async function RepositoryPoliciesPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("policies");

  const data = await getPoliciesListPageData(id);

  return (
    <div className="flex flex-col gap-8">
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
          <li>
            <Link
              href={`/repositories/${data.repo.id}`}
              className="truncate rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {data.repo.fullName}
            </Link>
          </li>
          <li aria-hidden="true" className="flex items-center">
            <ChevronRight className="h-3.5 w-3.5" />
          </li>
          <li className="truncate text-foreground" aria-current="page">
            {t("breadcrumb.policies")}
          </li>
        </ol>
      </nav>
      <PoliciesListView {...data} />
    </div>
  );
}
