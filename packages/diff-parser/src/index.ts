import { encode } from "gpt-tokenizer";

export {
  validateUnifiedDiff,
  type DiffStats,
  type DiffValidationIssue,
  type DiffValidationIssueCode,
  type DiffValidationResult,
} from "./validate.js";

export {
  extensionToLanguageKey,
  LANGUAGE_KEYS,
  type LanguageKey,
} from "./language-key.js";

export type ParsedHunk = {
  header: string;
  lines: string[];
};

export type ParsedFile = {
  path: string;
  headerLines: string[];
  hunks: ParsedHunk[];
  omittedHunks: number;
  isBinary: boolean;
  omitted: boolean;
};

export type ParsedDiff = {
  files: ParsedFile[];
  summary: string;
  truncated: boolean;
};

export type DiffFileChangeKind =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "binary";

export type DiffFileTab = {
  path: string;
  previousPath: string | null;
  changeKind: DiffFileChangeKind;
  additions: number;
  deletions: number;
  isBinary: boolean;
  rangeStart: number;
  rangeEnd: number;
};

export const DIFF_TOKEN_BUDGET = 4000;
export const UNKNOWN_PATH = "<unknown>";

const PII_PATTERNS: ReadonlyArray<{ re: RegExp; replace: string }> = [
  { re: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replace: "<EMAIL>" },
  { re: /gh[ps]_[A-Za-z0-9]{36}/g, replace: "<GITHUB_TOKEN>" },
  { re: /eyJ[A-Za-z0-9_-]{10,}/g, replace: "<JWT>" },
  { re: /AKIA[0-9A-Z]{16}/g, replace: "<AWS_KEY>" },
];

