import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  GitError,
  assertInsideWorkTree,
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
});
