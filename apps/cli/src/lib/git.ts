import { spawn } from "node:child_process";

export class GitError extends Error {
  readonly code: GitErrorCode;
  readonly stderr: string;

  constructor(code: GitErrorCode, message: string, stderr = "") {
    super(message);
    this.name = "GitError";
    this.code = code;
    this.stderr = stderr;
  }
}

type GitErrorCode = "NOT_A_REPO" | "GIT_MISSING" | "GIT_FAILED";

interface RunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runGit(args: string[], cwd: string = process.cwd()): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ENOENT") {
        reject(new GitError("GIT_MISSING", "git executable not found in PATH"));
      } else {
        reject(err);
      }
    });
    child.on("close", (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

export async function assertInsideWorkTree(cwd: string = process.cwd()): Promise<void> {
  const res = await runGit(["rev-parse", "--is-inside-work-tree"], cwd);
  if (res.exitCode !== 0 || res.stdout.trim() !== "true") {
    throw new GitError("NOT_A_REPO", "not inside a git work tree", res.stderr.trim());
  }
}

export async function readStagedDiff(cwd: string = process.cwd()): Promise<string> {
  const res = await runGit(
    ["diff", "--staged", "--no-color", "--no-ext-diff"],
    cwd,
  );
  if (res.exitCode !== 0) {
    throw new GitError("GIT_FAILED", "git diff --staged failed", res.stderr.trim());
  }
  return res.stdout;
}

export async function readHeadDiff(cwd: string = process.cwd()): Promise<string> {
  const head = await runGit(["rev-parse", "--verify", "--quiet", "HEAD"], cwd);
  if (head.exitCode !== 0) return "";
  const res = await runGit(
    ["diff", "HEAD", "--no-color", "--no-ext-diff"],
    cwd,
  );
  if (res.exitCode !== 0) {
    throw new GitError("GIT_FAILED", "git diff HEAD failed", res.stderr.trim());
  }
  return res.stdout;
}

interface ResolvedDiff {
  diff: string;
  source: "staged" | "head";
}

export async function readDiffWithFallback(cwd: string = process.cwd()): Promise<ResolvedDiff | null> {
  const staged = await readStagedDiff(cwd);
  if (staged.trim().length > 0) return { diff: staged, source: "staged" };
  const head = await readHeadDiff(cwd);
  if (head.trim().length > 0) return { diff: head, source: "head" };
  return null;
}
