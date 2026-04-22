import type {
  GenerationStatus,
  LlmProvider,
  SuggestionRecord,
} from "@commit-analyzer/shared-types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Policy } from "./policy.entity.js";
import { Repository } from "./repository.entity.js";
import { User } from "./user.entity.js";

// DESC ordering lives in the migration (index decorator can't express it);
// the composite (user_id, created_at DESC) index powers history pagination.
@Entity({ name: "generation_history" })
@Index("generation_history_user_created_idx", ["userId", "createdAt"])
export class GenerationHistory {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid", { nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "user_id" })
  user!: User | null;

  @Column("uuid", { nullable: true })
  repositoryId!: string | null;

  @ManyToOne(() => Repository, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "repository_id" })
  repository!: Repository | null;

  @Column("text")
  diffHash!: string;

  @Column("text")
  provider!: LlmProvider;

  @Column("text")
  model!: string;

  @Column("int")
  tokensUsed!: number;

  @Column("text", { default: "pending" })
  status!: GenerationStatus;

  @Column("jsonb")
  suggestions!: SuggestionRecord[];

  @Column("uuid", { nullable: true })
  policyId!: string | null;

  @ManyToOne(() => Policy, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "policy_id" })
  policy!: Policy | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
