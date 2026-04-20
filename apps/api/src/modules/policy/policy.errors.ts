import { BadRequestException, NotFoundException } from "@nestjs/common";

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
