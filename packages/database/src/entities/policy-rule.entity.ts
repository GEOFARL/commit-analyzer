import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Policy } from "./policy.entity.js";

export type PolicyRuleType =
  | "allowedTypes"
  | "allowedScopes"
  | "maxSubjectLength"
  | "bodyRequired"
  | "footerRequired";

@Entity({ name: "policy_rules" })
export class PolicyRule {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  policyId!: string;

  @ManyToOne(() => Policy, (policy) => policy.rules, { onDelete: "CASCADE" })
  @JoinColumn({ name: "policy_id" })
  policy!: Policy;

  @Column("text")
  ruleType!: PolicyRuleType;

  @Column("jsonb")
  ruleValue!: unknown;
}
