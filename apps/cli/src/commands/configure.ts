import type { Command } from "commander";

export function registerConfigureCommand(program: Command): void {
  program
    .command("configure")
    .description("save API URL and API key to ~/.projectrc")
    .option("--url <url>", "API URL")
    .option("--key <key>", "API key")
    .action(() => {
      console.error("configure: not implemented yet");
      process.exit(1);
    });
}
