import type { ParsedFile } from "./index.js";

export type SplitLineSignal =
  | "context"
  | "add"
  | "del"
  | "empty"
  | "header";

type StrippedSplitDocs = {
  leftDoc: string;
  rightDoc: string;
  lineCount: number;
  leftSignals: SplitLineSignal[];
  rightSignals: SplitLineSignal[];
};

function stripPrefix(line: string): string {
  const ch = line.charCodeAt(0);
  if (ch === 0x2b /* + */ || ch === 0x2d /* - */ || ch === 0x20 /* space */) {
    return line.slice(1);
  }
  return line;
}

export function buildStrippedSplitDocs(file: ParsedFile): StrippedSplitDocs {
  const leftLines: string[] = [];
  const rightLines: string[] = [];
  const leftSignals: SplitLineSignal[] = [];
  const rightSignals: SplitLineSignal[] = [];
  let dels: string[] = [];
  let adds: string[] = [];

  const flush = () => {
    const n = Math.max(dels.length, adds.length);
    for (let i = 0; i < n; i += 1) {
      if (i < dels.length) {
        leftLines.push(stripPrefix(dels[i]!));
        leftSignals.push("del");
      } else {
        leftLines.push("");
        leftSignals.push("empty");
      }
      if (i < adds.length) {
        rightLines.push(stripPrefix(adds[i]!));
        rightSignals.push("add");
      } else {
        rightLines.push("");
        rightSignals.push("empty");
      }
    }
    dels = [];
    adds = [];
  };

  for (const hunk of file.hunks) {
    flush();
    leftLines.push(hunk.header);
    rightLines.push(hunk.header);
    leftSignals.push("header");
    rightSignals.push("header");
    for (const line of hunk.lines) {
      if (line.startsWith("-")) {
        dels.push(line);
      } else if (line.startsWith("+")) {
        adds.push(line);
      } else {
        flush();
        const stripped = stripPrefix(line);
        leftLines.push(stripped);
        rightLines.push(stripped);
        leftSignals.push("context");
        rightSignals.push("context");
      }
    }
    flush();
  }

  return {
    leftDoc: leftLines.join("\n"),
    rightDoc: rightLines.join("\n"),
    lineCount: leftLines.length,
    leftSignals,
    rightSignals,
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
