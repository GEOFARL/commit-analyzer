import type {
  GenerateRequest,
  RuleResultDto,
  SuggestionFrame,
} from "@commit-analyzer/contracts";
import { select } from "@inquirer/prompts";
import type { Command } from "commander";
import ora, { type Ora } from "ora";

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
import { ConfigError, loadConfig, type CliConfig } from "../lib/config.js";
import { parseAndStripDiff, renderParsedDiff } from "../lib/diff-strip.js";
import { GitError, assertInsideWorkTree, readDiffWithFallback } from "../lib/git.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROVIDERS = ["openai", "anthropic"] as const;
type Provider = (typeof PROVIDERS)[number];

interface GenerateOptions {
  provider?: string;
  model?: string;
  repo?: string;
  policy?: string;
  count?: number;
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

async function runGenerate(opts: GenerateOptions, signal: AbortSignal): Promise<void> {
  try {
    await assertInsideWorkTree();
  } catch (err) {
    if (err instanceof GitError && err.code === "NOT_A_REPO") {
      process.stderr.write("error: not inside a git work tree\n");
      process.exit(2);
    }
    throw err;
  }

  const resolved = await readDiffWithFallback();
  if (!resolved) {
    process.stderr.write(
      "error: nothing to commit. Stage changes with `git add` and try again.\n",
    );
    process.exit(2);
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

  const spinner: Ora = ora({ text: `generating with ${provider}/${model}…`, stream: process.stderr });
  spinner.start();
  let received = 0;

  let result;
  try {
    result = await streamGenerate(
      { apiUrl: cfg.apiUrl, apiKey: cfg.apiKey },
      body,
      {
        signal,
        onSuggestion: () => {
          received += 1;
          spinner.text = `generating with ${provider}/${model}… received ${received}`;
        },
      },
    );
    spinner.succeed(`done — ${result.suggestions.length} suggestion(s), tokens=${result.done.tokensUsed}`);
  } catch (err) {
    spinner.stop();
    throw err;
  }

  if (result.suggestions.length === 0) {
    process.stderr.write("error: no suggestions returned.\n");
    process.exit(5);
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
    process.stderr.write("aborted\n");
    process.exit(130);
  }

  process.stdout.write(`${formatFullMessage(choice)}\n`);
}

function resolveProvider(opt: string | undefined, cfg: CliConfig): Provider {
  const raw = opt ?? cfg.defaultProvider;
  if (!raw) {
    process.stderr.write(
      "error: provider not set. Pass --provider or set defaultProvider in your config.\n",
    );
    process.exit(1);
  }
  if (!PROVIDERS.includes(raw as Provider)) {
    process.stderr.write(`error: invalid provider "${raw}" (expected: ${PROVIDERS.join("|")}).\n`);
    process.exit(1);
  }
  return raw as Provider;
}

function resolveModel(opt: string | undefined, cfg: CliConfig): string {
  const raw = opt ?? cfg.defaultModel;
  if (!raw) {
    process.stderr.write(
      "error: model not set. Pass --model or set defaultModel in your config.\n",
    );
    process.exit(1);
  }
  return raw;
}

function resolveUuidOption(value: string | undefined, flag: string): string | undefined {
  if (value === undefined) return undefined;
  if (!UUID_RE.test(value)) {
    process.stderr.write(`error: ${flag} must be a uuid.\n`);
    process.exit(1);
  }
  return value;
}

function resolveCount(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    process.stderr.write("error: --count must be an integer between 1 and 5.\n");
    process.exit(1);
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

function handleError(err: unknown): never {
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
