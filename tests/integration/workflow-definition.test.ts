/**
 * FAZ UX (2026-08-01) — Workflow SSOT contract.
 *
 * The guided workflow must have exactly one step definition
 * (`lib/cbam/workflow-definition.ts`). Every consumer derives from it:
 * step navigation, footer, progress summary, validation registry, renderStep
 * matching, blocker remediation links, mobile step menu, E2E tests and
 * accessibility labels. No duplicate step array may exist anywhere else.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CBAM_WORKFLOW_STEPS } from "@/lib/cbam/workflow-definition";
import {
  wizardStepDescription,
  wizardStepShortTitle,
  wizardStepTitle,
  WIZARD_STEP_RENDER_KEYS,
  WIZARD_STEP_FIELD_SPECS,
} from "@/lib/cbam/wizard-validation";
import { WORKFLOW_STEPS_PLAIN } from "@/lib/product/customer-language";

const readSource = (relative: string): string =>
  readFileSync(path.join(process.cwd(), relative), "utf8");

describe("single workflow SSOT", () => {
  it("defines exactly eight sequential steps with unique keys and render keys", () => {
    expect(CBAM_WORKFLOW_STEPS).toHaveLength(8);
    expect(CBAM_WORKFLOW_STEPS.map((s) => s.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(CBAM_WORKFLOW_STEPS.map((s) => s.key)).size).toBe(8);
    expect(new Set(CBAM_WORKFLOW_STEPS.map((s) => s.renderKey)).size).toBe(8);
  });

  it("proves WORKFLOW_SSOT_COUNT=1: no duplicate step list exists in the app source", () => {
    // 1. The wizard client must not carry its own STEPS array.
    const client = readSource("app/(workspace)/cases/[caseId]/CaseWizardClient.tsx");
    expect(client).not.toContain("const STEPS");
    expect(client).not.toContain("const WORKFLOW_STEPS");

    // 2. The legacy WIZARD_STEP_HEADERS duplicate was removed.
    const wizardValidation = readSource("lib/cbam/wizard-validation.ts");
    expect(wizardValidation).not.toContain("WIZARD_STEP_HEADERS");

    // 3. No SSOT title string is re-hardcoded as a literal in the wizard
    //    client (they come from wizardStepTitle()/wizardStepShortTitle()).
    //    Two short titles ("Direct emissions", "Indirect emissions") also
    //    legitimately appear as field/metric labels inside the forms, so the
    //    step heading must be rendered from the SSOT rather than re-listed.
    const labelCollisions = new Set(["Direct emissions", "Indirect emissions"]);
    for (const step of CBAM_WORKFLOW_STEPS) {
      if (labelCollisions.has(step.title) || labelCollisions.has(step.shortTitle)) continue;
      expect(client).not.toContain(`"${step.title}"`);
      expect(client).not.toContain(`'${step.title}'`);
      expect(client).not.toContain(`"${step.shortTitle}"`);
      expect(client).not.toContain(`'${step.shortTitle}'`);
    }

    // 4. The plain-language marketing list is derived, not duplicated.
    const customerLanguage = readSource("lib/product/customer-language.ts");
    expect(customerLanguage).toContain("CBAM_WORKFLOW_STEPS");
    expect(customerLanguage).not.toContain("Company & period");
  });

  it("derives the plain-language list from the SSOT", () => {
    expect(WORKFLOW_STEPS_PLAIN).toHaveLength(CBAM_WORKFLOW_STEPS.length);
    for (let index = 0; index < CBAM_WORKFLOW_STEPS.length; index += 1) {
      expect(WORKFLOW_STEPS_PLAIN[index]?.num).toBe(index + 1);
      expect(WORKFLOW_STEPS_PLAIN[index]?.title).toBe(CBAM_WORKFLOW_STEPS[index]!.title);
      expect(WORKFLOW_STEPS_PLAIN[index]?.desc).toBe(CBAM_WORKFLOW_STEPS[index]!.description);
    }
  });

  it("derives render keys, titles, short titles and descriptions from the SSOT", () => {
    for (let step = 1; step <= CBAM_WORKFLOW_STEPS.length; step += 1) {
      const source = CBAM_WORKFLOW_STEPS[step - 1]!;
      expect(wizardStepTitle(step)).toBe(source.title);
      expect(wizardStepShortTitle(step)).toBe(source.shortTitle);
      expect(wizardStepDescription(step)).toBe(source.description);
      expect(WIZARD_STEP_RENDER_KEYS[step - 1]).toBe(source.renderKey);
    }
  });

  it("aligns the validation registry with the SSOT", () => {
    expect(WIZARD_STEP_FIELD_SPECS).toHaveLength(CBAM_WORKFLOW_STEPS.length);
    // Step 8 holds no data fields and therefore can never be auto-COMPLETE.
    expect(WIZARD_STEP_FIELD_SPECS[7]).toEqual([]);
  });
});
