import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema as BrowserCaseSchema, createEmptyInput } from "@/lib/cbam/schema";
import { createNewCaseDraft } from "@/lib/cbam/new-case";
import { createCaseSaveRequest } from "@/lib/functions/case-save-contract";
import { performDossierCalculations } from "@/lib/cbam/calculator";
import { AuditReadyCaseSchema as FunctionsCaseSchema } from "../../functions/src/cbam/schema";
import { buildCaseRecord, toCaseWorkspaceView } from "../../functions/src/cbam/storage/case-contract";

const OWNER_ID = "user_case_contract_123";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const TIMESTAMP = "2026-07-15T12:00:00.000Z";

function validDraft() {
  return createNewCaseDraft(OWNER_ID, { eventId: EVENT_ID, timestamp: TIMESTAMP });
}

describe("new case runtime contract", () => {
  it("produces one payload accepted by browser and Functions schemas", () => {
    const draft = validDraft();
    expect(BrowserCaseSchema.parse(draft)).toEqual(draft);
    expect(FunctionsCaseSchema.parse(draft).ownerId).toBe(OWNER_ID);
  });

  it("uses the same canonical identifier for the record, document and workspace", () => {
    const record = buildCaseRecord({
      rawDocumentId: "FirestoreAutoId123",
      uid: OWNER_ID,
      data: validDraft(),
      timestamp: TIMESTAMP,
    });
    const workspace = toCaseWorkspaceView(record);

    expect(record.caseId).toBe("case_FirestoreAutoId123");
    expect(record.data.caseId).toBe(record.caseId);
    expect(workspace.caseId).toBe(record.caseId);
    expect(workspace.ownerId).toBe(OWNER_ID);
    expect(workspace.goods).toEqual([]);
    expect("data" in workspace).toBe(false);
  });

  it("requires one stable requestId for creation and no requestId for edits", () => {
    const draft = validDraft();
    const createRequest = createCaseSaveRequest(draft, undefined, REQUEST_ID);
    expect(createRequest).toEqual({ data: draft, requestId: REQUEST_ID });
    expect(Object.prototype.hasOwnProperty.call(createRequest, "caseId")).toBe(false);
    expect(createCaseSaveRequest(draft, undefined, REQUEST_ID)).toEqual(createRequest);

    expect(() => createCaseSaveRequest(draft)).toThrow("CASE_CREATION_REQUEST_ID_REQUIRED");

    const editRequest = createCaseSaveRequest(
      { ...draft, caseId: "case_FirestoreAutoId123" },
      "case_FirestoreAutoId123"
    );
    expect(editRequest).toEqual({
      caseId: "case_FirestoreAutoId123",
      data: { ...draft, caseId: "case_FirestoreAutoId123" },
    });
    expect(() =>
      createCaseSaveRequest(draft, "case_FirestoreAutoId123", REQUEST_ID)
    ).toThrow("AMBIGUOUS_CASE_SAVE_REQUEST");
  });
});

describe("new case calculation safety", () => {
  it("does not divide by zero or throw for a blank draft", () => {
    expect(() => performDossierCalculations(validDraft())).not.toThrow();
    expect(performDossierCalculations(validDraft()).totalEmbeddedEmissions).toBe("NOT_CALCULATED");
  });

  it("matches the closed-form emissions identity and is monotonic", () => {
    const base = validDraft();
    base.goods = [{
      cnCode: { ...createEmptyInput(), value: "72081000" },
      sector: "IRON_AND_STEEL",
      productionVolume: { ...createEmptyInput("t"), value: "100" },
      shipmentRecords: { ...createEmptyInput("t"), value: "100" },
    }];
    base.directEmissions = { ...createEmptyInput("tCO2e"), value: "10" };
    base.electricityConsumed = { ...createEmptyInput("MWh"), value: "20" };
    base.gridEmissionFactor = { ...createEmptyInput("tCO2e/MWh"), value: "0.5" };

    const baseResult = performDossierCalculations(base);
    expect(baseResult.totalEmbeddedEmissions).toBe("0.2");

    const increased = structuredClone(base);
    increased.directEmissions.value = "20";
    const increasedResult = performDossierCalculations(increased);
    expect(increasedResult.totalEmbeddedEmissions).toBe("0.3");
    expect(Number(increasedResult.totalEmbeddedEmissions)).toBeGreaterThan(
      Number(baseResult.totalEmbeddedEmissions)
    );
  });

  it("fails closed for zero production volume without Infinity or NaN", () => {
    const draft = validDraft();
    draft.goods = [{
      cnCode: { ...createEmptyInput(), value: "72081000" },
      sector: "IRON_AND_STEEL",
      productionVolume: { ...createEmptyInput("t"), value: "0" },
      shipmentRecords: { ...createEmptyInput("t"), value: "0" },
    }];
    draft.directEmissions = { ...createEmptyInput("tCO2e"), value: "10" };
    draft.electricityConsumed = { ...createEmptyInput("MWh"), value: "0" };
    draft.gridEmissionFactor = { ...createEmptyInput("tCO2e/MWh"), value: "0" };

    const result = performDossierCalculations(draft);
    expect(result.totalEmbeddedEmissions).toBe("NOT_CALCULATED");
    expect(result.totalEmbeddedEmissions).not.toMatch(/Infinity|NaN/);
  });
});
