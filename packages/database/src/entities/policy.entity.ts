import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { PolicyRule } from "./policy-rule.entity.js";
import { Repository } from "./repository.entity.js";

@Entity({ name: "policies" })
export class Policy {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  repositoryId!: string;

  @ManyToOne(() => Repository, { onDelete: "CASCADE" })
  @JoinColumn({ name: "repository_id" })
  repository!: Repository;

  @Column("text")
  name!: string;

  @Column("bool", { default: false })
  isActive!: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;

  @OneToMany(() => PolicyRule, (rule) => rule.policy)
  rules!: PolicyRule[];
}
