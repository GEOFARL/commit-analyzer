import { Injectable, Logger } from "@nestjs/common";

import {
  AuthenticatedRepo,
  PluggedOctokit,
  type PluggedOctokitInstance,
  RepoById,
} from "./github.octokit.js";
import {
  GITHUB_LIST_MAX_PAGES,
  GITHUB_LIST_PER_PAGE,
  GITHUB_REQUEST_TIMEOUT_MS,
} from "./repos.constants.js";
import { mapOctokitError } from "./repos.errors.js";
import type { GithubClient, GithubRepoRaw } from "./repos.types.js";

@Injectable()
export class GithubService implements GithubClient {
  private readonly logger = new Logger(GithubService.name);

  private client(token: string): PluggedOctokitInstance {
    return new PluggedOctokit({
      auth: token,
      request: { timeout: GITHUB_REQUEST_TIMEOUT_MS },
      // Octokit's throttling plugin handles primary + secondary rate limits:
      // on the first hit we let it retry once (per GitHub's recommendation);
      // beyond that we surface the error so `mapOctokitError` translates it
      // to a 429 with `Retry-After` for the caller.
      throttle: {
        onRateLimit: (retryAfter, options, _octokit, retryCount) => {
          this.logger.warn(
            `github primary rate limit on ${options.method} ${options.url}, retry-after=${retryAfter.toString()}s`,
          );
          return retryCount < 1;
        },
        onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
          this.logger.warn(
            `github secondary rate limit on ${options.method} ${options.url}, retry-after=${retryAfter.toString()}s`,
          );
          return retryCount < 1;
        },
      },
    });
  }

  async listMyRepos(token: string): Promise<GithubRepoRaw[]> {
    try {
      const octokit = this.client(token);
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

  async getRepo(token: string, githubRepoId: number): Promise<GithubRepoRaw> {
    try {
      const octokit = this.client(token);
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
    };
  }
}
