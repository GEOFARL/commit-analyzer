import {
  llmProviderSchema,
  type GenerateRequest,
  type LlmProviderName,
  type RuleResultDto,
  type SuggestionFrame,
} from "@commit-analyzer/contracts";
import { select } from "@inquirer/prompts";
import type { Command } from "commander";
import ora, { type Ora } from "ora";
import { z } from "zod";

import { streamGenerate } from "../lib/api-client.js";
import {
  AbortError,
  ApiResponseError,
  AuthError,
  NetworkError,
  ProtocolError,
  StreamError,
  TimeoutError,
} from "../lib/api-errors.js";
import { ClipboardError, copyToClipboard } from "../lib/clipboard.js";
import { ConfigError, loadConfig, type CliConfig } from "../lib/config.js";
import { parseAndStripDiff, renderParsedDiff } from "../lib/diff-strip.js";
import {
  GitError,
  assertInsideWorkTree,
  commitMessage,
  readDiffWithFallback,
} from "../lib/git.js";

const PROVIDERS = llmProviderSchema.options;
const uuidSchema = z.string().uuid();
const NETWORK_RETRY_BACKOFF_MS = 250;

class GenerateError extends Error {
  readonly exitCode: number;

  constructor(exitCode: number, message: string) {
    super(message);
    this.name = "GenerateError";
    this.exitCode = exitCode;
  }
}

interface GenerateOptions {
  provider?: string;
  model?: string;
  repo?: string;
  policy?: string;
  count?: number;
  commit?: boolean;
  copy?: boolean;
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("read staged diff, call the API, pick a suggestion")
    .option("--provider <provider>", "LLM provider (openai|anthropic)")
    .option("--model <model>", "model id")
    .option("--repo <repositoryId>", "connected repository id (uuid)")
    .option("--policy <policyId>", "policy id (uuid) to enforce")
    .option("--count <n>", "number of suggestions (1-5)", (v) => Number.parseInt(v, 10))
    .option("--commit", "create a git commit with the chosen message")
    .option("--copy", "copy the chosen message to the clipboard")
    .action(async (opts: GenerateOptions) => {
      const controller = new AbortController();
      const onSigint = (): void => controller.abort();
      process.once("SIGINT", onSigint);
      try {
        await runGenerate(opts, controller.signal);
      } catch (err) {
        handleError(err);
      } finally {
        process.removeListener("SIGINT", onSigint);
      }
    });
}

export async function runGenerate(opts: GenerateOptions, signal: AbortSignal): Promise<void> {
  await assertInsideWorkTreeOrExit();

  const resolved = await readDiffWithFallback();
  if (!resolved) {
    throw new GenerateError(2, "nothing to commit. Stage changes with `git add` and try again.");
  }
  if (resolved.source === "head") {
    process.stderr.write("note: no staged changes; using `git diff HEAD`.\n");
  }

  const cfg = await loadConfig();
  const provider = resolveProvider(opts.provider, cfg);
  const model = resolveModel(opts.model, cfg);
  const repositoryId = resolveUuidOption(opts.repo, "--repo");
  const policyId = resolveUuidOption(opts.policy, "--policy");
  const count = resolveCount(opts.count);

  const stripped = parseAndStripDiff(resolved.diff);
  if (stripped.truncated) {
    process.stderr.write("note: diff truncated to fit token budget.\n");
  }
  const diff = renderParsedDiff(stripped);

  const body: GenerateRequest = {
    diff,
    provider,
    model,
    ...(repositoryId ? { repositoryId } : {}),
    ...(policyId ? { policyId } : {}),
    ...(count !== undefined ? { count } : {}),
  };

  const spinner: Ora = ora({
    text: spinnerText(provider, model, 0),
    stream: process.stderr,
  });
  spinner.start();
  let received = 0;

  const result = await streamWithRetry(
    cfg,
    body,
    signal,
    () => {
      received += 1;
      spinner.text = spinnerText(provider, model, received);
    },
    spinner,
  );
  spinner.succeed(
    `done — ${result.suggestions.length} suggestion(s), tokens=${result.done.tokensUsed}`,
  );

  if (result.suggestions.length === 0) {
    throw new GenerateError(5, "no suggestions returned.");
  }

  printSuggestions(result.suggestions);

  const choice = await select<SuggestionFrame | null>({
    message: "Pick a suggestion (or quit):",
    choices: [
      ...result.suggestions.map((s) => ({
        name: `${s.index + 1}. ${formatHeader(s)}${policyTag(s)}`,
        value: s,
      })),
      { name: "q. quit", value: null },
    ],
  });

  if (!choice) {
    throw new GenerateError(130, "aborted");
  }

  const fullMessage = formatFullMessage(choice);
  process.stdout.write(`${fullMessage}\n`);

  if (opts.copy) {
    try {
      await copyToClipboard(fullMessage);
      process.stderr.write("copied to clipboard.\n");
    } catch (err) {
      if (err instanceof ClipboardError) {
        throw new GenerateError(1, err.message);
      }
      throw err;
    }
  }

  if (opts.commit) {
    const subject = formatHeader(choice);
    const commitBody = formatCommitBody(choice);
    try {
      await commitMessage({ subject, ...(commitBody ? { body: commitBody } : {}) });
      process.stderr.write("commit created.\n");
    } catch (err) {
      if (err instanceof GitError) {
        const detail = err.stderr ? ` (${err.stderr})` : "";
        throw new GenerateError(1, `commit failed${detail}`);
      }
      throw err;
    }
  }
}

function formatCommitBody(s: SuggestionFrame): string {
  const parts: string[] = [];
  if (s.body) parts.push(s.body);
  if (s.footer) parts.push(s.footer);
  return parts.join("\n\n");
}

