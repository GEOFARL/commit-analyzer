import "reflect-metadata";

import type { Repository as RepoEntity } from "@commit-analyzer/database";
import { HttpStatus } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RepoConnectedEvent } from "./events/repo-connected.event.js";
import { RepoDisconnectedEvent } from "./events/repo-disconnected.event.js";
import {
  GithubUpstreamError,
  RepoAlreadyConnectedError,
  RepoNotFoundError,
} from "./repos.errors.js";
import { ReposService } from "./repos.service.js";
import type { GithubRepoRaw } from "./repos.types.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const REPO_ID = "22222222-2222-2222-2222-222222222222";
const GH_ID = 98765;
const TOKEN = "gho_test_token";

const rawRepo = (overrides: Partial<GithubRepoRaw> = {}): GithubRepoRaw => ({
  id: GH_ID,
  name: "hello-world",
  full_name: "octocat/hello-world",
  owner: { login: "octocat" },
  private: false,
  default_branch: "main",
  description: "demo",
  html_url: "https://github.com/octocat/hello-world",
  ...overrides,
});

const repoEntity = (overrides: Partial<RepoEntity> = {}): RepoEntity =>
  ({
    id: REPO_ID,
    userId: USER_ID,
    githubRepoId: String(GH_ID),
    fullName: "octocat/hello-world",
    description: "demo",
    defaultBranch: "main",
    language: null,
    stars: 0,
    isConnected: true,
    lastSyncedAt: null,
    createdAt: new Date("2026-04-10T00:00:00.000Z"),
    ...overrides,
  }) as unknown as RepoEntity;

