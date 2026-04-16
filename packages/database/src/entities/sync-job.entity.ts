import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Repository } from "./repository.entity.js";

export type SyncJobStatus = "queued" | "running" | "completed" | "failed";

@Entity({ name: "sync_jobs" })
@Index("sync_jobs_repo_status_idx", ["repositoryId", "status"])
export class SyncJob {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  repositoryId!: string;

  @ManyToOne(() => Repository, { onDelete: "CASCADE" })
  @JoinColumn({ name: "repository_id" })
  repository!: Repository;

  @Column("text")
  status!: SyncJobStatus;

  @Column("int", { nullable: true })
  commitsProcessed!: number | null;

  @Column("int", { nullable: true })
  totalCommits!: number | null;

  @Column("text", { nullable: true })
  errorMessage!: string | null;

  @Column("timestamptz", { nullable: true })
  startedAt!: Date | null;

  @Column("timestamptz", { nullable: true })
  finishedAt!: Date | null;
}
