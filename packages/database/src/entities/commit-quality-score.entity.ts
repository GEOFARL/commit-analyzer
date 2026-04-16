import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";

import { Commit } from "./commit.entity.js";

@Entity({ name: "commit_quality_scores" })
export class CommitQualityScore {
  @PrimaryColumn("text")
  commitSha!: string;

  @OneToOne(() => Commit, (commit) => commit.qualityScore, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "commit_sha" })
  commit!: Commit;

  @Column("bool", { default: false })
  ccValid!: boolean;

  @Column("smallint")
  score!: number;

  @Column("jsonb", { default: {} })
  breakdown!: Record<string, unknown>;

  @Column("timestamptz")
  scoredAt!: Date;
}
