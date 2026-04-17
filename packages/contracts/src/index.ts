import { initContract } from "@ts-rest/core";

import { analyticsContract } from "./analytics.contract.js";
import { auditContract } from "./audit.contract.js";
import { authContract } from "./auth.contract.js";
import { reposContract } from "./repos.contract.js";

const c = initContract();

export const contracts = c.router({
  auth: authContract,
  audit: auditContract,
  analytics: analyticsContract,
  repos: reposContract,
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
  FileChurn,
  Granularity,
  HeatmapCell,
  QualityBucket,
  QualityTrendPoint,
  Summary,
  TimelinePoint,
} from "./analytics.contract.js";
export {
  contributorSchema,
  fileChurnSchema,
  granularitySchema,
  heatmapCellSchema,
  qualityBucketSchema,
  qualityTrendPointSchema,
  summarySchema,
  timelinePointSchema,
} from "./analytics.contract.js";

export { errorEnvelopeSchema } from "./shared/error.js";
export type { ErrorEnvelope } from "./shared/error.js";

export type { RateLimitTier, RouteMetadata } from "./shared/metadata.js";
