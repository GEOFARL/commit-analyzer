import type { UserRepository } from "@commit-analyzer/database";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { ZodError } from "zod";

import { USER_REPOSITORY } from "../../common/database/tokens.js";

import { PolicyRuleInvalidError } from "./policy.errors.js";
import {
  defaultPolicyTemplateSchema,
  type DefaultPolicyTemplate,
} from "./policy.schemas.js";

@Injectable()
export class DefaultPolicyService {
  private readonly logger = new Logger(DefaultPolicyService.name);

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async getDefaultPolicyTemplate(
    userId: string,
  ): Promise<DefaultPolicyTemplate | null> {
    const raw = await this.users.getDefaultPolicyTemplate(userId);
    if (!raw) return null;
    const result = defaultPolicyTemplateSchema.safeParse(raw);
    if (!result.success) {
      this.logger.warn(
        `stored default policy template failed validation userId=${userId}: ${result.error.issues[0]?.message ?? "invalid"}`,
      );
      return null;
    }
    return result.data;
  }

  async setDefaultPolicyTemplate(
    userId: string,
    input: unknown,
  ): Promise<DefaultPolicyTemplate> {
    const parsed = this.parse(input);
    await this.users.setDefaultPolicyTemplate(userId, parsed);
    return parsed;
  }

  private parse(input: unknown): DefaultPolicyTemplate {
    try {
      return defaultPolicyTemplateSchema.parse(input);
    } catch (err) {
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const path = first?.path.join(".") ?? "input";
        const message = first?.message ?? "invalid input";
        throw new PolicyRuleInvalidError(`${path}: ${message}`);
      }
      throw new PolicyRuleInvalidError("invalid input");
    }
  }
}
