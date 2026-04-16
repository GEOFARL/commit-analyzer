import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  Unique,
} from "typeorm";

import { CommitQualityScore } from "./commit-quality-score.entity.js";
import { Repository } from "./repository.entity.js";

@Entity({ name: "commits" })
@Unique("commits_repo_sha_uk", ["repositoryId", "sha"])
@Index("commits_repo_authored_idx", ["repositoryId", "authoredAt"])
export class Commit {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  repositoryId!: string;

  @ManyToOne(() => Repository, { onDelete: "CASCADE" })
  @JoinColumn({ name: "repository_id" })
  repository!: Repository;

  @Column("text")
  sha!: string;

  @Column("text")
  authorName!: string;

  @Index("commits_author_email_idx")
  @Column("text")
  authorEmail!: string;

  @Column("text")
  message!: string;

  @Column("text", { nullable: true })
  subject!: string | null;

  @Column("text", { nullable: true })
  body!: string | null;

  @Column("text", { nullable: true })
  footer!: string | null;

  @Column("int", { default: 0 })
  insertions!: number;

  @Column("int", { default: 0 })
  deletions!: number;

  @Column("int", { default: 0 })
  filesChanged!: number;

  @Column("timestamptz")
  authoredAt!: Date;

  @OneToOne(() => CommitQualityScore, (score) => score.commit)
  qualityScore?: CommitQualityScore;
}
