import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";

export class PolicyRepoNotFoundError extends NotFoundException {
  constructor() {
    super("repository not found");
  }
}

export class PolicyNotFoundError extends NotFoundException {
  constructor() {
    super("policy not found");
  }
}

export class PolicyActiveDeleteError extends BadRequestException {
  constructor() {
    super({
      message: "cannot delete an active policy; deactivate it first",
      code: "POLICY_ACTIVE_DELETE",
    });
  }
}

export class PolicyRuleInvalidError extends BadRequestException {
  constructor(detail: string) {
    super({
      message: `invalid policy rule: ${detail}`,
      code: "POLICY_RULE_INVALID",
    });
  }
}

export class PolicyUpdateEmptyError extends BadRequestException {
  constructor() {
    super({
      message: "at least one of name or rules must be provided",
      code: "POLICY_UPDATE_EMPTY",
    });
  }
}

export class PolicyActivationConflictError extends ConflictException {
  constructor() {
    super({
      message: "another policy was activated concurrently",
      code: "POLICY_ACTIVATION_CONFLICT",
    });
  }
}

const PG_UNIQUE_VIOLATION = "23505";

export const isUniqueViolation = (err: unknown): boolean => {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as {
    code?: unknown;
    driverError?: { code?: unknown };
  };
  if (candidate.code === PG_UNIQUE_VIOLATION) return true;
  return candidate.driverError?.code === PG_UNIQUE_VIOLATION;
};
