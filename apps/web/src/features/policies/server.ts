import "server-only";

import type { ConnectedRepo } from "@commit-analyzer/contracts";
import { notFound } from "next/navigation";

import { createServerTsRestClient } from "@/lib/api/tsr";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import type {
  PoliciesListPageData,
  PolicyEditorPageData,
  PolicyPickerPageData,
} from "./types";

const loadSession = async () => {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? null;
  const userId = data.session?.user.id ?? "anonymous";
  return { accessToken, userId };
};

const resolveRepo = async (
  repoId: string,
  accessToken: string | null,
): Promise<ConnectedRepo> => {
  const client = createServerTsRestClient(accessToken);
  const res = await client.repos.listConnected();
  if (res.status !== 200) {
    throw new Error(`Failed to load connected repositories (status ${res.status})`);
  }
  const repo = res.body.items.find((r) => r.id === repoId);
  if (!repo) notFound();
  return repo;
};

export const getPoliciesListPageData = async (
  repoId: string,
): Promise<PoliciesListPageData> => {
  const { accessToken, userId } = await loadSession();
  const client = createServerTsRestClient(accessToken);

  const [repo, policiesRes] = await Promise.all([
    resolveRepo(repoId, accessToken),
    client.policies.list({ params: { repoId } }),
  ]);

  if (policiesRes.status === 404) notFound();
  if (policiesRes.status !== 200) {
    throw new Error(`Failed to load policies (status ${policiesRes.status})`);
  }

  return { userId, repo, initialItems: policiesRes.body.items };
};

export const getPolicyEditorPageData = async (
  repoId: string,
  policyId: string,
): Promise<PolicyEditorPageData> => {
  const { accessToken, userId } = await loadSession();
  const client = createServerTsRestClient(accessToken);

  const [repo, policyRes] = await Promise.all([
    resolveRepo(repoId, accessToken),
    client.policies.get({ params: { repoId, id: policyId } }),
  ]);

  if (policyRes.status === 404) notFound();
  if (policyRes.status !== 200) {
    throw new Error(`Failed to load policy (status ${policyRes.status})`);
  }

  return { userId, repo, initialPolicy: policyRes.body };
};

export const getPolicyPickerPageData =
  async (): Promise<PolicyPickerPageData> => {
    const { accessToken } = await loadSession();
    const client = createServerTsRestClient(accessToken);
    const res = await client.repos.listConnected();
    if (res.status !== 200) {
      throw new Error(
        `Failed to load connected repositories (status ${res.status})`,
      );
    }
    return { initialRepos: res.body.items };
  };
