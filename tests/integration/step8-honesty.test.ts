/**
 * FAZ UX (2026-08-01) — Step 8 honesty.
 *
 * The package must never claim success before a real sealed release exists:
 *   - pre-seal headline is "What your locked package will include";
 *   - "Locked package created successfully" only after reportId/SEALED;
 *   - exactly one "Review remaining actions" CTA on the step body;
 *   - raw SHA / calculation trace stays hidden behind a closed accordion.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  STEP8_PACKAGE_PREVIEW_HEADLINE,
  STEP8_REVIEW_ACTIONS_LABEL,
  STEP8_SEALED_SUCCESS_HEADLINE,
} from "@/lib/cbam/wizard-validation";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("step 8 honesty", () => {
  it("PRESEAL_SUCCESS_CLAIM=0: no success claim is rendered before a seal", () => {
    // The pre-seal headline is explicitly a package preview, not a result.
    expect(STEP8_PACKAGE_PREVIEW_HEADLINE).toBe("What your locked package will include");
    expect(STEP8_PACKAGE_PREVIEW_HEADLINE).not.toContain(STEP8_SEALED_SUCCESS_HEADLINE);
    expect(STEP8_SEALED_SUCCESS_HEADLINE).toBe("Locked package created successfully");
  });

  it("the client emits the success headline only in the post-seal handler", () => {
    const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
    // The client references the SSOT constant exactly once — in the sealing
    // success path after the SEALED_REPORT_ID_MISSING gate — never in the
    // package preview.
    expect(client.split("setSealStatus(STEP8_SEALED_SUCCESS_HEADLINE)").length - 1).toBe(1);
    const gateIndex = client.indexOf("SEALED_REPORT_ID_MISSING");
    const successIndex = client.indexOf("setSealStatus(STEP8_SEALED_SUCCESS_HEADLINE)");
    expect(gateIndex).toBeGreaterThanOrEqual(0);
    expect(successIndex).toBeGreaterThan(gateIndex);
    // The literal success claim exists only in the SSOT file.
    const ssot = readSource("lib/cbam/wizard-validation.ts");
    expect(ssot.split(STEP8_SEALED_SUCCESS_HEADLINE).length - 1).toBe(1);
  });

  it("DUPLICATE_REVIEW_CTA=0: exactly one 'Review remaining actions' CTA on the body", () => {
    const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
    // The JSX usage appears exactly once; the second identifier match is the
    // import statement.
    expect(client.split("{STEP8_REVIEW_ACTIONS_LABEL}").length - 1).toBe(1);
    // The literal phrase lives only in the SSOT definition file.
    const ssot = readSource("lib/cbam/wizard-validation.ts");
    expect(ssot.split(STEP8_REVIEW_ACTIONS_LABEL).length - 1).toBe(1);
    expect(STEP8_REVIEW_ACTIONS_LABEL).toBe("Review remaining actions");
  });

  it("RAW_TECHNICAL_NOISE_DEFAULT_VISIBLE=0: SHA/trace is hidden behind a closed accordion", () => {
    const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
    // The advanced details block is gated by showAdvancedDetails (default false).
    expect(client).toContain("const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);");
    expect(client).toContain("Advanced calculation and integrity details");
    expect(client).toContain("aria-expanded={showAdvancedDetails}");
  });

  it("preview count matches the canonical 25 verifier-file contract", () => {
    const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
    expect(client).toContain("25 package components");
    expect(client).toContain("25-part verifier package");
    expect(client).not.toContain("26 package components");
    expect(client).not.toContain("26-part verifier package");
  });
});
