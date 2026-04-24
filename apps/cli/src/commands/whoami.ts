import type { Command } from "commander";

export function registerWhoamiCommand(program: Command): void {
  program
    .command("whoami")
    .description("show the authenticated user")
    .action(() => {
      console.error("whoami: not implemented yet");
      process.exit(1);
    });
}
