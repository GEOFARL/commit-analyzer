import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import {
  parseAndStripDiff,
  renderParsedDiff,
} from "../src/index.js";

type Fixture = { name: string; input: string };

const require = createRequire(import.meta.url);
const fixtures = require("./fixtures.json") as Fixture[];

// AC #6: CLI mirror produces byte-identical output to server parser on shared
// fixtures. The CLI mirror (apps/cli/src/lib/diff-strip.ts) is a one-line
// re-export from this package, so we load it via a relative path and compare
// every fixture's rendered output against the canonical server path.
describe("diff-parser — server ↔ CLI mirror parity (AC #6)", () => {
  it("every fixture renders byte-identically through both entry points", async () => {
    const cli = (await import(
      "../../../apps/cli/src/lib/diff-strip.ts"
    )) as typeof import("../src/index.js");

    for (const fx of fixtures) {
      const server = parseAndStripDiff(fx.input);
      const mirror = cli.parseAndStripDiff(fx.input);
      expect(renderParsedDiff(server), fx.name).toBe(
        cli.renderParsedDiff(mirror),
      );
      expect(server.summary, fx.name).toBe(mirror.summary);
      expect(server.truncated, fx.name).toBe(mirror.truncated);
    }
  });
});
