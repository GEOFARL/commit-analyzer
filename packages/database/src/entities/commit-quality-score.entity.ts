import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Commit } from "./commit.entity.js";

@Entity({ name: "commit_quality_scores" })
export class CommitQualityScore {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid", { unique: true })
  commitId!: string;

  @OneToOne(() => Commit, (commit) => commit.qualityScore, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "commit_id" })
  commit!: Commit;

  @Column("bool", { default: false })
  isConventional!: boolean;

  @Column("text", { nullable: true })
  ccType!: string | null;

  @Column("text", { nullable: true })
  ccScope!: string | null;

  @Column("int", { nullable: true })
  subjectLength!: number | null;

  @Column("bool", { default: false })
  hasBody!: boolean;

  @Column("bool", { default: false })
  hasFooter!: boolean;

  @Index("commit_quality_scores_overall_score_idx")
  @Column("int")
  overallScore!: number;

  @Column("jsonb", { default: {} })
  details!: Record<string, unknown>;
}
