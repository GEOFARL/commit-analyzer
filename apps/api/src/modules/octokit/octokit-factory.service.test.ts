import "reflect-metadata";

import type { User } from "@commit-analyzer/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CryptoService } from "../../shared/crypto.service.js";
import { GithubTokenExpiredError } from "../../shared/github-token-expired.error.js";

import { OctokitFactory } from "./octokit-factory.service.js";

const USER_ID = "11111111-1111-1111-1111-111111111111";

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: USER_ID,
    githubId: "gh-1",
    email: null,
    username: null,
    avatarUrl: null,
    accessTokenEnc: null,
    accessTokenIv: null,
    accessTokenTag: null,
    defaultPolicyTemplate: null,
    createdAt: new Date(),
    repositories: [],
    apiKeys: [],
    llmApiKeys: [],
    ...overrides,
  }) as unknown as User;

describe("OctokitFactory", () => {
  const crypto = new CryptoService(Buffer.alloc(32, 7));
  const users = { findByAuthId: vi.fn() };
  let factory: OctokitFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    factory = new OctokitFactory(users as never, crypto);
  });

  it("returns an octokit instance for a valid user", async () => {
    const parts = crypto.encryptParts("gho_secret");
    users.findByAuthId.mockResolvedValue(
      makeUser({
        accessTokenEnc: parts.ciphertext,
        accessTokenIv: parts.iv,
        accessTokenTag: parts.tag,
      }),
    );
    const client = await factory.forUser(USER_ID);
    expect(client).toBeDefined();
    expect(client.rest).toBeDefined();
    expect(client.paginate).toBeDefined();
  });

  it("throws when user has no stored token", async () => {
    users.findByAuthId.mockResolvedValue(makeUser());
    await expect(factory.forUser(USER_ID)).rejects.toBeInstanceOf(
      GithubTokenExpiredError,
    );
  });

  it("throws when user row is missing", async () => {
    users.findByAuthId.mockResolvedValue(null);
    await expect(factory.forUser(USER_ID)).rejects.toBeInstanceOf(
      GithubTokenExpiredError,
    );
  });

  it("throws when stored ciphertext is corrupt", async () => {
    const parts = crypto.encryptParts("gho_secret");
    const corrupt = Buffer.from(parts.ciphertext);
    corrupt[0] = (corrupt[0] ?? 0) ^ 0xff;
    users.findByAuthId.mockResolvedValue(
      makeUser({
        accessTokenEnc: corrupt,
        accessTokenIv: parts.iv,
        accessTokenTag: parts.tag,
      }),
    );
    await expect(factory.forUser(USER_ID)).rejects.toBeInstanceOf(
      GithubTokenExpiredError,
    );
  });

  it("returns separate instances per call", async () => {
    const parts = crypto.encryptParts("gho_secret");
    users.findByAuthId.mockResolvedValue(
      makeUser({
        accessTokenEnc: parts.ciphertext,
        accessTokenIv: parts.iv,
        accessTokenTag: parts.tag,
      }),
    );
    const a = await factory.forUser(USER_ID);
    const b = await factory.forUser(USER_ID);
    expect(a).not.toBe(b);
  });
});
