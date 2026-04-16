import { describe, expect, it } from "vitest";

import {
  connectedRepoSchema,
  githubRepoSchema,
  reposContract,
} from "./repos.contract.js";

const validGithubRepo = {
  githubRepoId: 123456,
  owner: "octocat",
  name: "hello-world",
  fullName: "octocat/hello-world",
  private: false,
  defaultBranch: "main",
  description: "demo",
  htmlUrl: "https://github.com/octocat/hello-world",
  connected: false,
  pushedAt: "2026-04-10T00:00:00.000Z",
  stargazersCount: 42,
  archived: false,
};

const validConnectedRepo = {
  id: "2f5c1e3a-9d4b-4a7e-8f2c-1b3d4e5f6a7b",
  githubRepoId: 123456,
  owner: "octocat",
  name: "hello-world",
  fullName: "octocat/hello-world",
  defaultBranch: "main",
  lastSyncedAt: null,
  createdAt: "2026-04-14T10:00:00.000Z",
};

describe("githubRepoSchema", () => {
  it("parses a valid github repo", () => {
    expect(githubRepoSchema.parse(validGithubRepo)).toEqual(validGithubRepo);
  });

  it("rejects a non-url html url", () => {
    expect(() =>
      githubRepoSchema.parse({ ...validGithubRepo, htmlUrl: "not a url" }),
    ).toThrow();
  });

  it("rejects a non-positive github id", () => {
    expect(() =>
      githubRepoSchema.parse({ ...validGithubRepo, githubRepoId: 0 }),
    ).toThrow();
  });
});

describe("connectedRepoSchema", () => {
  it("parses a valid connected repo", () => {
    expect(connectedRepoSchema.parse(validConnectedRepo)).toEqual(validConnectedRepo);
  });

  it("rejects when createdAt is not ISO datetime", () => {
    expect(() =>
      connectedRepoSchema.parse({ ...validConnectedRepo, createdAt: "yesterday" }),
    ).toThrow();
  });
});

describe("reposContract", () => {
  it("declares every endpoint in scope", () => {
    expect(reposContract.listGithub.method).toBe("GET");
    expect(reposContract.listGithub.path).toBe("/repos/github");
    expect(reposContract.listConnected.method).toBe("GET");
    expect(reposContract.listConnected.path).toBe("/repos");
    expect(reposContract.connect.method).toBe("POST");
    expect(reposContract.connect.path).toBe("/repos/:githubRepoId/connect");
    expect(reposContract.disconnect.method).toBe("DELETE");
    expect(reposContract.disconnect.path).toBe("/repos/:repoId");
  });

  it("tags every repo endpoint with jwt", () => {
    expect(reposContract.listGithub.metadata).toEqual({ auth: "jwt", rateLimit: "default" });
    expect(reposContract.listConnected.metadata).toEqual({ auth: "jwt", rateLimit: "default" });
    expect(reposContract.connect.metadata).toEqual({ auth: "jwt", rateLimit: "default" });
    expect(reposContract.disconnect.metadata).toEqual({ auth: "jwt", rateLimit: "default" });
  });
});
