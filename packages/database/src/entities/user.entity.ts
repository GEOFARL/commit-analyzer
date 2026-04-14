import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
} from "typeorm";

import { ApiKey } from "./api-key.entity.js";
import { LLMApiKey } from "./llm-api-key.entity.js";
import { Repository } from "./repository.entity.js";

@Entity({ name: "users" })
export class User {
  @PrimaryColumn("uuid")
  id!: string;

  @Column("text", { unique: true, nullable: true })
  githubId!: string | null;

  @Column("text", { nullable: true })
  email!: string | null;

  @Column("text", { nullable: true })
  username!: string | null;

  @Column("text", { nullable: true })
  avatarUrl!: string | null;

  @Column("bytea", { nullable: true })
  accessTokenEnc!: Buffer | null;

  @Column("bytea", { nullable: true })
  accessTokenIv!: Buffer | null;

  @Column("bytea", { nullable: true })
  accessTokenTag!: Buffer | null;

  @Column("jsonb", { nullable: true })
  defaultPolicyTemplate!: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @OneToMany(() => Repository, (repo) => repo.user)
  repositories!: Repository[];

  @OneToMany(() => ApiKey, (key) => key.user)
  apiKeys!: ApiKey[];

  @OneToMany(() => LLMApiKey, (key) => key.user)
  llmApiKeys!: LLMApiKey[];
}
