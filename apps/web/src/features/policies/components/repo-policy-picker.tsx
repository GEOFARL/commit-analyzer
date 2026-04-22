import type { ConnectedRepo } from "@commit-analyzer/contracts";
import { ChevronRight, GitBranch, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { PolicyPickerPageData } from "@/features/policies/types";
import { Link } from "@/i18n/navigation";

export const RepoPolicyPicker = ({ initialRepos }: PolicyPickerPageData) => {
  const t = useTranslations("policies.picker");

  if (initialRepos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center text-muted-foreground">
        <GitBranch className="h-8 w-8" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">
          {t("empty.title")}
        </p>
        <p className="max-w-sm text-xs">{t("empty.description")}</p>
        <Button asChild variant="secondary" size="sm">
          <Link href="/repositories">{t("empty.cta")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {initialRepos.map((repo: ConnectedRepo) => (
        <li key={repo.id}>
          <Link
            href={`/repositories/${repo.id}/policies`}
            className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            >
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold text-foreground">
                {repo.fullName}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {t("managePolicies")}
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
};
