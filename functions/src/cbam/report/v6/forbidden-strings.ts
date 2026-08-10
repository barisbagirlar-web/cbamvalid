/**
 * G-09 / INV-13 — forbidden-string leak scan. D-08.
 *
 * A sealed package must never contain test/demo artifacts. The banned list is
 * case-insensitive and applies to every file type. `controlled test` and
 * `test evidence` (the D-08 leak) are matched as substrings; short ambiguous
 * tokens use whole-word boundaries so legitimate vocabulary is not flagged.
 */
export const FORBIDDEN_STRING_PATTERNS: ReadonlyArray<{ pattern: RegExp; literal: string }> = [
  { literal: "controlled test", pattern: /\bcontrolled test\b/i },
  { literal: "test evidence", pattern: /\btest evidence\b/i },
  { literal: "demo", pattern: /\bdemo\b/i },
  { literal: "sample data", pattern: /\bsample data\b/i },
  { literal: "lorem", pattern: /\blorem\b/i },
  { literal: "foo", pattern: /\bfoo\b/i },
  { literal: "bar", pattern: /\bbar\b/i },
  { literal: "example.com", pattern: /example\.com/i },
  { literal: "TODO", pattern: /\bTODO\b/ },
  { literal: "TBD", pattern: /\bTBD\b/ },
  { literal: "FIXME", pattern: /\bFIXME\b/ },
  { literal: "XXX", pattern: /\bXXX\b/ },
  { literal: "dummy", pattern: /\bdummy\b/i },
  { literal: "placeholder", pattern: /\bplaceholder\b/i },
];

export function scanForbiddenStrings(text: string): string[] {
  const matches: string[] = [];
  for (const entry of FORBIDDEN_STRING_PATTERNS) {
    if (entry.pattern.test(text)) matches.push(entry.literal);
  }
  return matches;
}

export function scanComponentsForbiddenStrings(
  components: ReadonlyArray<{ path: string; text: string }>
): Array<{ path: string; hits: string[] }> {
  return components
    .map((component) => ({ path: component.path, hits: scanForbiddenStrings(component.text) }))
    .filter((entry) => entry.hits.length > 0);
}
