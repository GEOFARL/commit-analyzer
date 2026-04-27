import { promises as fs } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CONFIG_FILE_MODE,
  ConfigError,
  configSchema,
  loadConfig,
  redactKey,
  saveConfig,
} from "./config.js";

const VALID = {
  apiUrl: "https://api.example.com",
  apiKey: "git_abcdefghijk",
};

describe("config schema", () => {
  it("accepts the minimum shape", () => {
    expect(configSchema.parse(VALID)).toEqual(VALID);
  });

  it("rejects malformed apiKey", () => {
    expect(() => configSchema.parse({ ...VALID, apiKey: "nope" })).toThrow();
  });

  it("rejects non-url apiUrl", () => {
    expect(() => configSchema.parse({ ...VALID, apiUrl: "not-a-url" })).toThrow();
  });
});

describe("saveConfig", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "git-insight-cfg-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("writes JSON with mode 0600", async () => {
    const path = join(dir, "config.json");
    await saveConfig(VALID, path);
    const written = JSON.parse(await fs.readFile(path, "utf8")) as unknown;
    expect(written).toEqual(VALID);
    const st = await stat(path);
    expect(st.mode & 0o777).toBe(CONFIG_FILE_MODE);
  });

  it("re-applies 0600 even if existing file was world-readable", async () => {
    const path = join(dir, "config.json");
    await fs.writeFile(path, "{}", { mode: 0o644 });
    await saveConfig(VALID, path);
    const st = await stat(path);
    expect(st.mode & 0o777).toBe(CONFIG_FILE_MODE);
  });

  it("rejects invalid config before touching disk", async () => {
    const path = join(dir, "config.json");
    await expect(saveConfig({ apiUrl: "x", apiKey: "y" } as never, path)).rejects.toBeDefined();
    await expect(fs.access(path)).rejects.toBeDefined();
  });
});

describe("loadConfig", () => {
  let dir: string;
  let prevEnv: string | undefined;
  let prevHome: string | undefined;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "git-insight-load-"));
    prevEnv = process.env.PROJECTRC_PATH;
    prevHome = process.env.HOME;
    process.env.HOME = dir;
    delete process.env.PROJECTRC_PATH;
  });

  afterEach(async () => {
    if (prevEnv === undefined) delete process.env.PROJECTRC_PATH;
    else process.env.PROJECTRC_PATH = prevEnv;
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    await rm(dir, { recursive: true, force: true });
  });

  it("loads via PROJECTRC_PATH", async () => {
    const path = join(dir, "rc.json");
    await fs.writeFile(path, JSON.stringify(VALID), { mode: 0o600 });
    process.env.PROJECTRC_PATH = path;
    expect(await loadConfig()).toEqual(VALID);
  });

  it("throws ConfigError MISSING when no config found", async () => {
    const err = await loadConfig().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConfigError);
    expect((err as ConfigError).code).toBe("MISSING");
  });

  it("throws ConfigError MISSING when PROJECTRC_PATH points at nothing", async () => {
    process.env.PROJECTRC_PATH = join(dir, "does-not-exist.json");
    const err = await loadConfig().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConfigError);
    expect((err as ConfigError).code).toBe("MISSING");
  });

  it("rejects insecure file mode", async () => {
    const path = join(dir, "rc.json");
    await fs.writeFile(path, JSON.stringify(VALID), { mode: 0o644 });
    process.env.PROJECTRC_PATH = path;
    const err = await loadConfig().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConfigError);
    expect((err as ConfigError).code).toBe("PERMISSIONS");
  });

  it("rejects malformed config with INVALID", async () => {
    const path = join(dir, "rc.json");
    await fs.writeFile(path, JSON.stringify({ apiUrl: "no", apiKey: "no" }), { mode: 0o600 });
    process.env.PROJECTRC_PATH = path;
    const err = await loadConfig().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConfigError);
    expect((err as ConfigError).code).toBe("INVALID");
  });
});

describe("redactKey", () => {
  it("masks long keys", () => {
    expect(redactKey("git_abcdefghijklmno")).toBe("git_…no");
  });

  it("returns *** for short keys", () => {
    expect(redactKey("short")).toBe("***");
  });
});
