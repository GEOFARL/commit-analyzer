export interface ConventionalCommit {
  type: string;
  scope?: string;
  subject: string;
  body?: string;
  footer?: string;
  breaking: boolean;
  valid: boolean;
}

const INVALID: ConventionalCommit = {
  type: "",
  subject: "",
  breaking: false,
  valid: false,
};

// Matches: type[(scope)][!]: subject
const HEADER_RE =
  /^(?<type>[a-z][a-z0-9-]*)(?:\((?<scope>[^)]+)\))?(?<bang>!)?: (?<subject>.+)$/u;

// Footer token per CC spec: "word-token: value" or "word-token #value"
// BREAKING CHANGE (with space) is the only multi-word token allowed
const FOOTER_TOKEN_RE = /^(?:BREAKING[- ]CHANGE|[\w-]+)(?: #|: ).+/u;

type State = "body" | "blank_in_body" | "footer";

export function parseConventionalCommit(message: string): ConventionalCommit {
  if (!message || !message.trim()) return { ...INVALID };

  const lines = message.split("\n");
  const headerLine = lines[0] ?? "";

  const match = HEADER_RE.exec(headerLine);
  if (!match?.groups) return { ...INVALID };

  const { type, scope, bang, subject } = match.groups as {
    type: string;
    scope?: string;
    bang?: string;
    subject: string;
  };

  if (!subject.trim()) return { ...INVALID };

  // No more lines — simple one-liner
  if (lines.length === 1) {
    return {
      type,
      ...(scope !== undefined ? { scope } : {}),
      subject,
      breaking: bang === "!",
      valid: true,
    };
  }

  // Line 1 (index 1) must be blank when body/footer follows
  if (lines[1] !== "") return { ...INVALID };

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

  // A BREAKING CHANGE footer token also marks the commit as breaking
  const breakingFromFooter = footerLines.some((l) =>
    /^BREAKING[- ]CHANGE(: | #)/u.test(l),
  );

  return {
    type,
    ...(scope !== undefined ? { scope } : {}),
    subject,
    ...(body !== undefined ? { body } : {}),
    ...(footer !== undefined ? { footer } : {}),
    breaking: bang === "!" || breakingFromFooter,
    valid: true,
  };
}
