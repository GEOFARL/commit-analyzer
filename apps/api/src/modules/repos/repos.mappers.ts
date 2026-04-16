import type { ConnectedRepo, GithubRepo } from "@commit-analyzer/contracts";
import type { Repository } from "@commit-analyzer/database";

import type { GithubRepoRaw } from "./repos.types.js";

export const toGithubRepoDto = (
  raw: GithubRepoRaw,
  connectedGithubIds: ReadonlySet<string>,
): GithubRepo => ({
  githubRepoId: raw.id,
  owner: raw.owner.login,
  name: raw.name,
  fullName: raw.full_name,
  private: raw.private,
  defaultBranch: raw.default_branch,
  description: raw.description,
  htmlUrl: raw.html_url,
  connected: connectedGithubIds.has(String(raw.id)),
  pushedAt: raw.pushed_at,
  stargazersCount: raw.stargazers_count,
  archived: raw.archived,
});

export const toConnectedRepoDto = (entity: Repository): ConnectedRepo => {
  // GitHub's `full_name` is always `<owner>/<repo>`; we rely on that invariant
  // when splitting here instead of carrying nullable fallbacks forward.
  const [owner = "", name = ""] = entity.fullName.split("/", 2);
  return {
    id: entity.id,
    githubRepoId: Number(entity.githubRepoId),
    owner,
    name,
    fullName: entity.fullName,
    defaultBranch: entity.defaultBranch ?? "main",
    lastSyncedAt: entity.lastSyncedAt ? entity.lastSyncedAt.toISOString() : null,
    createdAt: entity.createdAt.toISOString(),
  };
};
