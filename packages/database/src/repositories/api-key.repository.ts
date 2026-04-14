import type { DataSource, Repository as OrmRepository } from "typeorm";

import { ApiKey } from "../entities/api-key.entity.js";

export interface ApiKeyRepository extends OrmRepository<ApiKey> {
  findByPrefix(keyPrefix: string): Promise<ApiKey | null>;
  touchLastUsed(id: string, at?: Date): Promise<void>;
}

export const createApiKeyRepository = (
  dataSource: DataSource,
): ApiKeyRepository =>
  dataSource.getRepository(ApiKey).extend({
    findByPrefix(this: OrmRepository<ApiKey>, keyPrefix: string) {
      return this.findOne({ where: { keyPrefix } });
    },
    async touchLastUsed(
      this: OrmRepository<ApiKey>,
      id: string,
      at: Date = new Date(),
    ) {
      await this.update({ id }, { lastUsedAt: at });
    },
  }) as ApiKeyRepository;
