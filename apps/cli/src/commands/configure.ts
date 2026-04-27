import { input, password } from "@inquirer/prompts";
import type { Command } from "commander";

import { createApiClient, whoami } from "../lib/api-client.js";
import { AbortError, AuthError, NetworkError } from "../lib/api-errors.js";
import {
  configSchema,
  redactKey,
  saveConfig,
  type CliConfig,
} from "../lib/config.js";

interface ConfigureOptions {
  url?: string;
  key?: string;
}

export function registerConfigureCommand(program: Command): void {
  program
    .command("configure")
    .description("save API URL and API key to ~/.projectrc (mode 0600)")
    .option("--url <url>", "API URL")
    .option("--key <key>", "API key")
    .action(async (opts: ConfigureOptions) => {
      try {
        await runConfigure(opts);
      } catch (err) {
        if (err instanceof AbortError || isInquirerCancel(err)) {
          process.stderr.write("aborted\n");
          process.exit(130);
        }
        if (err instanceof AuthError) {
          process.stderr.write(`error: api key rejected (${err.status}). config not saved.\n`);
          process.exit(3);
        }
        if (err instanceof NetworkError) {
          process.stderr.write(`error: cannot reach API: ${err.message}\n`);
          process.exit(4);
        }
        process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });
}

async function runConfigure(opts: ConfigureOptions): Promise<void> {
  const apiUrl =
    opts.url ?? (await input({ message: "API URL:", default: "http://localhost:3000" }));
  const apiKey = opts.key ?? (await password({ message: "API key:", mask: "*" }));

  const draft: CliConfig = configSchema.parse({ apiUrl, apiKey });

  process.stdout.write(`verifying key with ${draft.apiUrl} …\n`);
  const client = createApiClient({ apiUrl: draft.apiUrl, apiKey: draft.apiKey });
  const user = await whoami(client);

  const path = await saveConfig(draft);
  const who = user.email ?? user.name ?? user.id;
  process.stdout.write(
    `saved ${path} (mode 0600). authenticated as ${who} (${redactKey(draft.apiKey)}).\n`,
  );
}

function isInquirerCancel(err: unknown): boolean {
  return err instanceof Error && err.name === "ExitPromptError";
}
