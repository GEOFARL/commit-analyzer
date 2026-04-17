import type { ParsedCC } from "./cc-parser.js";

/** Minimal raw-commit fields the scorer may use in future criteria (e.g. diff size). */
export type RawCommit = {
  message: string;
  subject?: string | null;
  body?: string | null;
  footer?: string | null;
};

export type ScoreDetail = {
  component: string;
  weight: number;
  got: number;
};

export type Score = {
  isConventional: boolean;
  ccType?: string;
  ccScope?: string;
  subjectLength: number;
  hasBody: boolean;
  hasFooter: boolean;
  overallScore: number;
  details: ScoreDetail[];
};

const VALID_TYPES = new Set([
  "feat",
  "fix",
  "docs",
  "style",
  "refactor",
  "test",
  "chore",
  "build",
  "ci",
  "perf",
  "revert",
]);

function subjectLengthPoints(len: number): number {
  if (len === 0) return 0;
  if (len <= 50) return 20;
  if (len <= 72) return 15;
  return 5;
}

export function scoreCommit(parsed: ParsedCC, _commit?: RawCommit): Score {
  const isConventional = parsed.ok;

  const ccType = parsed.ok ? parsed.type : undefined;
  const ccScope = parsed.ok ? parsed.scope : undefined;
  const subject = parsed.ok ? parsed.subject : "";
  const hasBody = parsed.ok ? (parsed.body?.length ?? 0) > 0 : false;
  const hasFooter = parsed.ok ? (parsed.footer?.length ?? 0) > 0 : false;

  const subjectLength = subject.length;

  const details: ScoreDetail[] = [
    {
      component: "is_conventional",
      weight: 30,
      got: isConventional ? 30 : 0,
    },
    {
      component: "type_valid",
      weight: 10,
      got: ccType !== undefined && VALID_TYPES.has(ccType) ? 10 : 0,
    },
    {
      component: "scope_present",
      weight: 10,
      got: ccScope !== undefined && ccScope.length > 0 ? 10 : 0,
    },
    {
      component: "subject_length",
      weight: 20,
      got: subjectLengthPoints(subjectLength),
    },
    {
      component: "body_present",
      weight: 15,
      got: hasBody ? 15 : 0,
    },
    {
      component: "footer_present",
      weight: 15,
      got: hasFooter ? 15 : 0,
    },
  ];

  const overallScore = Math.min(
    100,
    Math.max(0, details.reduce((sum, d) => sum + d.got, 0)),
  );

  return {
    isConventional,
    ...(ccType !== undefined ? { ccType } : {}),
    ...(ccScope !== undefined ? { ccScope } : {}),
    subjectLength,
    hasBody,
    hasFooter,
    overallScore,
    details,
  };
}
