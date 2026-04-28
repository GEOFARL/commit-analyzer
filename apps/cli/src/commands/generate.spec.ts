import { select } from "@inquirer/prompts";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { ClipboardError, copyToClipboard } from "../lib/clipboard.js";
import { ConfigError, loadConfig } from "../lib/config.js";
import {
  GitError,
  assertInsideWorkTree,
  commitMessage,
  readDiffWithFallback,
} from "../lib/git.js";

import { handleError, runGenerate } from "./generate.js";

vi.mock("../lib/config.js", () => ({
  ConfigError: class ConfigError extends Error {
    readonly code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
  loadConfig: vi.fn(),
}));

vi.mock("../lib/git.js", () => ({
  GitError: class GitError extends Error {
    readonly code: string;
    readonly stderr: string;
    constructor(code: string, message: string, stderr = "") {
      super(message);
      this.code = code;
      this.stderr = stderr;
    }
  },
  assertInsideWorkTree: vi.fn(),
  readDiffWithFallback: vi.fn(),
  commitMessage: vi.fn(),
}));

vi.mock("../lib/clipboard.js", () => ({
  ClipboardError: class ClipboardError extends Error {
    constructor(message: string, cause: unknown) {
      super(message, { cause });
    }
  },
  copyToClipboard: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
}));

const loadConfigMock = loadConfig as unknown as Mock;
const assertInsideWorkTreeMock = assertInsideWorkTree as unknown as Mock;
const readDiffWithFallbackMock = readDiffWithFallback as unknown as Mock;
const commitMessageMock = commitMessage as unknown as Mock;
const copyToClipboardMock = copyToClipboard as unknown as Mock;
const selectMock = select as unknown as Mock;

const VALID_DIFF = [
  "diff --git a/a.ts b/a.ts",
  "index 1..2 100644",
  "--- a/a.ts",
  "+++ b/a.ts",
  "@@ -1 +1 @@",
  "-a",
  "+b",
  "",
].join("\n");

const CFG = {
  apiUrl: "http://localhost:3000",
  apiKey: "git_test",
  defaultProvider: "openai" as const,
  defaultModel: "gpt-4o-mini",
};

const SUGGESTION = {
  index: 0,
  type: "feat",
  scope: null,
  subject: "add a",
  body: null,
  footer: null,
  compliant: true,
  validation: null,
};

const DONE = { historyId: null, tokensUsed: 42 };

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseResponse(events: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const e of events) controller.enqueue(encoder.encode(e));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

class ExitCalled extends Error {
  constructor(readonly exitCode: number) {
    super(`process.exit(${exitCode})`);
  }
}

let stderrBuf = "";
let stdoutBuf = "";

beforeEach(() => {
  vi.resetAllMocks();
  stderrBuf = "";
  stdoutBuf = "";
  vi.spyOn(process.stderr, "write").mockImplementation((c) => {
    stderrBuf += typeof c === "string" ? c : c.toString();
    return true;
  });
  vi.spyOn(process.stdout, "write").mockImplementation((c) => {
    stdoutBuf += typeof c === "string" ? c : c.toString();
    return true;
  });
  vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new ExitCalled(code ?? 0);
  }) as never);
  loadConfigMock.mockResolvedValue(CFG);
  assertInsideWorkTreeMock.mockResolvedValue(undefined);
  readDiffWithFallbackMock.mockResolvedValue({ diff: VALID_DIFF, source: "staged" });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function runAndCatchExit(opts: Parameters<typeof runGenerate>[0]): Promise<number> {
  try {
    await runGenerate(opts, new AbortController().signal);
  } catch (err) {
    if (err instanceof ExitCalled) return err.exitCode;
    try {
      handleError(err);
    } catch (e) {
      if (e instanceof ExitCalled) return e.exitCode;
      throw e;
    }
  }
  throw new Error("expected process.exit to be called");
}

