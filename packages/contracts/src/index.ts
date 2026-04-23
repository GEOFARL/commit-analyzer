import { initContract } from "@ts-rest/core";

import { analyticsContract } from "./analytics.contract.js";
import { auditContract } from "./audit.contract.js";
import { authContract } from "./auth.contract.js";
import { llmKeysContract } from "./llm-keys.contract.js";
import { policiesContract } from "./policies.contract.js";
import { reposContract } from "./repos.contract.js";

const c = initContract();

export const contracts = c.router({
  auth: authContract,
  audit: auditContract,
  analytics: analyticsContract,
  repos: reposContract,
  policies: policiesContract,
  llmKeys: llmKeysContract,
});

export type Contracts = typeof contracts;

export { authContract } from "./auth.contract.js";
export type {
  ApiKey,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  User,
} from "./auth.contract.js";
export {
  apiKeySchema,
  createApiKeyRequestSchema,
  createApiKeyResponseSchema,
  userSchema,
} from "./auth.contract.js";

export { reposContract } from "./repos.contract.js";
export type { ConnectedRepo, GithubRepo } from "./repos.contract.js";
export { connectedRepoSchema, githubRepoSchema } from "./repos.contract.js";

export { auditContract } from "./audit.contract.js";
export type { AuditEventDto, AuditEventType } from "./audit.contract.js";
export {
  auditEventSchema,
  auditEventTypeSchema,
  auditEventTypes,
} from "./audit.contract.js";

export { analyticsContract } from "./analytics.contract.js";
export type {
  Contributor,
  FileFrequency,
  Granularity,
  HeatmapCell,
  QualityBucket,
  QualityTrendPoint,
  Summary,
  TimelinePoint,
} from "./analytics.contract.js";
export {
  contributorSchema,
  fileFrequencySchema,
  granularitySchema,
  heatmapCellSchema,
  qualityBucketSchema,
  qualityTrendPointSchema,
  summarySchema,
  timelinePointSchema,
} from "./analytics.contract.js";

export { policiesContract } from "./policies.contract.js";
export type {
  CreatePolicyInput,
  PolicyDto,
  PolicyRuleDto,
  PolicyRuleInput,
  PolicyRuleTypeName,
  RuleResultDto,
  UpdatePolicyInput,
  ValidatePolicyInput,
  ValidationResultDto,
} from "./policies.contract.js";
export {
  allowedScopesRuleSchema,
  allowedTypesRuleSchema,
  bodyRequiredRuleSchema,
  createPolicySchema,
  footerRequiredRuleSchema,
  maxSubjectLengthRuleSchema,
  policyDtoSchema,
  policyRuleDtoSchema,
  policyRuleSchema,
  policyRuleTypes,
  policyRuleTypeSchema,
  ruleResultSchema,
  updatePolicySchema,
  validatePolicyInputSchema,
  validationResultSchema,
} from "./policies.contract.js";

export { llmKeysContract } from "./llm-keys.contract.js";
export type {
  LlmApiKey,
  LlmApiKeyStatus,
  LlmProviderName,
  UpsertLlmKeyRequest,
} from "./llm-keys.contract.js";
export {
  llmApiKeySchema,
  llmApiKeyStatusSchema,
  llmApiKeyStatuses,
  llmProviderSchema,
  llmProviders,
  upsertLlmKeyRequestSchema,
} from "./llm-keys.contract.js";

export { errorEnvelopeSchema } from "./shared/error.js";
export type { ErrorEnvelope } from "./shared/error.js";

export type { RateLimitTier, RouteMetadata } from "./shared/metadata.js";

export {
  SYNC_EVENT_NAMES,
  SYNC_WS_NAMESPACE,
  syncCompletedPayloadSchema,
  syncFailedPayloadSchema,
  syncProgressPayloadSchema,
} from "./shared/sync-events.js";
export type {
  SyncCompletedPayload,
  SyncFailedPayload,
  SyncProgressPayload,
} from "./shared/sync-events.js";
