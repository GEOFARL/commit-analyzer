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
  listMyRepos(token: string): Promise<GithubRepoRaw[]>;
  getRepo(token: string, githubRepoId: number): Promise<GithubRepoRaw>;
}
