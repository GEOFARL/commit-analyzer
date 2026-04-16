export const name = "@commit-analyzer/api";

export { parseConventionalCommit } from "./shared/cc-parser.js";
export type { ParsedCC } from "./shared/cc-parser.js";

export { getServerEnv } from "./common/config.js";
export { createLogger, REDACT_PATHS } from "./common/logger.js";
export {
  generateRequestId,
  REQUEST_ID_HEADER,
  REQUEST_ID_KEY,
} from "./common/cls.js";
