import type { UserRepository } from "@commit-analyzer/database";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { USER_REPOSITORY } from "../../common/database/tokens.js";
import { CryptoService, DecryptionError } from "../../shared/crypto.service.js";
import { GithubTokenExpiredError } from "../../shared/github-token-expired.error.js";

import {
  OCTOKIT_REQUEST_TIMEOUT_MS,
  RATE_LIMIT_LOG_INTERVAL,
  RATE_LIMIT_MAX_RETRIES,
} from "./octokit.constants.js";
import {
  PluggedOctokit,
  type PluggedOctokitInstance,
} from "./plugged-octokit.js";

@Injectable()
export class OctokitFactory {
  private readonly logger = new Logger(OctokitFactory.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    private readonly crypto: CryptoService,
  ) {}

  async forUser(userId: string): Promise<PluggedOctokitInstance> {
    const token = await this.decryptToken(userId);
    return this.buildClient(token, userId);
  }

  private async decryptToken(userId: string): Promise<string> {
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

  private buildClient(
    token: string,
    userId: string,
  ): PluggedOctokitInstance {
    let callCount = 0;

    const octokit = new PluggedOctokit({
      auth: token,
      request: { timeout: OCTOKIT_REQUEST_TIMEOUT_MS },
      throttle: {
        onRateLimit: (retryAfter, options, _octokit, retryCount) => {
          this.logger.warn(
            `[user=${userId}] primary rate limit on ${options.method} ${options.url}, ` +
              `retry-after=${retryAfter.toString()}s (attempt ${String(retryCount + 1)})`,
          );
          return retryCount < RATE_LIMIT_MAX_RETRIES;
        },
        onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
          this.logger.warn(
            `[user=${userId}] secondary rate limit on ${options.method} ${options.url}, ` +
              `retry-after=${retryAfter.toString()}s (attempt ${String(retryCount + 1)})`,
          );
          return retryCount < RATE_LIMIT_MAX_RETRIES;
        },
      },
    });

    octokit.hook.after("request", (response) => {
      callCount += 1;
      if (callCount % RATE_LIMIT_LOG_INTERVAL === 0) {
        const remaining =
          response.headers["x-ratelimit-remaining"] ?? "unknown";
        this.logger.log(
          `[user=${userId}] ${String(callCount)} github api calls, ` +
            `rate-limit remaining: ${String(remaining)}`,
        );
      }
    });

    return octokit;
  }
}
