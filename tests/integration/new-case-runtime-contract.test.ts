import { describe, expect, it } from "vitest";
import { AuditReadyCaseSchema as BrowserCaseSchema, createEmptyInput } from "@/lib/cbam/schema";
import {
  createBlankCaseDraft,
  createNewCaseDraft,
  isIllustrativeScenarioActive,
  replaceIllustrativeScenarioWithBlank,
} from "@/lib/cbam/new-case";
import { createCaseSaveRequest } from "@/lib/functions/case-save-contract";
import { performDossierCalculations } from "@/lib/cbam/calculator";
import { runQualityControls as runBrowserQualityControls } from "@/lib/cbam/validation/quality-controls";
import { AuditReadyCaseSchema as FunctionsCaseSchema } from "../../functions/src/cbam/schema";
import { runQualityControls as runServerQualityControls } from "../../functions/src/cbam/validation/quality-controls";
import { buildCaseRecord, toCaseWorkspaceView } from "../../functions/src/cbam/storage/case-contract";
import {
  decideCaseCreationState,
  deriveCaseCreationIdentity,
  type CaseCreationMarker,
} from "../../functions/src/cbam/storage/case-creation-idempotency";

const OWNER_ID = "user_case_contract_123";
const EVENT_ID = "11111111-1111-4111-8111-111111111111";
const SCENARIO_EVENT_ID = "11111111-1111-4111-8111-111111111112";
const REQUEST_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const TIMESTAMP = "2026-07-15T12:00:00.000Z";

function validDraft() {
  return createNewCaseDraft(OWNER_ID, {
    eventId: EVENT_ID,
    scenarioEventId: SCENARIO_EVENT_ID,
    timestamp: TIMESTAMP,
  });
}

function blankDraft() {
  return createBlankCaseDraft(OWNER_ID, { eventId: EVENT_ID, timestamp: TIMESTAMP });
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
    expect(workspace.goods).toHaveLength(2);
    expect(workspace.goods[0]?.cnCode.value).toBe("72085120");
    expect("data" in workspace).toBe(false);
  });

  it("requires one stable requestId for creation and no requestId for edits", () => {
    const draft = validDraft();
    const createRequest = createCaseSaveRequest(draft, undefined, REQUEST_ID);
    expect(createRequest).toEqual({ data: draft, requestId: REQUEST_ID });
    expect(Object.prototype.hasOwnProperty.call(createRequest, "caseId")).toBe(false);
    expect(createCaseSaveRequest(draft, undefined, REQUEST_ID)).toEqual(createRequest);

    expect(() => createCaseSaveRequest(draft)).toThrow("CASE_CREATION_REQUEST_ID_REQUIRED");

    const editData = { ...draft, caseId: "case_FirestoreAutoId123" };
    const editRequest = createCaseSaveRequest(editData, "case_FirestoreAutoId123");
    expect(editRequest).toEqual({
      caseId: "case_FirestoreAutoId123",
      data: editData,
    });
    expect(() =>
      createCaseSaveRequest(draft, "case_FirestoreAutoId123", REQUEST_ID)
    ).toThrow("AMBIGUOUS_CASE_SAVE_REQUEST");
  });
});

describe("case creation idempotency state machine", () => {
  it("derives the same case identity for the same user and request", () => {
    const first = deriveCaseCreationIdentity(OWNER_ID, REQUEST_ID);
    const retry = deriveCaseCreationIdentity(OWNER_ID, REQUEST_ID);
    const different = deriveCaseCreationIdentity(OWNER_ID, OTHER_REQUEST_ID);

    expect(retry).toEqual(first);
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(first.caseId).toBe(`case_${first.digest}`);
    expect(different.caseId).not.toBe(first.caseId);
  });

  it("creates only when both marker and case are absent", () => {
    const identity = deriveCaseCreationIdentity(OWNER_ID, REQUEST_ID);
    expect(decideCaseCreationState({ identity, marker: null, caseExists: false })).toBe("CREATE");
  });

  it("returns the existing case when marker and case agree", () => {
    const identity = deriveCaseCreationIdentity(OWNER_ID, REQUEST_ID);
    const marker: CaseCreationMarker = {
      uid: identity.uid,
      requestId: identity.requestId,
      caseId: identity.caseId,
      createdAt: TIMESTAMP,
    };
    expect(decideCaseCreationState({ identity, marker, caseExists: true })).toBe("RETURN_EXISTING");
  });

  it("fails closed for every partial or contradictory state", () => {
    const identity = deriveCaseCreationIdentity(OWNER_ID, REQUEST_ID);
    const marker: CaseCreationMarker = {
      uid: identity.uid,
      requestId: identity.requestId,
      caseId: identity.caseId,
      createdAt: TIMESTAMP,
    };

    expect(() =>
      decideCaseCreationState({ identity, marker, caseExists: false })
    ).toThrow("CASE_CREATION_IDEMPOTENCY_BROKEN");
    expect(() =>
      decideCaseCreationState({ identity, marker: null, caseExists: true })
    ).toThrow("CASE_CREATION_IDEMPOTENCY_BROKEN");
    expect(() =>
      decideCaseCreationState({
        identity,
        marker: { ...marker, requestId: OTHER_REQUEST_ID },
        caseExists: true,
      })
    ).toThrow("CASE_CREATION_IDEMPOTENCY_COLLISION");
  });
});

