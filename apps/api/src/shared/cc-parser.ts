export type ParsedCC =
  | {
      ok: true;
      type: string;
      scope?: string;
      subject: string;
      body?: string;
      footer?: string;
      isBreaking: boolean;
    }
  | { ok: false; reason: "no-type" | "malformed-header" | "empty" };

// Per spec §1: type is lowercase letters only
const HEADER_RE =
  /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<bang>!)?: (?<subject>.+)$/u;

// Footer token per CC spec 1.0: "token: value" or "token #value"
// BREAKING CHANGE (space) and BREAKING-CHANGE (hyphen) are both allowed by CC 1.0
const FOOTER_TOKEN_RE = /^(?:BREAKING[- ]CHANGE|[\w-]+)(?: #|: ).+/u;

type State = "body" | "blank_in_body" | "footer";

export function parseConventionalCommit(message: string): ParsedCC {
  if (!message || !message.trim()) return { ok: false, reason: "empty" };

  const lines = message.split("\n");
  const headerLine = lines[0] ?? "";

  // No colon → cannot identify a type
  if (!headerLine.includes(":")) return { ok: false, reason: "no-type" };

  const match = HEADER_RE.exec(headerLine);
  if (!match?.groups) return { ok: false, reason: "malformed-header" };

  const { type, scope, bang, subject } = match.groups as {
    type: string;
    scope?: string;
    bang?: string;
    subject: string;
  };

  if (!subject.trim()) return { ok: false, reason: "malformed-header" };

  // No more lines — simple one-liner
  if (lines.length === 1) {
    return {
      ok: true,
      type,
      ...(scope !== undefined ? { scope } : {}),
      subject,
      isBreaking: bang === "!",
    };
  }

  // Line 1 (index 1) must be blank when body/footer follows
  if (lines[1] !== "") return { ok: false, reason: "malformed-header" };

  const bodyLines: string[] = [];
  const footerLines: string[] = [];
  let state: State = "body";

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i]!;

    if (state === "body") {
      if (line === "") {
        state = "blank_in_body";
      } else {
        bodyLines.push(line);
      }
    } else if (state === "blank_in_body") {
      if (FOOTER_TOKEN_RE.test(line)) {
        state = "footer";
        footerLines.push(line);
      } else {
        // blank line was a paragraph separator within the body
        bodyLines.push("", line);
        state = "body";
      }
    } else {
      // footer — collect all remaining lines
      footerLines.push(line);
    }
  }

  const body = bodyLines.length > 0 ? bodyLines.join("\n") : undefined;
  const footer = footerLines.length > 0 ? footerLines.join("\n") : undefined;

  // BREAKING CHANGE footer token also marks the commit as breaking (CC 1.0 §16-17)
  const breakingFromFooter = footerLines.some((l) =>
    /^BREAKING[- ]CHANGE(: | #)/u.test(l),
  );

  return {
    ok: true,
    type,
    ...(scope !== undefined ? { scope } : {}),
    subject,
    ...(body !== undefined ? { body } : {}),
    ...(footer !== undefined ? { footer } : {}),
    isBreaking: bang === "!" || breakingFromFooter,
  };
}
