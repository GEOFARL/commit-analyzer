import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

import { User } from "./user.entity.js";

export type LLMProvider = "openai" | "anthropic";
export type LLMApiKeyStatus = "ok" | "invalid" | "unknown";

@Entity({ name: "llm_api_keys" })
@Unique("llm_api_keys_user_provider_uk", ["userId", "provider"])
export class LLMApiKey {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("llm_api_keys_user_id_idx")
  @Column("uuid")
  userId!: string;

  @ManyToOne(() => User, (user) => user.llmApiKeys, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column("text")
  provider!: LLMProvider;

  @Column("bytea")
  keyEnc!: Buffer;

  @Column("bytea")
  keyIv!: Buffer;

  @Column("bytea")
  keyTag!: Buffer;

  @Column("text", { default: "unknown" })
  status!: LLMApiKeyStatus;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