describe("generate command", () => {
  it("prints chosen message on happy path", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(SUGGESTION);

    await runGenerate({}, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(stdoutBuf).toContain("feat: add a");
  });

  it("exit 2 when no diff", async () => {
    readDiffWithFallbackMock.mockResolvedValue(null);

    expect(await runAndCatchExit({})).toBe(2);
    expect(stderrBuf).toMatch(/nothing to commit/);
  });

  it("exit 2 when not in a git work tree", async () => {
    assertInsideWorkTreeMock.mockRejectedValue(new GitError("NOT_A_REPO", "x"));

    expect(await runAndCatchExit({})).toBe(2);
    expect(stderrBuf).toMatch(/not inside a git work tree/);
  });

  it("exit 3 on auth failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "UNAUTHORIZED", message: "bad key" } }),
        { status: 401, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await runAndCatchExit({})).toBe(3);
    expect(stderrBuf).toMatch(/api key rejected/);
  });

  it("exit 3 on missing config", async () => {
    loadConfigMock.mockRejectedValue(new ConfigError("MISSING", "no config"));

    expect(await runAndCatchExit({})).toBe(3);
    expect(stderrBuf).toMatch(/no config/);
  });

  it("retries once on network failure, then exits 4", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("connection refused"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await runAndCatchExit({})).toBe(4);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("succeeds on retry when first network attempt fails", async () => {
    let attempt = 0;
    const fetchMock = vi.fn().mockImplementation(() => {
      attempt += 1;
      if (attempt === 1) return Promise.reject(new TypeError("connection refused"));
      return Promise.resolve(
        sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(SUGGESTION);

    await runGenerate({}, new AbortController().signal);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(stdoutBuf).toContain("feat: add a");
  });

  it("exit 5 on stream error frame", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("error", { code: "LLM_ERROR", message: "boom" })]),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await runAndCatchExit({})).toBe(5);
    expect(stderrBuf).toMatch(/stream failed/);
  });

  it("exit 1 on invalid provider", async () => {
    expect(await runAndCatchExit({ provider: "bogus" })).toBe(1);
    expect(stderrBuf).toMatch(/invalid provider/);
  });

  it("exit 1 on invalid --repo uuid", async () => {
    expect(await runAndCatchExit({ repo: "not-a-uuid" })).toBe(1);
    expect(stderrBuf).toMatch(/--repo must be a uuid/);
  });

  it("exit 130 when user picks quit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(null);

    expect(await runAndCatchExit({})).toBe(130);
    expect(stderrBuf).toMatch(/aborted/);
  });

  it("--copy writes the chosen message to the clipboard", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(SUGGESTION);
    copyToClipboardMock.mockResolvedValue(undefined);

    await runGenerate({ copy: true }, new AbortController().signal);

    expect(copyToClipboardMock).toHaveBeenCalledWith("feat: add a");
    expect(stderrBuf).toMatch(/copied to clipboard/);
  });

  it("--copy exit 1 on clipboard failure", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(SUGGESTION);
    copyToClipboardMock.mockRejectedValue(
      new ClipboardError("failed to write to clipboard", new Error("xclip missing")),
    );

    expect(await runAndCatchExit({ copy: true })).toBe(1);
    expect(stderrBuf).toMatch(/failed to write to clipboard/);
  });

  it("--commit invokes commitMessage with subject and body", async () => {
    const RICH = {
      ...SUGGESTION,
      body: "explain the change",
      footer: "Refs: #123",
    };
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", RICH), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(RICH);
    commitMessageMock.mockResolvedValue(undefined);

    await runGenerate({ commit: true }, new AbortController().signal);

    expect(commitMessageMock).toHaveBeenCalledWith({
      subject: "feat: add a",
      body: "explain the change\n\nRefs: #123",
    });
    expect(stderrBuf).toMatch(/commit created/);
  });

  it("--commit subject only when body and footer are absent", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(SUGGESTION);
    commitMessageMock.mockResolvedValue(undefined);

    await runGenerate({ commit: true }, new AbortController().signal);

    expect(commitMessageMock).toHaveBeenCalledWith({ subject: "feat: add a" });
  });

  it("--commit + --copy run both", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(SUGGESTION);
    copyToClipboardMock.mockResolvedValue(undefined);
    commitMessageMock.mockResolvedValue(undefined);

    await runGenerate({ commit: true, copy: true }, new AbortController().signal);

    expect(copyToClipboardMock).toHaveBeenCalledTimes(1);
    expect(commitMessageMock).toHaveBeenCalledTimes(1);
  });

  it("--commit exit 1 when git commit fails (e.g. pre-commit hook)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(SUGGESTION);
    commitMessageMock.mockRejectedValue(
      new GitError("GIT_FAILED", "git commit failed", "pre-commit hook rejected"),
    );

    expect(await runAndCatchExit({ commit: true })).toBe(1);
    expect(stderrBuf).toMatch(/commit failed/);
    expect(stderrBuf).toMatch(/pre-commit hook rejected/);
  });

  it("does not commit or copy when user picks quit", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(null);

    expect(await runAndCatchExit({ commit: true, copy: true })).toBe(130);
    expect(commitMessageMock).not.toHaveBeenCalled();
    expect(copyToClipboardMock).not.toHaveBeenCalled();
  });

  it("emits HEAD-fallback note when nothing staged but HEAD diff exists", async () => {
    readDiffWithFallbackMock.mockResolvedValue({ diff: VALID_DIFF, source: "head" });
    const fetchMock = vi.fn().mockResolvedValue(
      sseResponse([sseFrame("suggestion", SUGGESTION), sseFrame("done", DONE)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    selectMock.mockResolvedValue(SUGGESTION);

    await runGenerate({}, new AbortController().signal);
    expect(stderrBuf).toMatch(/git diff HEAD/);
  });
});
