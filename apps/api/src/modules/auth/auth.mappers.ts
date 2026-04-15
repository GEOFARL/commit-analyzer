import type {
  ApiKey as ApiKeyDto,
  User as UserDto,
} from "@commit-analyzer/contracts";
import type {
  ApiKey as ApiKeyEntity,
  User as UserEntity,
} from "@commit-analyzer/database";

export const toUserDto = (user: UserEntity): UserDto => ({
  id: user.id,
  email: user.email,
  name: user.username,
  avatarUrl: user.avatarUrl,
  createdAt: user.createdAt.toISOString(),
});

export const toApiKeyDto = (record: ApiKeyEntity): ApiKeyDto => ({
  id: record.id,
  name: record.name,
  prefix: record.keyPrefix,
  lastUsedAt: record.lastUsedAt ? record.lastUsedAt.toISOString() : null,
  createdAt: record.createdAt.toISOString(),
});