describe("ReposService", () => {
  const publish = vi.fn();
  const repos = {
    listConnectedByUser: vi.fn(),
    findByUserAndGithubId: vi.fn(),
    findByIdForUser: vi.fn(),
    setConnected: vi.fn(),
    create: vi.fn((v: Partial<RepoEntity>) => v as RepoEntity),
    save: vi.fn(),
  };
  const github = {
    listMyRepos: vi.fn(),
    getRepo: vi.fn(),
  };
  const cache = {
    getJson: vi.fn(),
    setJson: vi.fn(),
    del: vi.fn(),
  };

  let service: ReposService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ReposService(
      repos as never,
      github as never,
      cache as never,
      { publish } as never,
    );
  });

  describe("listGithubRepos", () => {
    it("fetches from GitHub and caches when cache miss", async () => {
      cache.getJson.mockResolvedValue(null);
      github.listMyRepos.mockResolvedValue([rawRepo()]);
      repos.listConnectedByUser.mockResolvedValue([]);

      const result = await service.listGithubRepos(USER_ID, TOKEN);

      expect(github.listMyRepos).toHaveBeenCalledWith(TOKEN);
      expect(cache.setJson).toHaveBeenCalledWith(
        `repos:github:list:${USER_ID}`,
        [rawRepo()],
        60,
      );
      expect(result.raws).toHaveLength(1);
      expect(result.connectedIds.size).toBe(0);
    });

    it("uses cached data on cache hit and skips github call", async () => {
      cache.getJson.mockResolvedValue([rawRepo()]);
      repos.listConnectedByUser.mockResolvedValue([repoEntity()]);

      const result = await service.listGithubRepos(USER_ID, TOKEN);

      expect(github.listMyRepos).not.toHaveBeenCalled();
      expect(cache.setJson).not.toHaveBeenCalled();
      expect(result.connectedIds.has(String(GH_ID))).toBe(true);
    });

    it("surfaces octokit errors mapped to upstream exception", async () => {
      cache.getJson.mockResolvedValue(null);
      github.listMyRepos.mockRejectedValue(
        new GithubUpstreamError(HttpStatus.TOO_MANY_REQUESTS, "rate limited", 30),
      );
      await expect(
        service.listGithubRepos(USER_ID, TOKEN),
      ).rejects.toBeInstanceOf(GithubUpstreamError);
    });
  });

  describe("connect", () => {
    it("creates a new connection, invalidates cache, publishes event", async () => {
      repos.findByUserAndGithubId.mockResolvedValue(null);
      github.getRepo.mockResolvedValue(rawRepo());
      const saved = repoEntity();
      repos.save.mockResolvedValue(saved);

      const result = await service.connect(USER_ID, GH_ID, TOKEN);

      expect(github.getRepo).toHaveBeenCalledWith(TOKEN, GH_ID);
      expect(repos.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          githubRepoId: String(GH_ID),
          fullName: "octocat/hello-world",
          isConnected: true,
        }),
      );
      expect(cache.del).toHaveBeenCalledWith(`repos:github:list:${USER_ID}`);
      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0]?.[0] as RepoConnectedEvent;
      expect(event).toBeInstanceOf(RepoConnectedEvent);
      expect(event.repositoryId).toBe(saved.id);
      expect(event.userId).toBe(USER_ID);
      expect(result).toBe(saved);
    });

    it("throws 409 when repo already connected", async () => {
      repos.findByUserAndGithubId.mockResolvedValue(repoEntity({ isConnected: true }));

      await expect(
        service.connect(USER_ID, GH_ID, TOKEN),
      ).rejects.toBeInstanceOf(RepoAlreadyConnectedError);
      expect(github.getRepo).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it("reconnects a previously disconnected repo without inserting", async () => {
      repos.findByUserAndGithubId.mockResolvedValue(
        repoEntity({ isConnected: false }),
      );
      github.getRepo.mockResolvedValue(rawRepo());
      repos.save.mockImplementation((v: RepoEntity) => Promise.resolve(v));

      await service.connect(USER_ID, GH_ID, TOKEN);

      expect(repos.create).not.toHaveBeenCalled();
      expect(repos.save).toHaveBeenCalledTimes(1);
      const savedArg = repos.save.mock.calls[0]?.[0] as RepoEntity;
      expect(savedArg.isConnected).toBe(true);
      expect(publish).toHaveBeenCalledTimes(1);
    });

    it("bubbles octokit errors from getRepo", async () => {
      repos.findByUserAndGithubId.mockResolvedValue(null);
      github.getRepo.mockRejectedValue(
        new GithubUpstreamError(HttpStatus.BAD_GATEWAY, "upstream"),
      );
      await expect(
        service.connect(USER_ID, GH_ID, TOKEN),
      ).rejects.toBeInstanceOf(GithubUpstreamError);
      expect(repos.save).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });
  });

  describe("disconnect", () => {
    it("soft-deletes, invalidates cache, publishes event", async () => {
      const existing = repoEntity();
      repos.findByIdForUser.mockResolvedValue(existing);

      await service.disconnect(USER_ID, REPO_ID);

      expect(repos.findByIdForUser).toHaveBeenCalledWith(REPO_ID, USER_ID);
      expect(repos.setConnected).toHaveBeenCalledWith(existing.id, false);
      expect(cache.del).toHaveBeenCalledWith(`repos:github:list:${USER_ID}`);
      expect(publish).toHaveBeenCalledTimes(1);
      const event = publish.mock.calls[0]?.[0] as RepoDisconnectedEvent;
      expect(event).toBeInstanceOf(RepoDisconnectedEvent);
      expect(event.repositoryId).toBe(existing.id);
    });

    it("throws 404 when repo not owned by user", async () => {
      repos.findByIdForUser.mockResolvedValue(null);
      await expect(
        service.disconnect(USER_ID, REPO_ID),
      ).rejects.toBeInstanceOf(RepoNotFoundError);
      expect(repos.setConnected).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it("throws 404 when repo already disconnected (prevents double-publish)", async () => {
      repos.findByIdForUser.mockResolvedValue(
        repoEntity({ isConnected: false }),
      );
      await expect(
        service.disconnect(USER_ID, REPO_ID),
      ).rejects.toBeInstanceOf(RepoNotFoundError);
      expect(publish).not.toHaveBeenCalled();
    });
  });
});

