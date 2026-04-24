import { Command } from "commander";

import { registerConfigureCommand } from "./commands/configure.js";
import { registerGenerateCommand } from "./commands/generate.js";
import { registerKeysCommand } from "./commands/keys.js";
import { registerWhoamiCommand } from "./commands/whoami.js";

const program = new Command();

program
  .name("git-insight")
  .description("Commit-message generator CLI (AI-assisted)")
  .version("0.0.0");

registerConfigureCommand(program);
registerGenerateCommand(program);
registerWhoamiCommand(program);
registerKeysCommand(program);

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
