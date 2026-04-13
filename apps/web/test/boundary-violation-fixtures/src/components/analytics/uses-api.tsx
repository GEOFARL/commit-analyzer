// Intentional boundary violation: web code may not import from apps/api.
import { createLogger } from "@commit-analyzer/api";

export const Panel = (): unknown => createLogger;
