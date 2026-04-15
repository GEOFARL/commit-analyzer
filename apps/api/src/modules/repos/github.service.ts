import { Injectable, Logger } from "@nestjs/common";
import { Octokit } from "@octokit/rest";

import { mapOctokitError } from "./repos.errors.js";
import type { GithubClient, GithubRepoRaw } from "./repos.types.js";

@Injectable()
export class GithubService implements GithubClient {
  private readonly logger = new Logger(GithubService.name);

  private client(token: string): Octokit {
    return new Octokit({ auth: token, request: { timeout: 10_000 } });
  }

  async listMyRepos(token: string): Promise<GithubRepoRaw[]> {
    try {
      const octokit = this.client(token);
      const iterator = octokit.paginate.iterator(
        octokit.rest.repos.listForAuthenticatedUser,
        { per_page: 100, sort: "updated", affiliation: "owner,collaborator" },
      );
      const items: GithubRepoRaw[] = [];
      for await (const page of iterator) {
        for (const r of page.data) {
          items.push({
            id: r.id,
            name: r.name,
            full_name: r.full_name,
            owner: { login: r.owner.login },
            private: r.private,
            default_branch: r.default_branch,
            description: r.description ?? null,
            html_url: r.html_url,
          });
        }
      }
      return items;
    } catch (err) {
      this.logger.warn(`github.listMyRepos failed: ${String(err)}`);
      throw mapOctokitError(err);
    }
  }

  async getRepo(token: string, githubRepoId: number): Promise<GithubRepoRaw> {
    try {
      const octokit = this.client(token);
      const res = await octokit.request("GET /repositories/{id}", {
        id: githubRepoId,
      });
      const r = res.data as unknown as GithubRepoRaw;
      return {
        id: r.id,
        name: r.name,
        full_name: r.full_name,
        owner: { login: r.owner.login },
        private: r.private,
        default_branch: r.default_branch,
        description: r.description ?? null,
        html_url: r.html_url,
      };
    } catch (err) {
      this.logger.warn(`github.getRepo id=${String(githubRepoId)} failed: ${String(err)}`);
      throw mapOctokitError(err);
    }
  }
}
