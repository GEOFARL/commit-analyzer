import { randomBytes } from "node:crypto";

import type {
  ApiKey,
  ApiKeyRepository,
  UpsertUserFromAuthInput,
  User,
  UserRepository,
} from "@commit-analyzer/database";
import {
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import argon2 from "argon2";

import {
  API_KEY_REPOSITORY,
  USER_REPOSITORY,
} from "../../common/database/tokens.js";
import { CryptoService } from "../../shared/crypto.service.js";

import {
  API_KEY_BYTES,
  API_KEY_MINT_MAX_ATTEMPTS,
  API_KEY_PRE,
  API_KEY_PREFIX_LENGTH,
  ARGON2_OPTS,
} from "./auth.constants.js";
import { isUniqueViolation } from "./auth.errors.js";
import type { MintedApiKey } from "./auth.types.js";
import { ApiKeyCreatedEvent } from "./events/api-key-created.event.js";
import { ApiKeyRevokedEvent } from "./events/api-key-revoked.event.js";
import { SupabaseAdminService } from "./supabase-admin.service.js";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(API_KEY_REPOSITORY) private readonly apiKeys: ApiKeyRepository,
    private readonly eventBus: EventBus,
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly crypto: CryptoService,
  ) {}

  async me(userId: string): Promise<User> {
    const existing = await this.users.findByAuthId(userId);
    if (existing) return existing;

    // Safety net: if the web auth callback didn't (or couldn't) POST
    // /auth/sync, materialize the mirror row on the first authenticated
    // request so /me never 401s for a valid Supabase session. This path
    // deliberately passes a null providerToken — we don't have the OAuth
    // token here, so any GitHub call will surface 401 token_expired and
    // force the client back through /auth/sync.
    const mirrored = await this.mirrorFromAdmin(userId, null);
    if (!mirrored) throw new UnauthorizedException("user not found");
    return mirrored;
  }

  async sync(userId: string, providerToken: string | null): Promise<User> {
    const mirrored = await this.mirrorFromAdmin(userId, providerToken);
    if (!mirrored) throw new UnauthorizedException("user not found");
    return mirrored;
  }

  private async mirrorFromAdmin(
    userId: string,
    providerToken: string | null,
  ): Promise<User | null> {
    const identity = await this.supabaseAdmin.getUserById(userId);
    if (!identity) return null;

    const input: UpsertUserFromAuthInput = {
      id: identity.id,
      githubId: identity.githubId,
      email: identity.email,
      username: identity.username,
      avatarUrl: identity.avatarUrl,
    };

    if (providerToken) {
      input.accessToken = this.crypto.encryptParts(providerToken);
    }

    return this.users.upsertFromAuth(input);
  }

  listApiKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeys.listActiveByUser(userId);
  }

  async mintApiKey(userId: string, name: string): Promise<MintedApiKey> {
    // Prefix space is ~16M, collisions are vanishingly rare, but the docs
    // (03-modules/A-auth-and-repos.md §8) require a bounded retry loop so a
    // freak unique-violation on `key_prefix` doesn't surface as 500.
    for (let attempt = 1; attempt <= API_KEY_MINT_MAX_ATTEMPTS; attempt++) {
      const secret = `${API_KEY_PRE}${randomBytes(API_KEY_BYTES).toString("base64url")}`;
      const keyPrefix = secret.slice(0, API_KEY_PREFIX_LENGTH);
      const keyHash = await argon2.hash(secret, ARGON2_OPTS);

      try {
        const record = await this.apiKeys.save(
          this.apiKeys.create({ userId, name, keyPrefix, keyHash }),
        );

        this.eventBus.publish(
          new ApiKeyCreatedEvent(record.id, record.name, record.keyPrefix),
        );

        return { key: secret, record };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        this.logger.warn(
          `api_key prefix collision (attempt ${attempt.toString()}/${API_KEY_MINT_MAX_ATTEMPTS.toString()})`,
        );
      }
    }

    throw new InternalServerErrorException(
      "failed to mint api key (prefix collision)",
    );
  }

  async revokeApiKey(userId: string, apiKeyId: string): Promise<void> {
    const record = await this.apiKeys.findActiveByIdForUser(apiKeyId, userId);
    if (!record) throw new NotFoundException("api key not found");

    await this.apiKeys.revoke(record.id);

    this.eventBus.publish(
      new ApiKeyRevokedEvent(record.id, record.keyPrefix),
    );
  }
}
