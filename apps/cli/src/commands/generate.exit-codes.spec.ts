import { createServer, type Server } from "node:http";
import { type AddressInfo } from "node:net";

import { select } from "@inquirer/prompts";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { ConfigError, loadConfig } from "../lib/config.js";
import { GitError, assertInsideWorkTree, readDiffWithFallback } from "../lib/git.js";

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

vi.mock("@inquirer/prompts", () => ({ select: vi.fn() }));

const loadConfigMock = loadConfig as unknown as Mock;
const assertInsideWorkTreeMock = assertInsideWorkTree as unknown as Mock;
const readDiffWithFallbackMock = readDiffWithFallback as unknown as Mock;
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

class ExitCalled extends Error {
  constructor(readonly exitCode: number) {
    super(`process.exit(${exitCode})`);
  }
}

type StubResponder = (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void;
let stubServer: Server;
let stubUrl: string;
let stubResponder: StubResponder;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sendSse(res: import("node:http").ServerResponse, frames: string[]): void {
  res.writeHead(200, { "content-type": "text/event-stream" });
  for (const f of frames) res.write(f);
  res.end();
}

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

let stderrBuf = "";
let stdoutBuf = "";

beforeAll(async () => {
  stubServer = createServer((req, res) => stubResponder(req, res));
  await new Promise<void>((resolve) => stubServer.listen(0, "127.0.0.1", resolve));
  const { port } = stubServer.address() as AddressInfo;
  stubUrl = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => stubServer.close((err) => (err ? reject(err) : resolve())));
});

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
  loadConfigMock.mockResolvedValue({
    apiUrl: stubUrl,
    apiKey: "git_test",
    defaultProvider: "openai",
    defaultModel: "gpt-4o-mini",
  });
  assertInsideWorkTreeMock.mockResolvedValue(undefined);
  readDiffWithFallbackMock.mockResolvedValue({ diff: VALID_DIFF, source: "staged" });
  stubResponder = (_req, res) => {
    res.writeHead(500);
    res.end("no responder set");
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function runAndCatchExit(
  opts: Parameters<typeof runGenerate>[0],
): Promise<number> {
  try {
    await runGenerate(opts, new AbortController().signal);
    return 0;
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

describe("generate exit-code matrix (stub server)", () => {
  it("exit 0 — success: SSE suggestion + done, user picks", async () => {
    stubResponder = (_req, res) => sendSse(res, [sse("suggestion", SUGGESTION), sse("done", DONE)]);
    selectMock.mockResolvedValue(SUGGESTION);

    expect(await runAndCatchExit({})).toBe(0);
    expect(stdoutBuf).toContain("feat: add a");
  });

  it("exit 1 — generic API error: server returns 400 envelope", async () => {
    stubResponder = (_req, res) =>
      sendJson(res, 400, { error: { code: "BAD_REQUEST", message: "diff too large" } });

    expect(await runAndCatchExit({})).toBe(1);
    expect(stderrBuf).toMatch(/diff too large/);
  });

  it("exit 2 — not in a git work tree", async () => {
    assertInsideWorkTreeMock.mockRejectedValue(new GitError("NOT_A_REPO", "x"));

    expect(await runAndCatchExit({})).toBe(2);
    expect(stderrBuf).toMatch(/not inside a git work tree/);
  });

  it("exit 2 — no staged changes (and HEAD diff empty)", async () => {
    readDiffWithFallbackMock.mockResolvedValue(null);

    expect(await runAndCatchExit({})).toBe(2);
    expect(stderrBuf).toMatch(/nothing to commit/);
  });

  it("exit 3 — auth failure: server returns 401", async () => {
    stubResponder = (_req, res) =>
      sendJson(res, 401, { error: { code: "UNAUTHORIZED", message: "bad key" } });

    expect(await runAndCatchExit({})).toBe(3);
    expect(stderrBuf).toMatch(/api key rejected/);
  });

  it("exit 3 — missing config", async () => {
    loadConfigMock.mockRejectedValue(new ConfigError("MISSING", "no config"));

    expect(await runAndCatchExit({})).toBe(3);
    expect(stderrBuf).toMatch(/no config/);
  });

  it("exit 4 — network failure: connection refused after retry", async () => {
    loadConfigMock.mockResolvedValue({
      apiUrl: "http://127.0.0.1:1",
      apiKey: "git_test",
      defaultProvider: "openai",
      defaultModel: "gpt-4o-mini",
    });

    expect(await runAndCatchExit({})).toBe(4);
    expect(stderrBuf).toMatch(/cannot reach API/);
  });

  it("exit 5 — LLM failure: SSE error frame", async () => {
    stubResponder = (_req, res) =>
      sendSse(res, [sse("error", { code: "LLM_ERROR", message: "boom" })]);

    expect(await runAndCatchExit({})).toBe(5);
    expect(stderrBuf).toMatch(/stream failed/);
  });

  it("exit 130 — user aborts via quit choice", async () => {
    stubResponder = (_req, res) => sendSse(res, [sse("suggestion", SUGGESTION), sse("done", DONE)]);
    selectMock.mockResolvedValue(null);

    expect(await runAndCatchExit({})).toBe(130);
    expect(stderrBuf).toMatch(/aborted/);
  });
});
