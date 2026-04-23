import type {
  ApiKey as ApiKeyDto,
  LlmApiKey as LlmApiKeyDto,
  User as UserDto,
} from "@commit-analyzer/contracts";
import type {
  ApiKey as ApiKeyEntity,
  LLMApiKey as LLMApiKeyEntity,
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

// No plaintext, IV, tag, or key material is projected into the response —
// the entity's encryption columns are deliberately never read here. Matches
// the shape declared in docs/03-modules/F-settings.md §2.
export const toLlmApiKeyDto = (record: LLMApiKeyEntity): LlmApiKeyDto => ({
  id: record.id,
  provider: record.provider,
  status: record.status,
  createdAt: record.createdAt.toISOString(),
});
