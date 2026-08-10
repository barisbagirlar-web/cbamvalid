import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const PROHIBITED_ACTIONS = [
  /git\s+push\s+--force(?:-with-lease)?\s+(?:origin\s+)?main/i,
  /gh\s+pr\s+merge\b[^\n]*--auto/i,
  /firebase\s+(?:projects|hosting:sites):delete/i,
  /gcloud\s+projects\s+delete/i,
  /rm\s+-rf\s+\//i,
  /firebase\s+deploy\b[^\n]*(?:pull\/|refs\/pull|PR_HEAD)/i,
  /(?:redirectMode|redirect_mode)\s*[:=]\s*["']auto(?:matic)?[_-]?301["']/i,
  /(?:publishMode|publish_mode)\s*[:=]\s*["']auto(?:matic)?["']/i,
  /(?:bulkStatus|bulk_status)\s*[:=]\s*410\b/i,
  /(?:hstsPreload|hsts_preload)\s*[:=]\s*true\b/i,
  /(?:linkAcquisition|link_acquisition)\s*[:=]\s*["']paid["']/i,
  /(?:pbn|privateBlogNetwork)\s*[:=]\s*true\b/i,
  /(?:crossSiteLinkScheme|cross_site_link_scheme)\s*[:=]\s*true\b/i,
  /(?:lastmodSource|lastmod_source)\s*[:=]\s*["']fake["']/i,
  /(?:schemaClaimVisibility|schema_claim_visibility)\s*[:=]\s*["']hidden["']/i,
  /(?:faqSource|faq_source)\s*[:=]\s*["']fabricated["']/i,
  /(?:rankingGuarantee|ranking_guarantee)\s*[:=]\s*true\b/i,
] as const;

function scan(text: string): string[] {
  return PROHIBITED_ACTIONS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function changedExecutableDiff(): string {
  try {
    return execFileSync(
      "git",
      [
        "diff",
        "--unified=0",
        "origin/main...HEAD",
        "--",
        ".",
        ":(exclude)docs/**",
        ":(exclude)tests/**",
        ":(exclude)data/seo/invariant-results/**",
      ],
      { encoding: "utf8" },
    );
  } catch {
    return "";
  }
}

describe("INV-10.2 prohibited action scan", () => {
  it("finds no prohibited executable shortcut in the PR candidate", () => {
    expect(scan(changedExecutableDiff())).toEqual([]);
  });

  it.each([
    "git push --force origin main",
    "gh pr merge 999 --auto --squash",
    'redirectMode: "automatic_301"',
    'publishMode: "automatic"',
    "bulkStatus: 410",
    "hstsPreload: true",
    'linkAcquisition: "paid"',
    "pbn: true",
    "crossSiteLinkScheme: true",
    'lastmodSource: "fake"',
    'schemaClaimVisibility: "hidden"',
    'faqSource: "fabricated"',
    "rankingGuarantee: true",
  ])("rejects prohibited synthetic action: %s", (fixture) => {
    expect(scan(fixture)).not.toEqual([]);
  });
});