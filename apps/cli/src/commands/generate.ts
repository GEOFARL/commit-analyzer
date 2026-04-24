import type { Command } from "commander";

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("read staged diff, call the API, pick a suggestion")
    .option("--provider <provider>", "LLM provider (openai|anthropic)")
    .option("--model <model>", "model id")
    .option("--repo <full_name>", "repository full name (owner/repo)")
    .option("--count <n>", "number of suggestions", (v) => Number.parseInt(v, 10))
    .option("--commit", "create the commit with the chosen message")
    .option("--copy", "copy the chosen message to clipboard")
    .action(() => {
      console.error("generate: not implemented yet");
      process.exit(1);
    });
}
