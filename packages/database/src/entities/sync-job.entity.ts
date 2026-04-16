import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Repository } from "./repository.entity.js";

export type SyncJobStatus = "pending" | "running" | "done" | "failed";

@Entity({ name: "sync_jobs" })
export class SyncJob {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  repoId!: string;

  @ManyToOne(() => Repository, { onDelete: "CASCADE" })
  @JoinColumn({ name: "repo_id" })
  repository!: Repository;

  @Column("text")
  status!: SyncJobStatus;

  @Column("timestamptz", { nullable: true })
  startedAt!: Date | null;

  @Column("timestamptz", { nullable: true })
  finishedAt!: Date | null;

  @Column("smallint", { nullable: true })
  progressPct!: number | null;

  @Column("text", { nullable: true })
  error!: string | null;
}
