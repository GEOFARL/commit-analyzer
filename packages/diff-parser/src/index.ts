import { encode } from "gpt-tokenizer";

export {
  validateUnifiedDiff,
  type DiffStats,
  type DiffValidationIssue,
  type DiffValidationIssueCode,
  type DiffValidationResult,
} from "./validate.js";

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
