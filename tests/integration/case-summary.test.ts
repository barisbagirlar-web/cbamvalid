import { describe, expect, it } from "vitest";
import { createBlankCaseDraft, createNewCaseDraft } from "@/lib/cbam/new-case";
import {
  formatCaseUpdatedDate,
  getCaseDisplayName,
  getPrimaryCnCode,
} from "@/lib/cbam/case-summary";
import { createEmptyInput } from "@/lib/cbam/schema";

const OWNER_ID = "case_summary_user";
const EVENT_ID = "77777777-7777-4777-8777-777777777777";
const TIMESTAMP = "2026-07-15T15:00:00.000Z";

function draft() {
  return createNewCaseDraft(OWNER_ID, { eventId: EVENT_ID, timestamp: TIMESTAMP });
}

describe("case summary projection", () => {
  it("returns explicit fallbacks for a blank draft", () => {
    const caseData = createBlankCaseDraft(OWNER_ID, { eventId: EVENT_ID, timestamp: TIMESTAMP });
    expect(getCaseDisplayName(caseData)).toBe("Unnamed Installation");
    expect(getPrimaryCnCode(caseData)).toBe("Pending");
  });

  it("reads the canonical nested installation and goods paths", () => {
    const caseData = draft();
    caseData.installation.name.value = "  Stuttgart Steel Works  ";
    caseData.goods = [
      {
        cnCode: { ...createEmptyInput(), value: "72081000" },
        sector: "IRON_AND_STEEL",
        productionVolume: { ...createEmptyInput("t"), value: "100" },
        shipmentRecords: { ...createEmptyInput("t"), value: "100" },
      },
    ];

    expect(getCaseDisplayName(caseData)).toBe("Stuttgart Steel Works");
    expect(getPrimaryCnCode(caseData)).toBe("72081000");
  });

  it("does not render whitespace, NaN, or invalid dates as business data", () => {
    const caseData = createBlankCaseDraft(OWNER_ID, { eventId: EVENT_ID, timestamp: TIMESTAMP });
    caseData.installation.name.value = "   ";
    caseData.goods = [
      {
        cnCode: { ...createEmptyInput(), value: Number.NaN },
        sector: "GENERAL",
        productionVolume: createEmptyInput("t"),
        shipmentRecords: createEmptyInput("t"),
      },
    ];

    expect(getCaseDisplayName(caseData)).toBe("Unnamed Installation");
    expect(getPrimaryCnCode(caseData)).toBe("Pending");
    expect(formatCaseUpdatedDate("not-a-date")).toBe("Unknown");
  });

  it("formats valid timestamps without returning an invalid-date marker", () => {
    const formatted = formatCaseUpdatedDate("2026-07-15T15:00:00.000Z");
    expect(formatted).not.toBe("Unknown");
    expect(formatted).not.toMatch(/Invalid/i);
  });
});
