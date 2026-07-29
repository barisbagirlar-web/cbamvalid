import { describe, expect, it } from "vitest";
import { resolveJourneyState } from "@/lib/product/journey-state";

describe("customer journey state machine", () => {
  it("A: no file, no pack → create working file", () => {
    const view = resolveJourneyState({
      workingFileCount: 0,
      lockedPackageCount: 0,
      releasesRemaining: 0,
      availableCredits: 0,
    });
    expect(view.state).toBe("NO_FILE");
    expect(view.primaryCta.href).toBe("/cases/new");
  });

  it("B: no file, unlockable pack balance → activate first", () => {
    const view = resolveJourneyState({
      workingFileCount: 0,
      lockedPackageCount: 0,
      releasesRemaining: 0,
      availableCredits: 100,
    });
    expect(view.state).toBe("PACK_READY_TO_ACTIVATE");
    expect(view.primaryCta.href).toBe("/account");
  });

  it("C: unpaid file → continue the work before case-scoped payment", () => {
    const view = resolveJourneyState({
      workingFileCount: 1,
      lockedPackageCount: 0,
      releasesRemaining: 0,
      availableCredits: 0,
      primaryWorkingFileId: "case_1",
    });
    expect(view.state).toBe("READY_NO_PACK");
    expect(view.primaryCta.href).toBe("/cases/case_1");
    expect(view.secondaryCta?.href).toBe("/credits/buy?caseId=case_1");
  });

  it("D: file + releases, never locked → ready to seal / continue", () => {
    const view = resolveJourneyState({
      workingFileCount: 1,
      lockedPackageCount: 0,
      releasesRemaining: 5,
      availableCredits: 0,
      primaryWorkingFileId: "case_1",
    });
    expect(view.state).toBe("READY_TO_SEAL");
    expect(view.primaryCta.href).toBe("/cases/case_1");
  });

  it("E: locked + releases left → correction path", () => {
    const view = resolveJourneyState({
      workingFileCount: 1,
      lockedPackageCount: 2,
      releasesRemaining: 3,
      availableCredits: 0,
      primaryWorkingFileId: "case_1",
    });
    expect(view.state).toBe("SEALED_WITH_RELEASES");
  });

  it("F: locked + unpaid remaining slots → continue the file before payment", () => {
    const view = resolveJourneyState({
      workingFileCount: 1,
      lockedPackageCount: 5,
      releasesRemaining: 0,
      availableCredits: 0,
      primaryWorkingFileId: "case_1",
    });
    expect(view.state).toBe("SEALED_NO_RELEASES");
    expect(view.primaryCta.href).toBe("/cases/case_1");
    expect(view.secondaryCta?.href).toBe("/credits/buy?caseId=case_1");
  });

  it("G: locked + unlockable balance → activate", () => {
    const view = resolveJourneyState({
      workingFileCount: 1,
      lockedPackageCount: 5,
      releasesRemaining: 0,
      availableCredits: 200,
      primaryWorkingFileId: "case_1",
    });
    expect(view.state).toBe("PACK_READY_TO_ACTIVATE");
  });

  it("post-purchase with file prioritizes continue, not buy", () => {
    const view = resolveJourneyState({
      workingFileCount: 1,
      lockedPackageCount: 0,
      releasesRemaining: 5,
      availableCredits: 0,
      primaryWorkingFileId: "case_1",
      postPurchase: true,
    });
    expect(view.state).toBe("READY_TO_SEAL");
    expect(view.headline.toLowerCase()).toContain("payment confirmed");
    expect(view.primaryCta.href).toBe("/cases/case_1");
  });

  it("H: file + releases + blockers → BLOCKERS_OPEN", () => {
    const view = resolveJourneyState({
      workingFileCount: 1,
      lockedPackageCount: 0,
      releasesRemaining: 5,
      availableCredits: 0,
      primaryWorkingFileId: "case_1",
      blockersOpen: 3,
    });
    expect(view.state).toBe("BLOCKERS_OPEN");
    expect(view.primaryCta.href).toBe("/cases/case_1");
  });
});
