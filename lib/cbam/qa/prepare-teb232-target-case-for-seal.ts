import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { AuditReadyCaseSchema } from "../../../functions/src/cbam/schema";
import { performDossierCalculations } from "../../../functions/src/cbam/calculator";
import { assertCarbonPriceSemantics } from "../../../functions/src/cbam/report/premium-package-hardening";
import { assessCaseReadiness } from "../../../functions/src/cbam/validation/readiness-assessor";
import {
  TEB232_EMAIL,
  TEB232_UID,
} from "../../../scripts/refresh-teb232-four-complete-cases";
import {
  TEB232_TARGET_CASE_ID,
  TEB232_TARGET_FIXTURE,
  prepareTeb232TargetCase,
  type Teb232TargetPrepareResult,
} from "./prepare-teb232-target-case";

const TARGET_PREPARATION_VERSION = "TEB232_TARGET_SEAL_READY_V1";
const TARGET_CARBON_SEMANTICS_VERSION = "TEB232_CARBON_EQUIVALENT_V1";
const TARGET_CARBON_RECORD_ID = "50000000-0000-4000-8000-000000000001";
const TARGET_AMOUNT_PAID_EUR = "1500000";
const TARGET_APPLICABLE_EMISSIONS = "150000";
const TARGET_ELIGIBLE_CERTIFICATE_REDUCTION = "150000";

type StoredCase = Record<string, unknown>;

function assertIdentity(params: {
  authenticatedUid: string;
  authenticatedEmail: string;
  emailVerified: boolean;
  targetCaseId: string;
}): void {
  if (
    params.authenticatedUid !== TEB232_UID ||
    params.authenticatedEmail.trim().toLowerCase() !== TEB232_EMAIL ||
    params.emailVerified !== true
  ) {
    throw new Error("TEB232_TARGET_PREPARE_IDENTITY_REFUSED");
  }
  if (params.targetCaseId !== TEB232_TARGET_CASE_ID) {
    throw new Error("TEB232_TARGET_CASE_REFUSED");
  }
}

function isExactControlledTarget(stored: StoredCase): boolean {
  return (
    stored.uid === TEB232_UID &&
    stored.syntheticTest === true &&
    stored.syntheticTestTarget === true &&
    stored.targetPreparationVersion === TARGET_PREPARATION_VERSION &&
    stored.targetFixtureKey === TEB232_TARGET_FIXTURE
  );
}

