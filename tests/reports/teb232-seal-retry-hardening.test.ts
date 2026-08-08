import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("TEB232 controlled sealing retry hardening", () => {
  const pipeline = source("functions/src/cbam/report/commercial-report-pipeline-v2.ts");
  const handler = source("functions/src/handlers/reports.ts");

  it("uses the exact controlled assessment clock for chronology and artifact assessment", () => {
    expect(pipeline).toContain("resolveControlledCaseAssessmentTimestamp");
    expect(pipeline).toContain("const assessmentTimestamp = resolveControlledCaseAssessmentTimestamp(");
    expect(pipeline).toContain("generatedAt: assessmentTimestamp");
    expect(pipeline).toContain("assessmentTimestamp,");
  });

  it("keeps premium package gate failures out of generic internal-error handling", () => {
    expect(handler).toContain('message.startsWith("PREMIUM_PACKAGE_")');
    expect(handler).toContain('new HttpsError("failed-precondition", message, details)');
  });
});
