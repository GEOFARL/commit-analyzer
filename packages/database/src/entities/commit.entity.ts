import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from "typeorm";

import { CommitQualityScore } from "./commit-quality-score.entity.js";
import { Repository } from "./repository.entity.js";

@Entity({ name: "commits" })
@Index("commits_repo_authored_idx", ["repoId", "authoredAt"])
@Index("commits_repo_author_email_idx", ["repoId", "authorEmail"])
export class Commit {
  @PrimaryColumn("text")
  sha!: string;

  @Column("uuid")
  repoId!: string;

  @ManyToOne(() => Repository, { onDelete: "CASCADE" })
  @JoinColumn({ name: "repo_id" })
  repository!: Repository;

  @Column("text")
  authorEmail!: string;

  @Column("text")
  authorName!: string;

  @Column("timestamptz")
  authoredAt!: Date;

  @Column("text")
  message!: string;

  @Column("int", { default: 0 })
  additions!: number;

  @Column("int", { default: 0 })
  deletions!: number;

  @Column("int", { default: 0 })
  filesChanged!: number;

  @Column("smallint", { default: 1 })
  parentCount!: number;

  @OneToOne(() => CommitQualityScore, (score) => score.commit)
  qualityScore!: CommitQualityScore | null;
}
