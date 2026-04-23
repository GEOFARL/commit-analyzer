import type { ConnectedRepo } from "@commit-analyzer/contracts";
import { ArrowRight, BarChart3, GitBranch, Plus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

type Props = {
  recentRepos: ConnectedRepo[];
  connectedCount: number;
};

export const RecentRepos = ({ recentRepos, connectedCount }: Props) => {
  const t = useTranslations("dashboard.recentRepos");
  const format = useFormatter();
  const now = new Date();

  if (recentRepos.length === 0) {
    return (
      <Card className="flex flex-col items-start gap-4 border-dashed bg-muted/20 p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <GitBranch className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-base font-semibold">{t("empty.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("empty.description")}
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/repositories">
            <Plus aria-hidden="true" />
            {t("empty.cta")}
          </Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {recentRepos.map((repo) => {
          const lastSyncedLabel = repo.lastSyncedAt
            ? t("lastSynced", {
                time: format.relativeTime(new Date(repo.lastSyncedAt), now),
              })
            : t("neverSynced");

          return (
            <li key={repo.id}>
              <Card className="flex flex-col gap-3 p-4 transition-[transform,box-shadow] motion-safe:hover:-translate-y-0.5 hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <GitBranch
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <span className="truncate font-mono text-sm font-medium">
                      {repo.fullName}
                    </span>
                  </div>
                  <p className="mt-1 pl-6 text-xs text-muted-foreground tabular-nums">
                    {lastSyncedLabel}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/repositories/${repo.id}`}>
                    <BarChart3 aria-hidden="true" />
                    {t("openAnalytics")}
                  </Link>
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>
      {connectedCount > recentRepos.length ? (
        <Button asChild variant="ghost" size="sm" className="self-start">
          <Link href="/repositories">
            {t("viewAll", { count: connectedCount })}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
};
