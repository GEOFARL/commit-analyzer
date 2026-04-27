import type { Command } from "commander";

import { createApiClient, listApiKeys } from "../lib/api-client.js";
import { AuthError, NetworkError } from "../lib/api-errors.js";
import { ConfigError, loadConfig } from "../lib/config.js";
import { formatKeysTable } from "../lib/keys-table.js";

export function registerKeysCommand(program: Command): void {
  const keys = program.command("keys").description("manage API keys");

  keys
    .command("list")
    .description("list API keys for the authenticated user (calls /api-keys)")
    .action(async () => {
      try {
        const cfg = await loadConfig();
        const client = createApiClient({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey });
        const items = await listApiKeys(client);
        process.stdout.write(formatKeysTable(items));
      } catch (err) {
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
        if (err instanceof NetworkError) {
          process.stderr.write(`error: cannot reach API: ${err.message}\n`);
          process.exit(4);
        }
        process.stderr.write(`error: ${err instanceof Error ? err.message : String(err)}\n`);
        process.exit(1);
      }
    });
}

