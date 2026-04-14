import { IsNull, type DataSource, type Repository as OrmRepository } from "typeorm";

import { ApiKey } from "../entities/api-key.entity.js";

export interface ApiKeyRepository extends OrmRepository<ApiKey> {
  findActiveByPrefix(keyPrefix: string): Promise<ApiKey | null>;
  touchLastUsed(id: string, at?: Date): Promise<void>;
}

export const createApiKeyRepository = (
  dataSource: DataSource,
): ApiKeyRepository => {
  const base = dataSource.getRepository(ApiKey);
  const extensions: Pick<
    ApiKeyRepository,
    "findActiveByPrefix" | "touchLastUsed"
  > = {
    findActiveByPrefix(keyPrefix: string): Promise<ApiKey | null> {
      return base.findOne({ where: { keyPrefix, revokedAt: IsNull() } });
    },
    async touchLastUsed(id: string, at: Date = new Date()): Promise<void> {
      await base.update({ id }, { lastUsedAt: at });
    },
  };
  return base.extend(extensions) as ApiKeyRepository;
};
