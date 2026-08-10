import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PROHIBITED_ACTIONS = [
  /git\s+push\s+--force(?:-with-lease)?\s+(?:origin\s+)?main/i,
  /gh\s+pr\s+merge\b[^\n]*--auto/i,
  /firebase\s+(?:projects|hosting:sites):delete/i,
  /gcloud\s+projects\s+delete/i,
  /rm\s+-rf\s+\//i,
  /firebase\s+deploy\b[^\n]*(?:pull\/|refs\/pull|PR_HEAD)/i,
] as const;

function scan(text: string): string[] {
  return PROHIBITED_ACTIONS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

describe("INV-10.2 prohibited action scan", () => {
  it("finds no executable destructive shortcut in governed runbooks", () => {
    const dir = resolve(process.cwd(), "docs/seo/runbooks");
    const findings = readdirSync(dir)
      .filter((name) => name.endsWith(".md"))
      .flatMap((name) => scan(readFileSync(resolve(dir, name), "utf8")).map((match) => `${name}:${match}`));
    expect(findings).toEqual([]);
  });

  it("detects a synthetic force-push shortcut", () => {
    expect(scan("git push --force origin main")).not.toEqual([]);
  });

  it("detects a synthetic auto-merge shortcut", () => {
    expect(scan("gh pr merge 999 --auto --squash")).not.toEqual([]);
  });
});