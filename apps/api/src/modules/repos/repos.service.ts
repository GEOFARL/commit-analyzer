import type {
  Repository as RepoEntity,
  RepositoryRepository,
} from "@commit-analyzer/database";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";

import { CacheService } from "../../common/cache/cache.service.js";
import { REPOSITORY_REPOSITORY } from "../../common/database/tokens.js";

import { RepoConnectedEvent } from "./events/repo-connected.event.js";
import { RepoDisconnectedEvent } from "./events/repo-disconnected.event.js";
import { GithubService } from "./github.service.js";
import {
  GITHUB_LIST_TTL_SECONDS,
  githubListCacheKey,
} from "./repos.constants.js";
import {
  RepoAlreadyConnectedError,
  RepoNotFoundError,
} from "./repos.errors.js";
import type { GithubRepoRaw } from "./repos.types.js";

@Injectable()
export class ReposService {
  private readonly logger = new Logger(ReposService.name);

  constructor(
    @Inject(REPOSITORY_REPOSITORY)
    private readonly repos: RepositoryRepository,
    private readonly github: GithubService,
    private readonly cache: CacheService,
    private readonly eventBus: EventBus,
  ) {}

  async listGithubRepos(
    userId: string,
    token: string,
  ): Promise<{ raws: GithubRepoRaw[]; connectedIds: Set<string> }> {
    const key = githubListCacheKey(userId);
    const cached = await this.cache.getJson<GithubRepoRaw[]>(key);
    const raws = cached ?? (await this.github.listMyRepos(token));
    if (!cached) {
      await this.cache.setJson(key, raws, GITHUB_LIST_TTL_SECONDS);
    }

    const connected = await this.repos.listConnectedByUser(userId);
    const connectedIds = new Set<string>(
      connected.map((r: RepoEntity) => r.githubRepoId),
    );
    return { raws, connectedIds };
  }

  listConnected(userId: string): Promise<RepoEntity[]> {
    return this.repos.listConnectedByUser(userId);
  }

  async connect(
    userId: string,
    githubRepoId: number,
    token: string,
  ): Promise<RepoEntity> {
    const githubRepoIdStr = String(githubRepoId);
    const existing = await this.repos.findByUserAndGithubId(
      userId,
      githubRepoIdStr,
    );

    if (existing?.isConnected) {
      throw new RepoAlreadyConnectedError();
    }

    const raw = await this.github.getRepo(token, githubRepoId);

    const saved = existing
      ? await this.reconnectExisting(existing, raw)
      : await this.createNewConnection(userId, raw);

    await this.cache.del(githubListCacheKey(userId));

    this.eventBus.publish(
      new RepoConnectedEvent(saved.id, userId, saved.githubRepoId, saved.fullName),
    );

    return saved;
  }

  async disconnect(userId: string, repoId: string): Promise<void> {
    const existing = await this.repos.findByIdForUser(repoId, userId);
    if (!existing || !existing.isConnected) {
      throw new RepoNotFoundError();
    }

    await this.repos.setConnected(existing.id, false);
    await this.cache.del(githubListCacheKey(userId));

    this.eventBus.publish(
      new RepoDisconnectedEvent(existing.id, userId, existing.githubRepoId),
    );
  }

  private async createNewConnection(
    userId: string,
    raw: GithubRepoRaw,
  ): Promise<RepoEntity> {
    const entity = this.repos.create({
      userId,
      githubRepoId: String(raw.id),
      fullName: raw.full_name,
      description: raw.description,
      defaultBranch: raw.default_branch,
      isConnected: true,
    });
    return this.repos.save(entity);
  }

  private async reconnectExisting(
    existing: RepoEntity,
    raw: GithubRepoRaw,
  ): Promise<RepoEntity> {
    return this.repos.save({
      ...existing,
      fullName: raw.full_name,
      description: raw.description,
      defaultBranch: raw.default_branch,
      isConnected: true,
    });
  }
}