describe("new case calculation safety", () => {
  it("does not divide by zero or throw for a blank draft", () => {
    expect(() => performDossierCalculations(blankDraft())).not.toThrow();
    const result = performDossierCalculations(blankDraft());
    expect(result.totalEmbeddedEmissions).toBe("NOT_CALCULATED");
    expect(result.specificEmbeddedEmissions).toBe("NOT_CALCULATED");
  });

  it("matches the closed-form emissions identity and is monotonic", () => {
    const base = blankDraft();
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
    expect(baseResult.totalDirectEmissions).toBe("10");
    expect(baseResult.totalIndirectEmissions).toBe("10");
    expect(baseResult.totalEmbeddedEmissions).toBe("20");
    expect(baseResult.productionVolume).toBe("100");
    expect(baseResult.specificEmbeddedEmissions).toBe("0.2");
    expect(baseResult.goods[0]?.allocatedEmbeddedEmissions).toBe("20");
    expect(baseResult.goods[0]?.specificEmbeddedEmissions).toBe("0.2");

    const increased = structuredClone(base);
    increased.directEmissions.value = "20";
    const increasedResult = performDossierCalculations(increased);
    expect(increasedResult.totalEmbeddedEmissions).toBe("30");
    expect(increasedResult.specificEmbeddedEmissions).toBe("0.3");
    expect(Number(increasedResult.totalEmbeddedEmissions)).toBeGreaterThan(
      Number(baseResult.totalEmbeddedEmissions)
    );
    expect(Number(increasedResult.specificEmbeddedEmissions)).toBeGreaterThan(
      Number(baseResult.specificEmbeddedEmissions)
    );
  });

  it("preserves total emissions and fails closed only for division by zero", () => {
    const draft = blankDraft();
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
    expect(result.totalEmbeddedEmissions).toBe("10");
    expect(result.productionVolume).toBe("NOT_CALCULATED");
    expect(result.specificEmbeddedEmissions).toBe("NOT_CALCULATED");
    expect(result.goods).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/Infinity|NaN/);
  });
});

describe("default illustrative scenario", () => {
  it("prefills every workflow section with a coherent, calculable example", () => {
    const scenario = validDraft();
    const result = performDossierCalculations(scenario);

    expect(isIllustrativeScenarioActive(scenario)).toBe(true);
    expect(scenario.importerIdentity.legalName.value).toBeTruthy();
    expect(scenario.exporterIdentity.legalName.value).toBeTruthy();
    expect(scenario.goods).toHaveLength(2);
    expect(scenario.installation.systemBoundaries).toContain("Illustrative boundary");
    expect(scenario.precursors).toHaveLength(1);
    expect(scenario.carbonPriceRecords).toHaveLength(1);
    expect(scenario.evidenceRegister).toEqual([]);
    expect(result.totalDirectEmissions).toBe("770");
    expect(result.totalIndirectEmissions).toBe("387.24");
    expect(result.totalPrecursorEmissions).toBe("168");
    expect(result.totalEmbeddedEmissions).toBe("1157.24");
    expect(result.productionVolume).toBe("1000");
    expect(result.specificEmbeddedEmissions).toBe("1.15724");
    expect(result.allocationShareTotal).toBe("1");
    expect(result.allocationReconciliationDelta).toBe("0");
    expect(result.goods).toHaveLength(2);
  });

  it("blocks sealing in both runtimes until example data is explicitly removed", () => {
    const scenario = validDraft();

    for (const controls of [
      runBrowserQualityControls(scenario),
      runServerQualityControls(scenario),
    ]) {
      const guard = controls.find((control) => control.ruleId === "QC_SCENARIO");
      expect(guard?.status).toBe("BLOCKER");
      expect(guard?.remediationCode).toBe("REM_REPLACE_ILLUSTRATIVE_SCENARIO");
    }
  });

  it("clears all example values while preserving case identity and audit history", () => {
    const scenario = { ...validDraft(), caseId: "case_FirestoreAutoId123" };
    const blank = replaceIllustrativeScenarioWithBlank(
      scenario,
      OWNER_ID,
      "2026-07-15T13:00:00.000Z"
    );

    expect(blank.caseId).toBe(scenario.caseId);
    expect(blank.ownerId).toBe(OWNER_ID);
    expect(blank.importerIdentity.legalName.value).toBeNull();
    expect(blank.goods).toEqual([]);
    expect(blank.precursors).toEqual([]);
    expect(blank.carbonPriceRecords).toEqual([]);
    expect(isIllustrativeScenarioActive(blank)).toBe(false);
    expect(blank.auditEvents.at(-1)?.action).toBe("ILLUSTRATIVE_SCENARIO_REPLACED");
  });
});
