import type {
  CommitFileStatus,
  UpsertCommitFileInput,
} from "@commit-analyzer/database";

export interface CommitFileStats {
  additions: number;
  deletions: number;
  files: UpsertCommitFileInput[];
}

/**
 * GitHub's per-file `status` enum is wider than ours (adds `copied`,
 * `changed`, `unchanged`). Collapse those to the four we persist.
 */
export function mapGithubFileStatus(status: string | undefined): CommitFileStatus {
  switch (status) {
    case "added":
    case "removed":
    case "renamed":
      return status;
    case "copied":
      return "added";
    default:
      return "modified";
  }
}
