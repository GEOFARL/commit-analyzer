import { IsNull, type DataSource, type Repository as OrmRepository } from "typeorm";

import { ApiKey } from "../entities/api-key.entity.js";

export interface ApiKeyRepository extends OrmRepository<ApiKey> {
  findActiveByPrefix(keyPrefix: string): Promise<ApiKey | null>;
  listActiveByUser(userId: string): Promise<ApiKey[]>;
  findActiveByIdForUser(id: string, userId: string): Promise<ApiKey | null>;
  touchLastUsed(id: string, at?: Date): Promise<void>;
  revoke(id: string, at?: Date): Promise<void>;
}

export const createApiKeyRepository = (
  dataSource: DataSource,
): ApiKeyRepository => {
  const base = dataSource.getRepository(ApiKey);
  const extensions: Pick<
    ApiKeyRepository,
    | "findActiveByPrefix"
    | "listActiveByUser"
    | "findActiveByIdForUser"
    | "touchLastUsed"
    | "revoke"
  > = {
    findActiveByPrefix(keyPrefix: string): Promise<ApiKey | null> {
      return base.findOne({ where: { keyPrefix, revokedAt: IsNull() } });
    },
    listActiveByUser(userId: string): Promise<ApiKey[]> {
      return base.find({
        where: { userId, revokedAt: IsNull() },
        order: { createdAt: "DESC" },
      });
    },
    findActiveByIdForUser(
      id: string,
      userId: string,
    ): Promise<ApiKey | null> {
      return base.findOne({
        where: { id, userId, revokedAt: IsNull() },
      });
    },
    async touchLastUsed(id: string, at: Date = new Date()): Promise<void> {
      await base.update({ id }, { lastUsedAt: at });
    },
    async revoke(id: string, at: Date = new Date()): Promise<void> {
      await base.update({ id }, { revokedAt: at });
    },
  };
  return base.extend(extensions) as ApiKeyRepository;
};
