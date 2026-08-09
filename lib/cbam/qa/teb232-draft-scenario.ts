import { AuditReadyCaseSchema, type AuditReadyCase } from "../../../functions/src/cbam/schema";
import { assessCaseReadiness } from "../../../functions/src/cbam/validation/readiness-assessor";
import {
  buildFourDossierEvidenceFiles,
  type FourDossierKey,
} from "../../../tests/fixtures/four-dossiers";
import {
  TEB232_EMAIL,
  TEB232_UID,
  buildTeb232Case,
} from "../../../scripts/refresh-teb232-four-complete-cases";

export const TEB232_ALL_DRAFTS_PREPARATION_VERSION =
  "TEB232_ALL_DRAFTS_SEAL_READY_V1";
export const TEB232_DRAFT_PREPARED_ACTION =
  "CONTROLLED_TEST_DRAFT_PREPARED";

const CASE_ID_PATTERN = /^case_[a-f0-9]{64}$/;

export type Teb232DraftScenario = {
  caseId: string;
  fixtureKey: FourDossierKey;
  data: AuditReadyCase;
  evidenceFiles: Awaited<ReturnType<typeof buildFourDossierEvidenceFiles>>;
};

export function assertTeb232CaseId(caseId: string): void {
  if (!CASE_ID_PATTERN.test(caseId)) {
    throw new Error("TEB232_DRAFT_CASE_ID_INVALID");
  }
}

export function inferTeb232FixtureKey(
  storedData: unknown
): FourDossierKey {
  const data = storedData && typeof storedData === "object"
    ? storedData as Record<string, unknown>
    : {};
  const goods = Array.isArray(data.goods) ? data.goods : [];
  const firstGood = goods[0] && typeof goods[0] === "object"
    ? goods[0] as Record<string, unknown>
    : {};
  const sector = String(firstGood.sector || "").trim().toUpperCase();

  if (sector === "CEMENT") return "CEMENT_EG";
  if (sector === "ALUMINIUM") return "ALU_CN";
  if (sector === "FERTILISERS") return "FERTILISER_TR";
  return "STEEL_IN";
}

export function hasTeb232DraftPreparedMarker(
  caseData: AuditReadyCase
): boolean {
  return caseData.auditEvents.some((event) => {
    if (event.action !== TEB232_DRAFT_PREPARED_ACTION) return false;
    const metadata = event.metadata && typeof event.metadata === "object"
      ? event.metadata as Record<string, unknown>
      : {};
    return (
      metadata.preparationVersion === TEB232_ALL_DRAFTS_PREPARATION_VERSION &&
      metadata.syntheticTest === true &&
      metadata.paymentBypass === false &&
      ["STEEL_IN", "CEMENT_EG", "ALU_CN", "FERTILISER_TR"].includes(
        String(metadata.fixtureKey || "")
      )
    );
  });
}

export async function buildTeb232DraftScenario(params: {
  caseId: string;
  fixtureKey: FourDossierKey;
  version?: number;
  timestamp?: string;
}): Promise<Teb232DraftScenario> {
  assertTeb232CaseId(params.caseId);
  const timestamp = params.timestamp || new Date().toISOString();
  const prepared = await buildTeb232Case(params.fixtureKey);
  const data = structuredClone(prepared.data);

  data.caseId = params.caseId;
  data.ownerId = TEB232_UID;
  data.status = "DRAFT";
  data.version = Math.max(
    1,
    Number(params.version || 1),
    Number(data.version || 1)
  );
  data.evidenceRegister = data.evidenceRegister.map((record) => ({
    ...record,
    storagePath: `evidence/${TEB232_UID}/${params.caseId}/${record.evidenceId}/${record.fileName}`,
    uploader: TEB232_UID,
    reviewEnvironment: "PRODUCTION" as const,
  }));
  data.auditEvents = [
    ...data.auditEvents.filter(
      (event) => event.action !== TEB232_DRAFT_PREPARED_ACTION
    ),
    {
      eventId: crypto.randomUUID(),
      timestamp,
      actor: TEB232_UID,
      action: TEB232_DRAFT_PREPARED_ACTION,
      metadata: {
        preparationVersion: TEB232_ALL_DRAFTS_PREPARATION_VERSION,
        fixtureKey: params.fixtureKey,
        syntheticTest: true,
        paymentBypass: false,
        testOwnerEmail: TEB232_EMAIL,
      },
    },
  ];

  const evidenceFiles = await buildFourDossierEvidenceFiles(data);
  const parsed = AuditReadyCaseSchema.parse(data);
  const readiness = assessCaseReadiness(parsed);

  if (
    readiness.isEligibleForSealing !== true ||
    readiness.completenessPercentage !== 100 ||
    readiness.criticalBlockers.length !== 0 ||
    readiness.allGaps.length !== 0
  ) {
    throw new Error(
      `TEB232_DRAFT_SCENARIO_NOT_SEAL_READY:${params.caseId}:${readiness.completenessPercentage}:${readiness.criticalBlockers.length}:${readiness.allGaps.length}`
    );
  }

  if (
    parsed.evidenceRegister.some(
      (record) =>
        record.reviewStatus !== "APPROVED" ||
        record.supportStatus !== "SUPPORTED" ||
        record.malwareScanStatus !== "CLEAN" ||
        !record.storagePath.startsWith(
          `evidence/${TEB232_UID}/${params.caseId}/`
        )
    )
  ) {
    throw new Error(`TEB232_DRAFT_EVIDENCE_NOT_SEAL_READY:${params.caseId}`);
  }

  return {
    caseId: params.caseId,
    fixtureKey: params.fixtureKey,
    data: parsed,
    evidenceFiles,
  };
}
