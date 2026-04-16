import { Injectable, Logger } from "@nestjs/common";

import type {
  AuthenticatedRepo,
  PluggedOctokitInstance,
  RepoById,
} from "./github.octokit.js";
import {
  GITHUB_LIST_MAX_PAGES,
  GITHUB_LIST_PER_PAGE,
} from "./repos.constants.js";
import { mapOctokitError } from "./repos.errors.js";
import type { GithubRepoRaw } from "./repos.types.js";

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  async listMyRepos(octokit: PluggedOctokitInstance): Promise<GithubRepoRaw[]> {
    try {
      const iterator = octokit.paginate.iterator(
        octokit.rest.repos.listForAuthenticatedUser,
        {
          per_page: GITHUB_LIST_PER_PAGE,
          sort: "updated",
          affiliation: "owner,collaborator",
        },
      );
      const items: GithubRepoRaw[] = [];
      let pages = 0;
      for await (const page of iterator) {
        pages += 1;
        for (const repo of page.data) {
          items.push(GithubService.toRaw(repo));
        }
        if (pages >= GITHUB_LIST_MAX_PAGES) {
          this.logger.warn(
            `github.listMyRepos truncated at ${String(items.length)} items (${String(pages)} pages)`,
          );
          break;
        }
      }
      return items;
    } catch (err) {
      this.logger.warn(`github.listMyRepos failed: ${String(err)}`);
      throw mapOctokitError(err);
    }
  }

  async getRepo(
    octokit: PluggedOctokitInstance,
    githubRepoId: number,
  ): Promise<GithubRepoRaw> {
    try {
      const res = await octokit.request("GET /repositories/{id}", {
        id: githubRepoId,
      });
      return GithubService.toRaw(res.data as unknown as RepoById);
    } catch (err) {
      this.logger.warn(
        `github.getRepo id=${String(githubRepoId)} failed: ${String(err)}`,
      );
      throw mapOctokitError(err);
    }
  }

  private static toRaw(repo: AuthenticatedRepo | RepoById): GithubRepoRaw {
    return {
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      owner: { login: repo.owner.login },
      private: repo.private,
      default_branch: repo.default_branch,
      description: repo.description ?? null,
      html_url: repo.html_url,
      pushed_at: repo.pushed_at ?? null,
      stargazers_count: repo.stargazers_count,
      archived: repo.archived,
    };
  }
}
