import type { Command } from "commander";

import { createApiClient, whoami } from "../lib/api-client.js";
import { AuthError, NetworkError } from "../lib/api-errors.js";
import { ConfigError, loadConfig } from "../lib/config.js";

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("show the authenticated user (calls /me)")
    .action(async () => {
      try {
        const cfg = await loadConfig();
        const client = createApiClient({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey });
        const user = await whoami(client);
        const email = user.email ?? "(unknown)";
        const name = user.name ?? "(unknown)";
        process.stdout.write(`email: ${email}\nname: ${name}\n`);
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
