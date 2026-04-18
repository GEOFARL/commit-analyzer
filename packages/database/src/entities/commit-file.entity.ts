import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Commit } from "./commit.entity.js";

export type CommitFileStatus = "added" | "modified" | "removed" | "renamed";

@Entity({ name: "commit_files" })
@Index("commit_files_commit_idx", ["commitId"])
@Index("commit_files_file_path_idx", ["filePath"])
export class CommitFile {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column("uuid")
  commitId!: string;

  @ManyToOne(() => Commit, { onDelete: "CASCADE" })
  @JoinColumn({ name: "commit_id" })
  commit!: Commit;

  @Column("text")
  filePath!: string;

  @Column("int", { default: 0 })
  additions!: number;

  @Column("int", { default: 0 })
  deletions!: number;

  @Column("text")
  status!: CommitFileStatus;
}
