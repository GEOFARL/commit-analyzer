import type { ParsedFile } from "./index.js";

type SplitDocs = {
  leftDoc: string;
  rightDoc: string;
  lineCount: number;
};

export function buildSplitDocs(file: ParsedFile): SplitDocs {
  const left: string[] = [];
  const right: string[] = [];
  let dels: string[] = [];
  let adds: string[] = [];

  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i += 1) {
      left.push(i < dels.length ? dels[i]! : "");
      right.push(i < adds.length ? adds[i]! : "");
    }
    dels = [];
    adds = [];
  };

  for (const hunk of file.hunks) {
    flush();
    left.push(hunk.header);
    right.push(hunk.header);
    for (const line of hunk.lines) {
      if (line.startsWith("---")) continue;
      if (line.startsWith("+++")) continue;
      if (line.startsWith("-")) {
        dels.push(line);
      } else if (line.startsWith("+")) {
        adds.push(line);
      } else {
        flush();
        left.push(line);
        right.push(line);
      }
    }
    flush();
  }

  return {
    leftDoc: left.join("\n"),
    rightDoc: right.join("\n"),
    lineCount: left.length,
  };
}

export type ScrollSyncTarget = {
  scrollTop: number;
  scrollLeft: number;
  addEventListener: (
    type: "scroll",
    listener: () => void,
    options?: { passive?: boolean },
  ) => void;
  removeEventListener: (type: "scroll", listener: () => void) => void;
};

export function syncScroll(
  a: ScrollSyncTarget,
  b: ScrollSyncTarget,
): () => void {
  let locked = false;

  const sync = (src: ScrollSyncTarget, dst: ScrollSyncTarget) => {
    if (locked) return;
    locked = true;
    dst.scrollTop = src.scrollTop;
    dst.scrollLeft = src.scrollLeft;
    queueMicrotask(() => {
      locked = false;
    });
  };

  const onA = () => sync(a, b);
  const onB = () => sync(b, a);

  a.addEventListener("scroll", onA, { passive: true });
  b.addEventListener("scroll", onB, { passive: true });

  return () => {
    a.removeEventListener("scroll", onA);
    b.removeEventListener("scroll", onB);
  };
}
