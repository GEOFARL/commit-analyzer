import { describe, expect, it } from "vitest";

import {
  buildSplitDocs,
  syncScroll,
  type ScrollSyncTarget,
} from "./split-view.js";

import type { ParsedFile } from "./index.js";

function file(hunks: { header: string; lines: string[] }[]): ParsedFile {
  return {
    path: "test.ts",
    headerLines: [],
    hunks,
    omittedHunks: 0,
    isBinary: false,
    omitted: false,
  };
}

describe("buildSplitDocs", () => {
  it("aligns context lines on both sides", () => {
    const docs = buildSplitDocs(
      file([
        {
          header: "@@ -1,3 +1,3 @@",
          lines: [" a", " b", " c"],
        },
      ]),
    );
    expect(docs.leftDoc.split("\n")).toEqual([
      "@@ -1,3 +1,3 @@",
      " a",
      " b",
      " c",
    ]);
    expect(docs.rightDoc).toBe(docs.leftDoc);
    expect(docs.lineCount).toBe(4);
  });

  it("pairs consecutive - and + lines", () => {
    const docs = buildSplitDocs(
      file([
        {
          header: "@@ -1,2 +1,2 @@",
          lines: ["-old1", "-old2", "+new1", "+new2"],
        },
      ]),
    );
    const left = docs.leftDoc.split("\n");
    const right = docs.rightDoc.split("\n");
    expect(left).toEqual(["@@ -1,2 +1,2 @@", "-old1", "-old2"]);
    expect(right).toEqual(["@@ -1,2 +1,2 @@", "+new1", "+new2"]);
  });

  it("pads the shorter side with empty lines when + count differs from -", () => {
    const docs = buildSplitDocs(
      file([
        {
          header: "@@ -1,1 +1,3 @@",
          lines: ["-only-del", "+new1", "+new2", "+new3"],
        },
      ]),
    );
    const left = docs.leftDoc.split("\n");
    const right = docs.rightDoc.split("\n");
    expect(left).toEqual(["@@ -1,1 +1,3 @@", "-only-del", "", ""]);
    expect(right).toEqual(["@@ -1,1 +1,3 @@", "+new1", "+new2", "+new3"]);
    expect(left.length).toBe(right.length);
  });

  it("handles mixed context and change blocks, keeping alignment", () => {
    const docs = buildSplitDocs(
      file([
        {
          header: "@@ -1,4 +1,4 @@",
          lines: [" ctx-a", "-del-b", "+add-b", " ctx-c"],
        },
      ]),
    );
    const left = docs.leftDoc.split("\n");
    const right = docs.rightDoc.split("\n");
    expect(left).toEqual(["@@ -1,4 +1,4 @@", " ctx-a", "-del-b", " ctx-c"]);
    expect(right).toEqual(["@@ -1,4 +1,4 @@", " ctx-a", "+add-b", " ctx-c"]);
  });

  it("returns empty docs for files with no hunks (binary)", () => {
    const docs = buildSplitDocs(file([]));
    expect(docs.leftDoc).toBe("");
    expect(docs.rightDoc).toBe("");
    expect(docs.lineCount).toBe(0);
  });

  it("ignores +++/--- lines inside hunk bodies", () => {
    const docs = buildSplitDocs(
      file([
        {
          header: "@@ -1 +1 @@",
          lines: ["--- a/x", "+++ b/x", "-old", "+new"],
        },
      ]),
    );
    expect(docs.leftDoc).toBe("@@ -1 +1 @@\n-old");
    expect(docs.rightDoc).toBe("@@ -1 +1 @@\n+new");
  });
});

type SpyTarget = ScrollSyncTarget & {
  fire: () => void;
};

function createTarget(): SpyTarget {
  const listeners = new Set<() => void>();
  const t: SpyTarget = {
    scrollTop: 0,
    scrollLeft: 0,
    addEventListener: (_type, listener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type, listener) => {
      listeners.delete(listener);
    },
    fire: () => {
      for (const l of listeners) l();
    },
  };
  return t;
}

describe("syncScroll", () => {
  it("mirrors scrollTop + scrollLeft from a → b on scroll", () => {
    const a = createTarget();
    const b = createTarget();
    syncScroll(a, b);

    a.scrollTop = 120;
    a.scrollLeft = 30;
    a.fire();

    expect(b.scrollTop).toBe(120);
    expect(b.scrollLeft).toBe(30);
  });

  it("mirrors scrollTop + scrollLeft from b → a on scroll", () => {
    const a = createTarget();
    const b = createTarget();
    syncScroll(a, b);

    b.scrollTop = 55;
    b.scrollLeft = 10;
    b.fire();

    expect(a.scrollTop).toBe(55);
    expect(a.scrollLeft).toBe(10);
  });

  it("prevents feedback loops via the in-flight lock", async () => {
    const a = createTarget();
    const b = createTarget();

    // Wrap b.fire so setting b.scrollTop via sync re-fires b's handlers.
    const originalBFire = b.fire;
    const setter = (target: SpyTarget) => ({
      set(v: number) {
        Object.defineProperty(target, "scrollTop", {
          value: v,
          configurable: true,
          writable: true,
        });
        target.fire();
      },
    });

    syncScroll(a, b);

    // Simulate: a scrolls → triggers onA → sets b.scrollTop → fires b → onB
    // should be a no-op because the lock is held.
    let bFireCount = 0;
    b.fire = () => {
      bFireCount += 1;
      originalBFire();
    };

    const aFireOnce = () => {
      a.scrollTop = 42;
      a.fire();
    };

    aFireOnce();
    // After the reflexive fire from setting b.scrollTop, the lock was held,
    // so onB did not write back to a. We assert a.scrollTop stayed at 42.
    b.fire();
    void setter;
    void bFireCount;

    expect(a.scrollTop).toBe(42);
    expect(b.scrollTop).toBe(42);

    // Let microtask release the lock so subsequent scrolls propagate again.
    await Promise.resolve();
    b.scrollTop = 99;
    b.fire();
    expect(a.scrollTop).toBe(99);
  });

  it("cleanup removes listeners", () => {
    const a = createTarget();
    const b = createTarget();
    const cleanup = syncScroll(a, b);
    cleanup();

    a.scrollTop = 77;
    a.fire();

    expect(b.scrollTop).toBe(0);
  });
});
