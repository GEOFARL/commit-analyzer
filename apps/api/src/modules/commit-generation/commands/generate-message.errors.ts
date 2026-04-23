import { ForbiddenException } from "@nestjs/common";

export class PolicyAccessDeniedError extends ForbiddenException {
  constructor() {
    super({
      message: "policy not accessible",
      code: "POLICY_ACCESS_DENIED",
    });
  }
}
