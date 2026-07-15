import { describe, expect, it } from "vitest";
import type { AuditReadyCase } from "@/lib/cbam/schema";
import { buildSaveCasePayload } from "@/lib/functions/save-case-payload";

const draft = { status: "DRAFT" } as AuditReadyCase;

describe("buildSaveCasePayload", () => {
  it("omits caseId completely for a new case", () => {
    const payload = buildSaveCasePayload(draft);

    expect(payload).toEqual({ data: draft });
    expect(Object.prototype.hasOwnProperty.call(payload, "caseId")).toBe(false);
  });

  it("includes a normalized caseId for an existing draft", () => {
    expect(buildSaveCasePayload(draft, "  case_123  ")).toEqual({
      caseId: "case_123",
      data: draft,
    });
  });

  it("does not serialize an empty caseId", () => {
    const payload = buildSaveCasePayload(draft, "   ");
    expect(Object.prototype.hasOwnProperty.call(payload, "caseId")).toBe(false);
  });
});
