import type { ConnectedRepo, GithubRepo } from "@commit-analyzer/contracts";
import { cookies } from "next/headers";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { RepositoriesView } from "@/components/repositories/repositories-view";
import { createServerClient } from "@/lib/api/tsr";

const loadInitialData = async (): Promise<{
  github: GithubRepo[];
  connected: ConnectedRepo[];
}> => {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const client = createServerClient(
    cookieHeader ? { cookie: cookieHeader } : {},
  );

  const [githubRes, connectedRes] = await Promise.all([
    client.repos.listGithub().catch(() => null),
    client.repos.listConnected().catch(() => null),
  ]);

  return {
    github:
      githubRes && githubRes.status === 200 ? githubRes.body.items : [],
    connected:
      connectedRes && connectedRes.status === 200
        ? connectedRes.body.items
        : [],
  };
};

export default async function RepositoriesPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("repositories");

  const { github, connected } = await loadInitialData();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <RepositoriesView
        initialGithub={github}
        initialConnected={connected}
      />
    </div>
  );
}
