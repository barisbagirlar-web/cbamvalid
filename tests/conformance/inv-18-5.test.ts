import { describe, expect, it } from "vitest";
import { assertRollbackDryRun } from "../../scripts/seo/programmatic-factory";

describe("INV-18.5 rollback dry-run proof", () => {
  it("rejects incomplete rollback proof", () => {
    expect(() => assertRollbackDryRun({
      templateId:"cn-code-detail-v1", batchRoutes:["/cn-code/7208"], revertCommitAvailable:true,
      noindexFallbackAvailable:false, restoresPreBatchRouteSet:true,
    })).toThrow(/INV-18\.5/);
  });
});
