import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { cosmiconfig } from "cosmiconfig";
import { z } from "zod";

const llmProviderEnum = z.enum(["openai", "anthropic"]);

export const configSchema = z.object({
  apiUrl: z.string().url(),
  apiKey: z.string().regex(/^git_[A-Za-z0-9_-]+$/),
  defaultProvider: llmProviderEnum.optional(),
  defaultModel: z.string().optional(),
});

export type CliConfig = z.infer<typeof configSchema>;

const CONFIG_MODULE_NAME = "projectrc";
export const CONFIG_FILE_MODE = 0o600;
const PERMISSION_MASK = 0o077;

export class ConfigError extends Error {
  readonly code: ConfigErrorCode;

  constructor(code: ConfigErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ConfigError";
    this.code = code;
  }
}

type ConfigErrorCode = "MISSING" | "INVALID" | "PERMISSIONS" | "READ";

function defaultConfigPath(): string {
  return join(homedir(), ".projectrc");
}

export async function loadConfig(): Promise<CliConfig> {
  const explorer = cosmiconfig(CONFIG_MODULE_NAME, {
    searchPlaces: [
      ".projectrc",
      ".projectrc.json",
      "package.json",
      join(homedir(), ".projectrc"),
    ],
  });

  const envPath = process.env.PROJECTRC_PATH;
  const found = envPath ? await loadAt(explorer, envPath) : await explorer.search();

  if (!found || found.isEmpty) {
    throw new ConfigError(
      "MISSING",
      envPath
        ? `no config at PROJECTRC_PATH=${envPath}. Run \`git-insight configure\`.`
        : "no config found. Run `git-insight configure` to create one.",
    );
  }

  if (found.filepath) await assertSecureMode(found.filepath);

  const parsed = configSchema.safeParse(found.config);
  if (!parsed.success) {
    throw new ConfigError(
      "INVALID",
      `config at ${found.filepath ?? "<unknown>"} is invalid: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

type Explorer = ReturnType<typeof cosmiconfig>;
type LoadResult = Awaited<ReturnType<Explorer["load"]>>;

async function loadAt(explorer: Explorer, path: string): Promise<LoadResult | null> {
  try {
    return await explorer.load(path);
  } catch (err) {
    if (isEnoent(err)) return null;
    throw err;
  }
}

function isEnoent(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: unknown }).code === "ENOENT"
  );
}

async function assertSecureMode(path: string): Promise<void> {
  let stat;
  try {
    stat = await fs.stat(path);
  } catch (err) {
    throw new ConfigError("READ", `cannot stat config file ${path}`, { cause: err });
  }
  const mode = stat.mode & 0o777;
  if ((mode & PERMISSION_MASK) !== 0) {
    throw new ConfigError(
      "PERMISSIONS",
      `config file ${path} has insecure permissions ${mode.toString(8)}; expected 600. Run \`chmod 600 ${path}\`.`,
    );
  }
}

export async function saveConfig(config: CliConfig, path = defaultConfigPath()): Promise<string> {
  const validated = configSchema.parse(config);
  const json = `${JSON.stringify(validated, null, 2)}\n`;
  const handle = await fs.open(path, "w", CONFIG_FILE_MODE);
  try {
    await handle.writeFile(json, "utf8");
    await handle.chmod(CONFIG_FILE_MODE);
  } finally {
    await handle.close();
  }
  return path;
}

export function redactKey(key: string): string {
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-2)}`;
}
