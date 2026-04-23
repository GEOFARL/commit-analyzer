import { useTranslations } from "next-intl";

import type { DashboardPageData } from "../types";

import { QuickActions } from "./quick-actions";
import { QuickGenerate } from "./quick-generate";
import { RecentRepos } from "./recent-repos";

export const DashboardView = ({
  userName,
  recentRepos,
  connectedCount,
  hasLlmKey,
}: DashboardPageData) => {
  const t = useTranslations("dashboard");

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-balance bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-3xl font-semibold tracking-tight text-transparent">
          {userName
            ? t("welcomeNamed", { name: userName })
            : t("welcome")}
        </h1>
        <p className="text-sm text-muted-foreground">{t("welcomeHelper")}</p>
      </header>

      <section aria-labelledby="dashboard-recent-repos" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2
            id="dashboard-recent-repos"
            className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {t("recentRepos.heading")}
          </h2>
        </div>
        <RecentRepos recentRepos={recentRepos} connectedCount={connectedCount} />
      </section>

      <section aria-labelledby="dashboard-quick-generate" className="flex flex-col gap-3">
        <h2
          id="dashboard-quick-generate"
          className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("quickGenerate.heading")}
        </h2>
        <QuickGenerate hasLlmKey={hasLlmKey} />
      </section>

      <section aria-labelledby="dashboard-quick-actions" className="flex flex-col gap-3">
        <h2
          id="dashboard-quick-actions"
          className="text-sm font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {t("quickActions.heading")}
        </h2>
        <QuickActions />
      </section>
    </div>
  );
};
