import type { UserRepository } from "@commit-analyzer/database";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { USER_REPOSITORY } from "../../common/database/tokens.js";
import { CryptoService, DecryptionError } from "../../shared/crypto.service.js";

import { GithubTokenExpiredError } from "./repos.errors.js";

@Injectable()
export class GithubTokenService {
  private readonly logger = new Logger(GithubTokenService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly crypto: CryptoService,
  ) {}

  async getForUser(userId: string): Promise<string> {
    const user = await this.users.findByAuthId(userId);
    if (
      !user ||
      !user.accessTokenEnc ||
      !user.accessTokenIv ||
      !user.accessTokenTag
    ) {
      throw new GithubTokenExpiredError("github access token not on file");
    }
    try {
      return this.crypto.decryptParts({
        ciphertext: user.accessTokenEnc,
        iv: user.accessTokenIv,
        tag: user.accessTokenTag,
      });
    } catch (err) {
      if (err instanceof DecryptionError) {
        this.logger.warn(`github token decryption failed for user=${userId}`);
        throw new GithubTokenExpiredError("github access token unreadable");
      }
      throw err;
    }
  }
}
