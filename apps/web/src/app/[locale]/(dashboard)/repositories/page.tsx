import type { ConnectedRepo, GithubRepo } from "@commit-analyzer/contracts";
import type { Metadata } from "next";
import { type Locale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t("repositories") };
}

import { RepositoriesView } from "@/components/repositories/repositories-view";
import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InitialData = {
  github: GithubRepo[];
  connected: ConnectedRepo[];
  userId: string;
};

const loadInitialData = async (): Promise<InitialData> => {
  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? null;
  const userId = sessionData.session?.user.id ?? "anonymous";

  const client = createServerTsRestClient(accessToken);

  const [githubRes, connectedRes] = await Promise.all([
    client.repos.listGithub(),
    client.repos.listConnected(),
  ]);

  if (githubRes.status !== 200) {
    throw new Error(
      `Failed to load GitHub repositories (status ${githubRes.status})`,
    );
  }
  if (connectedRes.status !== 200) {
    throw new Error(
      `Failed to load connected repositories (status ${connectedRes.status})`,
    );
  }

  return {
    github: githubRes.body.items,
    connected: connectedRes.body.items,
    userId,
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

  const { github, connected, userId } = await loadInitialData();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <RepositoriesView
        userId={userId}
        initialGithub={github}
        initialConnected={connected}
      />
    </div>
  );
}
