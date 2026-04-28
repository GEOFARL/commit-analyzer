import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  GitError,
  assertInsideWorkTree,
  commitMessage,
  readDiffWithFallback,
  readHeadDiff,
  readStagedDiff,
} from "./git.js";

function init(dir: string): void {
  execSync("git init -q -b main", { cwd: dir });
  execSync("git config user.email test@example.com", { cwd: dir });
  execSync("git config user.name test", { cwd: dir });
  execSync("git config commit.gpgsign false", { cwd: dir });
}

describe("git helpers", () => {
  let dir: string;
  let prevCwd: string;

  beforeEach(() => {
    prevCwd = process.cwd();
    dir = mkdtempSync(join(tmpdir(), "cli-git-"));
  });

  afterEach(() => {
    process.chdir(prevCwd);
  });

  it("rejects when not inside a work tree", async () => {
    process.chdir(dir);
    await expect(assertInsideWorkTree()).rejects.toBeInstanceOf(GitError);
  });

  it("returns staged diff when staged", async () => {
    init(dir);
    process.chdir(dir);
    writeFileSync(join(dir, "a.txt"), "hello\n");
    execSync("git add a.txt", { cwd: dir });

    await assertInsideWorkTree();
    const staged = await readStagedDiff();
    expect(staged).toContain("diff --git a/a.txt b/a.txt");

    const resolved = await readDiffWithFallback();
    expect(resolved?.source).toBe("staged");
    expect(resolved?.diff).toContain("a.txt");
  });

  it("falls back to HEAD when nothing staged but there are unstaged changes", async () => {
    init(dir);
    process.chdir(dir);
    writeFileSync(join(dir, "a.txt"), "hello\n");
    execSync("git add a.txt && git commit -q -m init", { cwd: dir });
    writeFileSync(join(dir, "a.txt"), "hello world\n");

    const staged = await readStagedDiff();
    expect(staged.trim()).toBe("");

    const head = await readHeadDiff();
    expect(head).toContain("a.txt");

    const resolved = await readDiffWithFallback();
    expect(resolved?.source).toBe("head");
  });

  it("returns null when nothing staged and no unstaged diff", async () => {
    init(dir);
    process.chdir(dir);
    writeFileSync(join(dir, "a.txt"), "hello\n");
    execSync("git add a.txt && git commit -q -m init", { cwd: dir });

    const resolved = await readDiffWithFallback();
    expect(resolved).toBeNull();
  });

  it("returns null in a fresh repo with no commits and nothing staged", async () => {
    init(dir);
    process.chdir(dir);

    const head = await readHeadDiff();
    expect(head).toBe("");

    const resolved = await readDiffWithFallback();
    expect(resolved).toBeNull();
  });

  it("commitMessage records subject + body verbatim", async () => {
    init(dir);
    process.chdir(dir);
    writeFileSync(join(dir, "a.txt"), "hi\n");
    execSync("git add a.txt", { cwd: dir });

    await commitMessage({ subject: "feat: add a", body: "explains why\n\nRefs: #1" });

    const log = execSync("git log -1 --pretty=%B", { cwd: dir }).toString();
    expect(log).toContain("feat: add a");
    expect(log).toContain("explains why");
    expect(log).toContain("Refs: #1");
  });

  it("commitMessage is shell-injection safe — backticks and $() are stored literally", async () => {
    init(dir);
    process.chdir(dir);
    writeFileSync(join(dir, "a.txt"), "hi\n");
    execSync("git add a.txt", { cwd: dir });

    const subject = "fix: handle `rm -rf /` and $(whoami)";
    const body = "see `cat /etc/passwd` and $(echo pwned)";
    await commitMessage({ subject, body });

    const log = execSync("git log -1 --pretty=%B", { cwd: dir }).toString();
    expect(log).toContain("`rm -rf /`");
    expect(log).toContain("$(whoami)");
    expect(log).toContain("`cat /etc/passwd`");
    expect(log).toContain("$(echo pwned)");
  });

  it("commitMessage throws GitError when commit fails", async () => {
    init(dir);
    process.chdir(dir);

    await expect(commitMessage({ subject: "noop" })).rejects.toBeInstanceOf(GitError);
  });
});
