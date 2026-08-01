import { describe, expect, it } from "vitest";
import { CBAM_WORKFLOW_STEPS } from "@/lib/cbam/workflow-definition";
import { WORKFLOW_STEPS_PLAIN } from "@/lib/product/customer-language";

describe("working-file plain steps contract", () => {
  it("derives exactly eight plain-language steps from the single workflow SSOT", () => {
    expect(WORKFLOW_STEPS_PLAIN).toHaveLength(8);
    expect(WORKFLOW_STEPS_PLAIN[0]?.title).toBe(CBAM_WORKFLOW_STEPS[0].title);
    expect(WORKFLOW_STEPS_PLAIN[7]?.title).toBe(CBAM_WORKFLOW_STEPS[7].title);
    expect(WORKFLOW_STEPS_PLAIN.every((step, index) => step.num === index + 1)).toBe(true);
    expect(WORKFLOW_STEPS_PLAIN.every((step, index) => step.title === CBAM_WORKFLOW_STEPS[index].title)).toBe(true);
    expect(WORKFLOW_STEPS_PLAIN.every((step, index) => step.desc === CBAM_WORKFLOW_STEPS[index].description)).toBe(true);
  });
});