const GENERIC_SECRET_RE =
  /(api[_-]?key|secret|token)(\s*[:=]\s*)(['"]?)([A-Za-z0-9_-]{16,})\3/gi;

function stripPiiLine(line: string): string {
  let out = line;
  for (const { re, replace } of PII_PATTERNS) {
    out = out.replace(re, replace);
  }
  out = out.replace(
    GENERIC_SECRET_RE,
    (_m, key: string, sep: string, quote: string) =>
      `${key}${sep}${quote}<REDACTED>${quote}`,
  );
  return out;
}

function extractPath(headerLine: string, bodyLines: string[]): string {
  for (const line of bodyLines) {
    if (line.startsWith("+++ b/")) return line.slice(6);
    if (line.startsWith("+++ ") && !line.startsWith("+++ /dev/null")) {
      return line.slice(4);
    }
  }
  for (const line of bodyLines) {
    if (line.startsWith("--- a/")) return line.slice(6);
    if (line.startsWith("--- ") && !line.startsWith("--- /dev/null")) {
      return line.slice(4);
    }
  }
  const match = /^diff --git a\/(.+?) b\/(.+)$/.exec(headerLine);
  if (match) return match[2]!;
  return UNKNOWN_PATH;
}

function splitIntoFileSections(raw: string): string[] {
  if (!raw) return [];
  const lines = raw.split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  for (const line of lines) {
    if (line.startsWith("diff --git ")) {
      if (current.length > 0) sections.push(current.join("\n"));
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) sections.push(current.join("\n"));
  return sections;
}

function parseFileSection(section: string): ParsedFile {
  const lines = section.split("\n");
  const headerLine = lines[0]!;
  const headerLines: string[] = [];
  const hunks: ParsedHunk[] = [];
  let isBinary = false;
  let i = 0;

  while (i < lines.length && !lines[i]!.startsWith("@@")) {
    const line = lines[i]!;
    if (
      line.startsWith("Binary files ") ||
      line.startsWith("GIT binary patch")
    ) {
      isBinary = true;
    }
    headerLines.push(stripPiiLine(line));
    i += 1;
  }

  while (i < lines.length) {
    const hunkHeader = lines[i]!;
    const hunkLines: string[] = [];
    i += 1;
    while (i < lines.length && !lines[i]!.startsWith("@@")) {
      hunkLines.push(stripPiiLine(lines[i]!));
      i += 1;
    }
    hunks.push({ header: stripPiiLine(hunkHeader), lines: hunkLines });
  }

  const path = extractPath(headerLine, headerLines);

  return {
    path,
    headerLines,
    hunks,
    omittedHunks: 0,
    isBinary,
    omitted: false,
  };
}

function renderFile(file: ParsedFile): string {
  if (file.omitted) return `[file omitted: ${file.path}]`;
  const parts: string[] = [];
  parts.push(file.headerLines.join("\n"));
  if (file.isBinary) return parts.join("\n");
  if (file.omittedHunks > 0) {
    const first = file.hunks[0]!;
    const last = file.hunks[file.hunks.length - 1]!;
    parts.push(first.header);
    if (first.lines.length > 0) parts.push(first.lines.join("\n"));
    parts.push(`[... ${file.omittedHunks} hunks omitted ...]`);
    parts.push(last.header);
    if (last.lines.length > 0) parts.push(last.lines.join("\n"));
  } else {
    for (const h of file.hunks) {
      parts.push(h.header);
      if (h.lines.length > 0) parts.push(h.lines.join("\n"));
    }
  }
  return parts.join("\n");
}

export function renderParsedDiff(parsed: ParsedDiff): string {
  return parsed.files.map(renderFile).join("\n");
}

function countTokens(text: string): number {
  return encode(text).length;
}

function fileTokens(file: ParsedFile): number {
  return countTokens(renderFile(file));
}

function dropMiddleHunks(files: ParsedFile[]): boolean {
  let changed = false;
  for (const file of files) {
    if (file.isBinary) continue;
    if (file.hunks.length > 2) {
      file.omittedHunks = file.hunks.length - 2;
      file.hunks = [file.hunks[0]!, file.hunks[file.hunks.length - 1]!];
      changed = true;
    }
  }
  return changed;
}

function dropSmallestFile(files: ParsedFile[]): void {
  const candidates = files.filter((f) => !f.omitted);
  let smallest = candidates[0]!;
  let smallestTokens = fileTokens(smallest);
  for (let i = 1; i < candidates.length; i += 1) {
    const c = candidates[i]!;
    const t = fileTokens(c);
    if (t < smallestTokens) {
      smallest = c;
      smallestTokens = t;
    }
  }
  smallest.omitted = true;
  smallest.hunks = [];
  smallest.headerLines = [];
}

function buildSummary(files: ParsedFile[]): string {
  return files
    .map((f) => (f.omitted ? `[file omitted: ${f.path}]` : f.path))
    .join("\n");
}

function renderFiles(files: ParsedFile[]): string {
  return files.map(renderFile).join("\n");
}

type TabAccumulator = {
  path: string;
  previousPath: string | null;
  oldPathFromMinus: string | null;
  newPathFromPlus: string | null;
  renameFrom: string | null;
  renameTo: string | null;
  isBinary: boolean;
  isNewFile: boolean;
  isDeletedFile: boolean;
  additions: number;
  deletions: number;
  rangeStart: number;
  rangeEnd: number;
};

function createAccumulator(
  headerLine: string,
  lineNumber: number,
): TabAccumulator {
  const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(headerLine);
  const defaultPath = m ? m[2]! : UNKNOWN_PATH;
  return {
    path: defaultPath,
    previousPath: null,
    oldPathFromMinus: null,
    newPathFromPlus: null,
    renameFrom: null,
    renameTo: null,
    isBinary: false,
    isNewFile: false,
    isDeletedFile: false,
    additions: 0,
    deletions: 0,
    rangeStart: lineNumber,
    rangeEnd: lineNumber,
  };
}

function finalizeTab(acc: TabAccumulator): DiffFileTab {
  const path = acc.renameTo ?? acc.newPathFromPlus ?? acc.path;
  let previousPath: string | null = null;
  if (acc.renameFrom && acc.renameTo && acc.renameFrom !== acc.renameTo) {
    previousPath = acc.renameFrom;
  } else if (
    acc.oldPathFromMinus &&
    acc.newPathFromPlus &&
    acc.oldPathFromMinus !== acc.newPathFromPlus
  ) {
    previousPath = acc.oldPathFromMinus;
  }

  let changeKind: DiffFileChangeKind;
  if (acc.isBinary) {
    changeKind = "binary";
  } else if (acc.renameFrom && acc.renameTo) {
    changeKind = "renamed";
  } else if (acc.isNewFile || acc.oldPathFromMinus === null) {
    changeKind = "added";
  } else if (acc.isDeletedFile || acc.newPathFromPlus === null) {
    changeKind = "deleted";
  } else {
    changeKind = "modified";
  }

  return {
    path,
    previousPath,
    changeKind,
    additions: acc.additions,
    deletions: acc.deletions,
    isBinary: acc.isBinary,
    rangeStart: acc.rangeStart,
    rangeEnd: acc.rangeEnd,
  };
}

export function parseDiffFileTabs(raw: string): DiffFileTab[] {
  if (!raw) return [];
  const lines = raw.split("\n");
  const tabs: DiffFileTab[] = [];
  let current: TabAccumulator | null = null;
  let inHunk = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const lineNo = i + 1;

    if (line.startsWith("diff --git ")) {
      if (current) tabs.push(finalizeTab(current));
      current = createAccumulator(line, lineNo);
      inHunk = false;
      continue;
    }

    if (!current) continue;

    current.rangeEnd = lineNo;

    if (line.startsWith("@@")) {
      inHunk = true;
      continue;
    }

    if (inHunk) {
      if (line.startsWith("+")) {
        current.additions += 1;
      } else if (line.startsWith("-")) {
        current.deletions += 1;
      }
      continue;
    }

    if (line.startsWith("new file mode")) current.isNewFile = true;
    else if (line.startsWith("deleted file mode")) current.isDeletedFile = true;
    else if (line.startsWith("rename from ")) {
      current.renameFrom = line.slice(12);
    } else if (line.startsWith("rename to ")) {
      current.renameTo = line.slice(10);
    } else if (
      line.startsWith("Binary files ") ||
      line.startsWith("GIT binary patch")
    ) {
      current.isBinary = true;
    } else if (line.startsWith("--- ")) {
      if (line === "--- /dev/null") current.oldPathFromMinus = null;
      else if (line.startsWith("--- a/")) current.oldPathFromMinus = line.slice(6);
      else current.oldPathFromMinus = line.slice(4);
    } else if (line.startsWith("+++ ")) {
      if (line === "+++ /dev/null") current.newPathFromPlus = null;
      else if (line.startsWith("+++ b/")) current.newPathFromPlus = line.slice(6);
      else current.newPathFromPlus = line.slice(4);
    }
  }

  if (current) tabs.push(finalizeTab(current));
  return tabs;
}

export function parseAllFiles(raw: string): ParsedFile[] {
  return splitIntoFileSections(raw).map(parseFileSection);
}

export function parseAndStripDiff(raw: string): ParsedDiff {
  const sections = splitIntoFileSections(raw);
  const files = sections.map(parseFileSection);

  let truncated = false;

  if (countTokens(renderFiles(files)) > DIFF_TOKEN_BUDGET) {
    if (dropMiddleHunks(files)) truncated = true;
  }

  while (
    countTokens(renderFiles(files)) > DIFF_TOKEN_BUDGET &&
    files.some((f) => !f.omitted)
  ) {
    dropSmallestFile(files);
    truncated = true;
  }

  return {
    files,
    summary: buildSummary(files),
    truncated,
  };
}
