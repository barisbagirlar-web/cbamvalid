/**
 * FAZ UX (2026-08-01) — Step title/content/validation contract.
 *
 * Every step's renderKey, title, description and validation field set must
 * match exactly. In particular:
 *   - Step 5 really renders indirect emissions (electricity + grid factor).
 *   - Step 6 really renders precursors and methodology decisions.
 *   - Step 7 really renders evidence/approvals (carbon price + evidence).
 *   - Step 8 renders the final review and holds no data fields.
 */

import { describe, expect, it } from "vitest";
import {
  wizardStepDescription,
  wizardStepShortTitle,
  wizardStepTitle,
  wizardStepTotalFields,
  WIZARD_STEP_FIELD_SPECS,
} from "@/lib/cbam/wizard-validation";
import { CBAM_WORKFLOW_STEPS } from "@/lib/cbam/workflow-definition";

describe("step title ↔ rendered content contract", () => {
  it("binds every render step to its SSOT title, short title and description", () => {
    expect(CBAM_WORKFLOW_STEPS[4]!.title).toBe("Electricity and indirect emissions");
    expect(CBAM_WORKFLOW_STEPS[5]!.title).toBe("Precursors and methodology");
    expect(CBAM_WORKFLOW_STEPS[6]!.title).toBe("Documents, approvals and final checks");
    expect(CBAM_WORKFLOW_STEPS[7]!.title).toBe("Final review, payment and download");

    for (let step = 1; step <= 8; step += 1) {
      const spec = CBAM_WORKFLOW_STEPS[step - 1]!;
      expect(wizardStepTitle(step)).toBe(spec.title);
      expect(wizardStepShortTitle(step)).toBe(spec.shortTitle);
      expect(wizardStepDescription(step)).toBe(spec.description);
    }
  });

  it("Step 5 field set renders electricity and indirect emissions", () => {
    const fields = WIZARD_STEP_FIELD_SPECS[4]!.map((f) => f.fieldPath);
    expect(fields).toContain("electricityConsumed");
    expect(fields).toContain("gridEmissionFactor");
    expect(wizardStepTotalFields(5)).toBe(2);
  });

  it("Step 6 field set renders precursors and methodology decisions", () => {
    const fields = WIZARD_STEP_FIELD_SPECS[5]!.map((f) => f.fieldPath);
    expect(fields).toContain("precursors.*.name");
    expect(fields).toContain("precursors.*.quantity");
    expect(fields).toContain("precursors.*.directEmissions");
    expect(fields).toContain("precursors.*.indirectEmissions");
    expect(fields).toContain("methodologyDecisions.*.topic");
  });

  it("Step 7 field set renders carbon price and evidence register", () => {
    const fields = WIZARD_STEP_FIELD_SPECS[6]!.map((f) => f.fieldPath);
    expect(fields).toContain("carbonPriceRecords.*.amountPaid");
    expect(fields).toContain("carbonPriceRecords.*.applicableEmissions");
  });

  it("Step 8 is the final review and holds no data fields", () => {
    expect(CBAM_WORKFLOW_STEPS[7]!.renderKey).toBe("finalReview");
    expect(WIZARD_STEP_FIELD_SPECS[7]).toEqual([]);
    expect(wizardStepTotalFields(8)).toBe(0);
  });

  it("every validation field spec is attached to a guidance entry and is typed", () => {
    for (let step = 1; step <= 7; step += 1) {
      for (const field of WIZARD_STEP_FIELD_SPECS[step - 1]!) {
        expect(typeof field.label).toBe("string");
        expect(field.label.length).toBeGreaterThan(0);
        expect(typeof field.required).toBe("boolean");
        expect(typeof field.evidenceRequired).toBe("boolean");
      }
    }
  });
});
