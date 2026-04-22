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

@Entity({ name: "generation_history" })
@Index("generation_history_user_created_idx", ["userId", "createdAt"])
export class GenerationHistory {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column("uuid", { nullable: true })
  repositoryId!: string | null;

  @ManyToOne(() => Repository, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "repository_id" })
  repository!: Repository | null;

  @Column("text")
  diffHash!: string;

  @Column("text")
  provider!: string;

  @Column("text")
  model!: string;

  @Column("int")
  promptTokens!: number;

  @Column("int")
  completionTokens!: number;

  @Column("jsonb")
  suggestions!: unknown;

  @Column("uuid", { nullable: true })
  policyId!: string | null;

  @ManyToOne(() => Policy, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "policy_id" })
  policy!: Policy | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