async function repairCarbonPriceSemantics(): Promise<boolean> {
  const caseRef = adminDb.collection("cbam_cases").doc(TEB232_TARGET_CASE_ID);
  const snapshot = await caseRef.get();
  if (!snapshot.exists) throw new Error("TEB232_TARGET_CASE_NOT_FOUND");
  const stored = (snapshot.data() || {}) as StoredCase;
  if (stored.uid !== TEB232_UID) throw new Error("TEB232_TARGET_CASE_OWNER_MISMATCH");
  if (!isExactControlledTarget(stored)) {
    throw new Error("TEB232_TARGET_CASE_CONTROL_MARKERS_MISMATCH");
  }

  const parsed = AuditReadyCaseSchema.parse({
    ...((stored.data || {}) as Record<string, unknown>),
    caseId: TEB232_TARGET_CASE_ID,
    ownerId: TEB232_UID,
  });
  const index = parsed.carbonPriceRecords.findIndex((record) => record.id === TARGET_CARBON_RECORD_ID);
  if (index < 0) throw new Error("TEB232_TARGET_CARBON_RECORD_MISSING");

  const record = parsed.carbonPriceRecords[index];
  if (
    String(record.amountPaid) !== TARGET_AMOUNT_PAID_EUR ||
    String(record.applicableEmissions) !== TARGET_APPLICABLE_EMISSIONS ||
    record.currency !== "EUR" ||
    !record.proofOfPaymentEvidenceId
  ) {
    throw new Error("TEB232_TARGET_CARBON_RECORD_UNEXPECTED");
  }

  const needsRepair =
    String(record.eligibleCertificateReduction ?? "") !== TARGET_ELIGIBLE_CERTIFICATE_REDUCTION ||
    stored.targetCarbonSemanticsVersion !== TARGET_CARBON_SEMANTICS_VERSION;

  const repaired = {
    ...parsed,
    carbonPriceRecords: parsed.carbonPriceRecords.map((item, itemIndex) =>
      itemIndex === index
        ? {
            ...item,
            // amountPaid is monetary (EUR). eligibleCertificateReduction is a
            // certificate/emissions-equivalent quantity and must not reuse EUR.
            eligibleCertificateReduction: TARGET_ELIGIBLE_CERTIFICATE_REDUCTION,
          }
        : item
    ),
  };

  const validated = AuditReadyCaseSchema.parse(repaired);
  const calculation = performDossierCalculations(validated);
  assertCarbonPriceSemantics(validated, calculation);
  const readiness = assessCaseReadiness(validated);
  if (
    readiness.isEligibleForSealing !== true ||
    readiness.completenessPercentage !== 100 ||
    readiness.criticalBlockers.length !== 0 ||
    readiness.allGaps.length !== 0
  ) {
    throw new Error(
      `TEB232_TARGET_NOT_SEAL_READY_AFTER_CARBON_REPAIR:${readiness.completenessPercentage}:${readiness.criticalBlockers.length}:${readiness.allGaps.length}`
    );
  }

  if (needsRepair) {
    await caseRef.set(
      {
        data: validated,
        status: "DRAFT",
        updatedAt: new Date().toISOString(),
        targetCarbonSemanticsVersion: TARGET_CARBON_SEMANTICS_VERSION,
      },
      { merge: true }
    );
  }
  return needsRepair;
}

/**
 * Exact production-QA wrapper for the approved TEB232 target case.
 *
 * A prior immutable SEALED release is allowed to remain in history. It must
 * not prevent repairing the editable controlled working file for a subsequent
 * sealing attempt. Active PROCESSING seals still block all mutation.
 */
export async function prepareTeb232TargetCaseForSeal(params: {
  authenticatedUid: string;
  authenticatedEmail: string;
  emailVerified: boolean;
  targetCaseId: string;
}): Promise<Teb232TargetPrepareResult> {
  assertIdentity(params);

  const caseRef = adminDb.collection("cbam_cases").doc(TEB232_TARGET_CASE_ID);
  const initialSnapshot = await caseRef.get();
  if (!initialSnapshot.exists) throw new Error("TEB232_TARGET_CASE_NOT_FOUND");
  const initialStored = (initialSnapshot.data() || {}) as StoredCase;
  if (initialStored.uid !== TEB232_UID) throw new Error("TEB232_TARGET_CASE_OWNER_MISMATCH");

  const reports = await adminDb
    .collection("cbam_reports")
    .where("caseId", "==", TEB232_TARGET_CASE_ID)
    .get();
  const statuses = reports.docs.map((doc) => String(doc.data().status || ""));
  if (statuses.includes("PROCESSING")) {
    throw new Error("TEB232_TARGET_CASE_SEAL_IN_PROGRESS");
  }

  const hasSealedHistory = statuses.includes("SEALED");
  if (hasSealedHistory && !isExactControlledTarget(initialStored)) {
    throw new Error("TEB232_TARGET_CASE_ALREADY_RELEASED");
  }

  let baseChanged = false;
  if (!hasSealedHistory) {
    const base = await prepareTeb232TargetCase(params);
    baseChanged = base.changed;
  }

  const carbonChanged = await repairCarbonPriceSemantics();
  return {
    changed: baseChanged || carbonChanged,
    caseId: TEB232_TARGET_CASE_ID,
    fixtureKey: TEB232_TARGET_FIXTURE,
    operatorPreparation: 100,
    evidenceAssurance: 100,
  };
}
