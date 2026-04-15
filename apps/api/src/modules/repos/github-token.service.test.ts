import "reflect-metadata";

import type { User } from "@commit-analyzer/database";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CryptoService } from "../../shared/crypto.service.js";

import { GithubTokenService } from "./github-token.service.js";
import { GithubTokenExpiredError } from "./repos.errors.js";

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

describe("GithubTokenService", () => {
  const crypto = new CryptoService(Buffer.alloc(32, 7));
  const users = {
    findByAuthId: vi.fn(),
  };
  let service: GithubTokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new GithubTokenService(users as never, crypto);
  });

  it("decrypts and returns the stored github token", async () => {
    const parts = crypto.encryptParts("gho_secret");
    users.findByAuthId.mockResolvedValue(
      makeUser({
        accessTokenEnc: parts.ciphertext,
        accessTokenIv: parts.iv,
        accessTokenTag: parts.tag,
      }),
    );
    await expect(service.getForUser(USER_ID)).resolves.toBe("gho_secret");
  });

  it("throws token_expired when user has no stored token", async () => {
    users.findByAuthId.mockResolvedValue(makeUser());
    await expect(service.getForUser(USER_ID)).rejects.toBeInstanceOf(
      GithubTokenExpiredError,
    );
  });

  it("throws token_expired when user row is missing", async () => {
    users.findByAuthId.mockResolvedValue(null);
    await expect(service.getForUser(USER_ID)).rejects.toBeInstanceOf(
      GithubTokenExpiredError,
    );
  });

  it("throws token_expired when stored ciphertext is corrupt", async () => {
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
    await expect(service.getForUser(USER_ID)).rejects.toBeInstanceOf(
      GithubTokenExpiredError,
    );
  });
});
