import type { Command } from "commander";

export function registerKeysCommand(program: Command): void {
  const keys = program.command("keys").description("manage API keys");

  keys
    .command("list")
    .description("list stored API keys")
    .action(() => {
      console.error("keys list: not implemented yet");
      process.exit(1);
    });
}
