import type { PluggedOctokitInstance } from "./github.octokit.js";

export interface GithubRepoRaw {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  description: string | null;
  html_url: string;
  pushed_at: string | null;
  stargazers_count: number;
  archived: boolean;
}

export interface GithubClient {
  listMyRepos(octokit: PluggedOctokitInstance): Promise<GithubRepoRaw[]>;
  getRepo(
    octokit: PluggedOctokitInstance,
    githubRepoId: number,
  ): Promise<GithubRepoRaw>;
}
