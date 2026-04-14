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

@Entity({ name: "repositories" })
@Unique("repositories_user_github_repo_uk", ["userId", "githubRepoId"])
export class Repository {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Index("repositories_user_id_idx")
  @Column("uuid")
  userId!: string;

  @ManyToOne(() => User, (user) => user.repositories, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: User;

  @Column("bigint")
  githubRepoId!: string;

  @Column("text")
  fullName!: string;

  @Column("text", { nullable: true })
  description!: string | null;

  @Column("text", { nullable: true })
  defaultBranch!: string | null;

  @Column("text", { nullable: true })
  language!: string | null;

  @Column("int", { default: 0 })
  stars!: number;

  @Column("bool", { default: false })
  isConnected!: boolean;

  @Column("timestamptz", { nullable: true })
  lastSyncedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;
}
