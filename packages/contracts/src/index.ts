import { initContract } from "@ts-rest/core";

import { auditContract } from "./audit.contract.js";
import { authContract } from "./auth.contract.js";
import { reposContract } from "./repos.contract.js";

const c = initContract();

export const contracts = c.router({
  auth: authContract,
  audit: auditContract,
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

export { errorEnvelopeSchema } from "./shared/error.js";
export type { ErrorEnvelope } from "./shared/error.js";

export type { RateLimitTier, RouteMetadata } from "./shared/metadata.js";
