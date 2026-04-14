import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { User } from "./user.entity.js";

@Entity({ name: "api_keys" })
export class ApiKey {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("api_keys_user_id_idx")
  @Column("uuid")
  userId!: string;

  @ManyToOne(() => User, (user) => user.apiKeys, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column("text")
  name!: string;

  @Column("text", { unique: true })
  keyPrefix!: string;

  @Column("text")
  keyHash!: string;

  @Column("timestamptz", { nullable: true })
  lastUsedAt!: Date | null;

  @Column("timestamptz", { nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