async function assertInsideWorkTreeOrExit(): Promise<void> {
  try {
    await assertInsideWorkTree();
  } catch (err) {
    if (err instanceof GitError && err.code === "NOT_A_REPO") {
      throw new GenerateError(2, "not inside a git work tree");
    }
    throw err;
  }
}

async function streamWithRetry(
  cfg: CliConfig,
  body: GenerateRequest,
  signal: AbortSignal,
  onSuggestion: () => void,
  spinner: Ora,
): ReturnType<typeof streamGenerate> {
  try {
    return await streamGenerate(
      { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey },
      body,
      { signal, onSuggestion },
    );
  } catch (err) {
    if (err instanceof NetworkError && !signal.aborted) {
      spinner.text = "network error — retrying once…";
      await new Promise((r) => setTimeout(r, NETWORK_RETRY_BACKOFF_MS));
      try {
        return await streamGenerate(
          { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey },
          body,
          { signal, onSuggestion },
        );
      } catch (retryErr) {
        spinner.fail("network error after retry");
        throw retryErr;
      }
    }
    spinner.fail(spinnerFailLabel(err));
    throw err;
  }
}

function spinnerText(provider: string, model: string, received: number): string {
  const tail = received > 0 ? ` received ${received}` : "";
  return `generating with ${provider}/${model}…${tail}`;
}

function spinnerFailLabel(err: unknown): string {
  if (err instanceof AuthError) return "auth rejected";
  if (err instanceof TimeoutError) return "request timed out";
  if (err instanceof StreamError || err instanceof ProtocolError) return "stream failed";
  if (err instanceof ApiResponseError) return `api error (${err.status})`;
  if (err instanceof AbortError) return "aborted";
  return "generate failed";
}

function resolveProvider(opt: string | undefined, cfg: CliConfig): LlmProviderName {
  const raw = opt ?? cfg.defaultProvider;
  if (!raw) {
    throw new GenerateError(
      1,
      "provider not set. Pass --provider or set defaultProvider in your config.",
    );
  }
  const parsed = llmProviderSchema.safeParse(raw);
  if (!parsed.success) {
    throw new GenerateError(
      1,
      `invalid provider "${raw}" (expected: ${PROVIDERS.join("|")}).`,
    );
  }
  return parsed.data;
}

function resolveModel(opt: string | undefined, cfg: CliConfig): string {
  const raw = opt ?? cfg.defaultModel;
  if (!raw) {
    throw new GenerateError(
      1,
      "model not set. Pass --model or set defaultModel in your config.",
    );
  }
  return raw;
}

function resolveUuidOption(value: string | undefined, flag: string): string | undefined {
  if (value === undefined) return undefined;
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new GenerateError(1, `${flag} must be a uuid.`);
  }
  return parsed.data;
}

function resolveCount(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    throw new GenerateError(1, "--count must be an integer between 1 and 5.");
  }
  return value;
}

function printSuggestions(suggestions: SuggestionFrame[]): void {
  for (const s of suggestions) {
    process.stdout.write(`\n[${s.index + 1}] ${formatHeader(s)}${policyTag(s)}\n`);
    if (s.body) {
      const indented = s.body
        .split("\n")
        .map((l) => `    ${l}`)
        .join("\n");
      process.stdout.write(`${indented}\n`);
    }
    if (s.footer) {
      process.stdout.write(`    ${s.footer}\n`);
    }
    if (s.validation && s.validation.results.length > 0) {
      for (const r of s.validation.results) {
        process.stdout.write(`    ${ruleLine(r)}\n`);
      }
    }
  }
}

function formatHeader(s: SuggestionFrame): string {
  const scope = s.scope ? `(${s.scope})` : "";
  return `${s.type}${scope}: ${s.subject}`;
}

function policyTag(s: SuggestionFrame): string {
  if (!s.validation) return "";
  return s.validation.passed ? "  [pass]" : "  [fail]";
}

function ruleLine(r: RuleResultDto): string {
  const mark = r.passed ? "✓" : "✗";
  const detail = r.message ? ` — ${r.message}` : "";
  return `${mark} ${r.ruleType}${detail}`;
}

function formatFullMessage(s: SuggestionFrame): string {
  const parts = [formatHeader(s)];
  if (s.body) parts.push("", s.body);
  if (s.footer) parts.push("", s.footer);
  return parts.join("\n");
}

export function handleError(err: unknown): never {
  if (err instanceof GenerateError) {
    process.stderr.write(`${err.exitCode === 130 ? "" : "error: "}${err.message}\n`);
    process.exit(err.exitCode);
  }
  if (err instanceof AbortError || isInquirerCancel(err)) {
    process.stderr.write("aborted\n");
    process.exit(130);
  }
  if (err instanceof ConfigError) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(3);
  }
  if (err instanceof AuthError) {
    process.stderr.write(
      `error: api key rejected (${err.status}). Re-run \`git-insight configure\`.\n`,
    );
    process.exit(3);
  }
  if (err instanceof NetworkError || err instanceof TimeoutError) {
    process.stderr.write(`error: cannot reach API: ${err.message}\n`);
    process.exit(4);
  }
  if (err instanceof StreamError || err instanceof ProtocolError) {
    process.stderr.write(`error: stream failed: ${err.message}\n`);
    process.exit(5);
  }
  if (err instanceof ApiResponseError) {
    process.stderr.write(`error: ${err.message}\n`);
    process.exit(err.status >= 500 ? 5 : 1);
  }
  if (err instanceof GitError) {
    const detail = err.stderr ? ` (${err.stderr})` : "";
    process.stderr.write(`error: ${err.message}${detail}\n`);
    process.exit(1);
  }
  process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
}

function isInquirerCancel(err: unknown): boolean {
  return err instanceof Error && err.name === "ExitPromptError";
}
