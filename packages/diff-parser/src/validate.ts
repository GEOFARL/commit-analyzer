export type DiffValidationIssueCode =
  | "empty"
  | "missing-header"
  | "bad-hunk-header"
  | "hunk-count-mismatch"
  | "bad-line-prefix";

export type DiffValidationIssue = {
  line: number;
  file: string | null;
  code: DiffValidationIssueCode;
  message: string;
};

export type DiffStats = {
  files: number;
  additions: number;
  deletions: number;
};

export type DiffValidationResult =
  | { valid: true; stats: DiffStats }
  | { valid: false; issues: DiffValidationIssue[]; stats: DiffStats };

const HUNK_HEADER_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function pathFromDiffHeader(line: string): string | null {
  const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
  return m ? m[2]! : null;
}

function pathFromPlusPlusPlus(line: string): string | null {
  if (line.startsWith("+++ /dev/null")) return null;
  if (line.startsWith("+++ b/")) return line.slice(6);
  if (line.startsWith("+++ ")) return line.slice(4);
  return null;
}

type State = "pre-file" | "in-file";

export function validateUnifiedDiff(raw: string): DiffValidationResult {
  const stats: DiffStats = { files: 0, additions: 0, deletions: 0 };

  if (!raw || raw.length === 0) {
    return {
      valid: false,
      issues: [
        {
          line: 1,
          file: null,
          code: "empty",
          message: "Input is empty.",
        },
      ],
      stats,
    };
  }

  const lines = raw.split("\n");
  const issues: DiffValidationIssue[] = [];
  let state: State = "pre-file";
  let currentPath: string | null = null;
  let sawGitHeader = false;
  let hunkOpen = false;
  let oldRemaining = 0;
  let newRemaining = 0;
  let hunkHeaderLine = 0;

  const closeHunkIfUnfinished = () => {
    if (hunkOpen && (oldRemaining > 0 || newRemaining > 0)) {
      issues.push({
        line: hunkHeaderLine,
        file: currentPath,
        code: "hunk-count-mismatch",
        message: `Hunk body shorter than declared range (missing ${oldRemaining} old, ${newRemaining} new).`,
      });
    }
    hunkOpen = false;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const lineNo = i + 1;

    if (line.startsWith("diff --git ")) {
      closeHunkIfUnfinished();
      const parsedPath = pathFromDiffHeader(line);
      if (parsedPath === null) {
        // Malformed `diff --git` header — don't count this as a file; a
        // following `--- a/x` + `+++ b/x` block (if present) will open the
        // file properly.
        sawGitHeader = false;
        continue;
      }
      currentPath = parsedPath;
      stats.files += 1;
      sawGitHeader = true;
      state = "in-file";
      continue;
    }

    if (line.startsWith("--- ")) {
      const next = lines[i + 1] ?? "";
      if (next.startsWith("+++ ")) {
        closeHunkIfUnfinished();
        if (!sawGitHeader) stats.files += 1;
        sawGitHeader = false;
        currentPath = pathFromPlusPlusPlus(next) ?? currentPath;
        state = "in-file";
        i += 1;
        continue;
      }
    }

    if (line.startsWith("@@")) {
      const m = HUNK_HEADER_RE.exec(line);
      if (!m) {
        issues.push({
          line: lineNo,
          file: currentPath,
          code: "bad-hunk-header",
          message: "Hunk header malformed. Expected `@@ -a,b +c,d @@`.",
        });
        return { valid: false, issues, stats };
      }
      if (state === "pre-file") {
        issues.push({
          line: lineNo,
          file: null,
          code: "missing-header",
          message: "Hunk appears before any file header.",
        });
        return { valid: false, issues, stats };
      }
      closeHunkIfUnfinished();
      hunkOpen = true;
      oldRemaining = m[2] !== undefined ? Number(m[2]) : 1;
      newRemaining = m[4] !== undefined ? Number(m[4]) : 1;
      hunkHeaderLine = lineNo;
      continue;
    }

    if (hunkOpen) {
      const prefix = line.length > 0 ? line[0]! : " ";
      const isBody =
        line.length === 0 || " +-\\".includes(line[0]!);
      const stillExpecting = oldRemaining > 0 || newRemaining > 0;

      if (!isBody) {
        if (stillExpecting) {
          issues.push({
            line: lineNo,
            file: currentPath,
            code: "bad-line-prefix",
            message: `Unexpected line prefix '${line[0]}' inside a hunk.`,
          });
          return { valid: false, issues, stats };
        }
        hunkOpen = false;
        continue;
      }

      if (!stillExpecting) {
        issues.push({
          line: lineNo,
          file: currentPath,
          code: "hunk-count-mismatch",
          message: "Hunk body longer than declared range.",
        });
        return { valid: false, issues, stats };
      }

      if (prefix === " " || line.length === 0) {
        if (oldRemaining === 0 || newRemaining === 0) {
          issues.push({
            line: lineNo,
            file: currentPath,
            code: "hunk-count-mismatch",
            message:
              "Context line but one side of the hunk range is already satisfied.",
          });
          return { valid: false, issues, stats };
        }
        oldRemaining -= 1;
        newRemaining -= 1;
      } else if (prefix === "+") {
        if (newRemaining === 0) {
          issues.push({
            line: lineNo,
            file: currentPath,
            code: "hunk-count-mismatch",
            message: "More additions than declared in hunk header.",
          });
          return { valid: false, issues, stats };
        }
        stats.additions += 1;
        newRemaining -= 1;
      } else if (prefix === "-") {
        if (oldRemaining === 0) {
          issues.push({
            line: lineNo,
            file: currentPath,
            code: "hunk-count-mismatch",
            message: "More deletions than declared in hunk header.",
          });
          return { valid: false, issues, stats };
        }
        stats.deletions += 1;
        oldRemaining -= 1;
      }
      continue;
    }
  }

  closeHunkIfUnfinished();

  if (stats.files === 0 && issues.length === 0) {
    issues.push({
      line: 1,
      file: null,
      code: "missing-header",
      message: "No file header found. Expected `diff --git` or `--- / +++`.",
    });
  }

  if (issues.length > 0) {
    return { valid: false, issues, stats };
  }
  return { valid: true, stats };
}
