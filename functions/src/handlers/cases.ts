import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { createCallable } from "../wrapper";
import {
  acceptMethodologyDecision,
  archiveCase,
  createCase,
  deleteCase,
  getCase,
  getCasesForUsers,
  recordEvidenceMalwareScan,
  reviewCaseEvidence,
  updateCase,
} from "../cbam/storage/case-repository";
import { toCaseWorkspaceView } from "../cbam/storage/case-contract";
import { AuditReadyCaseSchema, type AuditReadyCase } from "../cbam/schema";
import { CaseIdSchema } from "../cbam/case-id";
import { adminDb } from "../firebase-admin";
import {
  isProductionSmokeIdentity,
} from "../auth/production-smoke-identity";
import {
  requireOrganisationCaseReadAccess,
  requireOrganisationReviewerAccess,
  getUserOrganisationId,
  getUserRole,
} from "../auth/organisation-access";

const CreationRequestIdSchema = z.string().uuid();

/**
 * FAZ P0 hotfix — a stored record that no compatibility adapter can read must
 * surface as an explicit failed-precondition migration error instead of a raw
 * HTTP 500, so clients can show a resolvable message without leaking data.
 */
export function buildCompatibilityMigrationError(error: unknown): HttpsError {
  if (error instanceof Error && error.message === "CASE_RECORD_UNSUPPORTED_SCHEMA") {
    return new HttpsError(
      "failed-precondition",
      "CASE_RECORD_REQUIRES_COMPATIBILITY_MIGRATION"
    );
  }
  throw error;
}

function translateCaseCompatibilityError(error: unknown): never {
  throw buildCompatibilityMigrationError(error);
}

export function parseCaseData(
  data: unknown,
  uid: string,
  caseId?: string,
  allowAcceptedMethodologyDecisions = false,
  existingAcceptedDecisionIds = new Set<string>()
): AuditReadyCase {
  const caseDataObj = { ...(data as Record<string, unknown>) };
  if (caseDataObj.reportingPeriod && typeof caseDataObj.reportingPeriod === "object") {
    const rp = caseDataObj.reportingPeriod as Record<string, { value?: string | number; sourceType?: string; confidenceStatus?: string } | undefined>;
    const yearVal = rp.year?.value;
    const quarterVal = rp.quarter?.value;
    if (yearVal && quarterVal) {
      if (!rp.startDate) rp.startDate = { sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", value: "" };
      if (!rp.endDate) rp.endDate = { sourceType: "PRIMARY", confidenceStatus: "HIGH_VERIFIED", value: "" };
      
      if (quarterVal === "ANNUAL") {
        rp.startDate.value = `${yearVal}-01-01`;
        rp.endDate.value = `${yearVal}-12-31`;
      } else if (quarterVal === "Q1") {
        rp.startDate.value = `${yearVal}-01-01`;
        rp.endDate.value = `${yearVal}-03-31`;
      } else if (quarterVal === "Q2") {
        rp.startDate.value = `${yearVal}-04-01`;
        rp.endDate.value = `${yearVal}-06-30`;
      } else if (quarterVal === "Q3") {
        rp.startDate.value = `${yearVal}-07-01`;
        rp.endDate.value = `${yearVal}-09-30`;
      } else if (quarterVal === "Q4") {
        rp.startDate.value = `${yearVal}-10-01`;
        rp.endDate.value = `${yearVal}-12-31`;
      }
    }
  }

  // FAZ P0 — ACCEPTED methodology decisions can only be granted by a
  // server-controlled review workflow. A user-submitted payload may only
  // preserve previously server-accepted decision IDs; any NEW accepted
  // record is rejected fail-closed.
  if (!allowAcceptedMethodologyDecisions) {
    const decisions = (caseDataObj.methodologyDecisions as Array<{ decisionId?: string; reviewStatus?: string }> | undefined) ?? [];
    const hasNewAccepted = decisions.some(
      (decision) => decision.reviewStatus === "ACCEPTED" && !existingAcceptedDecisionIds.has(decision.decisionId ?? "")
    );
    if (hasNewAccepted) {
      throw new HttpsError(
        "failed-precondition",
        "USER_CREATED_ACCEPTED_METHODOLOGY_DECISION_FORBIDDEN"
      );
    }
  }

  const parsed = AuditReadyCaseSchema.safeParse({
    ...caseDataObj,
    ownerId: uid,
    ...(caseId ? { caseId } : {}),
  });

  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).filter(Boolean);
    throw new HttpsError(
      "invalid-argument",
      `Case data is invalid${fields.length ? `: ${fields.join(", ")}` : "."}`
    );
  }
  return parsed.data;
}

function resolveCreationRequestId(
  explicitRequestId: string | undefined,
  caseData: AuditReadyCase
): string {
  const legacyAuditEventId = caseData.auditEvents.find(
    (event) => event.action === "CASE_CREATED"
  )?.eventId;
  const parsed = CreationRequestIdSchema.safeParse(explicitRequestId ?? legacyAuditEventId);
  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      "A UUID request ID is required to create a case safely."
    );
  }
  return parsed.data;
}

/**
 * Malware-scan recording: real admins OR narrowly scoped production-smoke identity.
 * Smoke identity does not unlock listAllUsers / adminSetUserTokens / other admin callables.
 * requireAdmin remains unbypassable elsewhere — smoke UID never satisfies full admin.
 */
async function requireAdminOrProductionSmoke(
  auth: { uid: string; token: Record<string, unknown> }
): Promise<void> {
  if (auth.token.admin === true || auth.token.ownerAdmin === true) {
    return;
  }
  if (await isProductionSmokeIdentity(auth)) {
    return;
  }
  throw new HttpsError(
    "permission-denied",
    "Requires administrator privileges or production-smoke identity."
  );
}

/**
 * FAZ P0 — evidence internal review must be performed by an independent
 * reviewer role (or admin / narrowly scoped smoke identity). A data preparer
 * can never self-approve their own uploaded documents.
 */
async function requireEvidenceReviewer(
  auth: { uid: string; token: Record<string, unknown> }
): Promise<void> {
  if (auth.token.admin === true || auth.token.ownerAdmin === true) {
    return;
  }
  if (await isProductionSmokeIdentity(auth)) {
    return;
  }
  const userDoc = await adminDb.collection("users").doc(auth.uid).get();
  const role = String(userDoc.exists ? userDoc.data()?.role ?? "" : "").toUpperCase();
  if (["INTERNAL_REVIEWER", "SUPER_ADMIN", "DATA_OWNER"].includes(role)) {
    return;
  }
  throw new HttpsError(
    "permission-denied",
    "EVIDENCE_SELF_APPROVAL_FORBIDDEN"
  );
}

function translateEvidenceError(error: unknown): never {
  const message = error instanceof Error ? error.message : "EVIDENCE_OPERATION_FAILED";
  if (message === "CASE_NOT_FOUND" || message === "EVIDENCE_NOT_FOUND") {
    throw new HttpsError("not-found", message);
  }
  if (message.includes("OWNERSHIP") || message.includes("access denied")) {
    throw new HttpsError("permission-denied", message);
  }
  if (
    message === "CASE_NOT_EDITABLE" ||
    message.startsWith("EVIDENCE_FILE_") ||
    message.startsWith("EVIDENCE_STORAGE_") ||
    message.startsWith("EVIDENCE_MALWARE_") ||
    message.startsWith("EVIDENCE_SUPPORT_")
  ) {
    throw new HttpsError("failed-precondition", message);
  }
  throw error;
}

export const saveCbamCase = createCallable(
  {
    schema: z.object({
      caseId: CaseIdSchema.optional(),
      requestId: CreationRequestIdSchema.optional(),
      data: z.unknown(),
    }),
  },
  async ({ caseId, requestId, data }, { auth }) => {
    if (caseId && requestId) {
      throw new HttpsError(
        "invalid-argument",
        "Edit requests must not include a case-creation request ID."
      );
    }

    // FAZ P0 — a user-created payload may never claim ACCEPTED methodology
    // decisions; only server review (or a narrowly scoped smoke identity used
    // for controlled fixtures) can carry accepted records.
    const allowAcceptedMethodologyDecisions = await isProductionSmokeIdentity(auth);

    if (!caseId) {
      const parsedData = parseCaseData(data, auth.uid, undefined, allowAcceptedMethodologyDecisions);
      const creationRequestId = resolveCreationRequestId(requestId, parsedData);
      const newCase = await createCase(auth.uid, parsedData, creationRequestId);
      return { caseId: newCase.caseId, status: "success" };
    }

    const existing = await getCase(caseId).catch(translateCaseCompatibilityError);
    if (!existing || existing.uid !== auth.uid) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    if (existing.status !== "DRAFT") {
      throw new HttpsError("failed-precondition", "Only a draft case can be edited.");
    }

    const existingAcceptedDecisionIds = new Set(
      (existing.data.methodologyDecisions ?? [])
        .filter((decision) => decision.reviewStatus === "ACCEPTED")
        .map((decision) => decision.decisionId)
    );
    const parsedData = parseCaseData(data, auth.uid, caseId, allowAcceptedMethodologyDecisions, existingAcceptedDecisionIds);
    await updateCase(caseId, auth.uid, parsedData);
    return { caseId, status: "success" };
  }
);

export const getCbamCase = createCallable(
  { schema: z.object({ caseId: CaseIdSchema }) },
  async ({ caseId }, { auth }) => {
    const cbamCase = await getCase(caseId).catch(translateCaseCompatibilityError);
    if (!cbamCase) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    await requireOrganisationCaseReadAccess(auth, cbamCase.uid);
    return { case: toCaseWorkspaceView(cbamCase), status: "success" };
  }
);

export const reviewCbamEvidence = createCallable(
  {
    schema: z.object({
      caseId: CaseIdSchema,
      evidenceId: z.string().uuid(),
      decision: z.enum(["APPROVED", "REJECTED"]),
      supportStatus: z.enum([
        "SUPPORTED",
        "PARTIALLY_SUPPORTED",
        "UNSUPPORTED",
        "NOT_REQUIRED",
      ]),
      reviewerNotes: z.string().trim().min(5).max(2000),
    }),
  },
  async (data, { auth }) => {
    // FAZ P0 — self-approval is blocked: only an independent reviewer role
    // (admin / production-smoke identity, or a peer reviewer from the SAME
    // customer organisation) may approve or reject evidence on a case.
    await requireEvidenceReviewer(auth);
    const cbamCase = await getCase(data.caseId).catch(translateCaseCompatibilityError);
    if (!cbamCase) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    await requireOrganisationReviewerAccess(auth, cbamCase.uid);
    try {
      const updated = await reviewCaseEvidence({
        ...data,
        uid: cbamCase.uid,
        actorUid: auth.uid,
      });
      return { case: toCaseWorkspaceView(updated), status: "success" };
    } catch (error) {
      translateEvidenceError(error);
    }
  }
);

export const acceptCbamMethodologyDecision = createCallable(
  {
    schema: z.object({
      caseId: CaseIdSchema,
      decisionId: z.string().uuid(),
      approverName: z.string().trim().min(1).max(200),
      approverRole: z.string().trim().min(1).max(100),
    }),
  },
  async (data, { auth }) => {
    // FAZ P0 / FAZ 13 — ACCEPTED can be granted by the server-controlled review
    // workflow: an admin / production-smoke identity, or a peer reviewer from
    // the SAME customer organisation (self-approval stays blocked).
    const cbamCase = await getCase(data.caseId).catch(translateCaseCompatibilityError);
    if (!cbamCase) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    await requireOrganisationReviewerAccess(auth, cbamCase.uid);
    try {
      const updated = await acceptMethodologyDecision({
        ...data,
        approverUid: auth.uid,
      });
      return { case: toCaseWorkspaceView(updated), status: "success" };
    } catch (error) {
      const message = error instanceof Error ? error.message : "METHODOLOGY_DECISION_OPERATION_FAILED";
      if (message === "CASE_NOT_FOUND") throw new HttpsError("not-found", message);
      if (message === "METHODOLOGY_DECISION_NOT_FOUND") throw new HttpsError("not-found", message);
      if (message === "CASE_NOT_EDITABLE") throw new HttpsError("failed-precondition", message);
      throw error;
    }
  }
);

export const recordCbamEvidenceScan = createCallable(
  {
    schema: z.object({
      caseId: CaseIdSchema,
      evidenceId: z.string().uuid(),
      status: z.enum(["CLEAN", "INFECTED"]),
      scannerReference: z.string().trim().min(8).max(500),
    }),
  },
  async (data, { auth }) => {
    await requireAdminOrProductionSmoke(auth);
    try {
      const updated = await recordEvidenceMalwareScan({
        ...data,
        actorUid: auth.uid,
      });
      return { case: toCaseWorkspaceView(updated), status: "success" };
    } catch (error) {
      translateEvidenceError(error);
    }
  }
);

export const renameCbamCase = createCallable(
  {
    schema: z.object({
      caseId: CaseIdSchema,
      newName: z.string().trim().min(1).max(200),
    }),
  },
  async ({ caseId, newName }, { auth }) => {
    const existing = await getCase(caseId).catch(translateCaseCompatibilityError);
    if (!existing || existing.uid !== auth.uid) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    if (existing.status !== "DRAFT") {
      throw new HttpsError("failed-precondition", "Only a draft case can be renamed.");
    }

    const updatedData = {
      ...existing.data,
      installation: {
        ...existing.data.installation,
        name: { ...existing.data.installation.name, value: newName },
      },
    };
    const existingAcceptedDecisionIds = new Set(
      (existing.data.methodologyDecisions ?? [])
        .filter((decision) => decision.reviewStatus === "ACCEPTED")
        .map((decision) => decision.decisionId)
    );
    await updateCase(caseId, auth.uid, parseCaseData(updatedData, auth.uid, caseId, false, existingAcceptedDecisionIds));
    return { success: true };
  }
);

export const archiveCbamCase = createCallable(
  { schema: z.object({ caseId: CaseIdSchema }) },
  async ({ caseId }, { auth }) => {
    await archiveCase(caseId, auth.uid);
    return { success: true };
  }
);

export const deleteCbamCase = createCallable(
  { schema: z.object({ caseId: CaseIdSchema }) },
  async ({ caseId }, { auth }) => {
    try {
      await deleteCase(caseId, auth.uid);
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.message === "CASE_WITH_RELEASE_CANNOT_BE_DELETED") {
        throw new HttpsError(
          "failed-precondition",
          "A dossier with sealed releases cannot be deleted. Archive it instead."
        );
      }
      throw error;
    }
  }
);

export const getCbamCases = createCallable({}, async (_, { auth }) => {
  // FAZ 13 — a peer reviewer from the same customer organisation may list the
  // organisation's cases (not just their own) so in-org approval is usable.
  // Only callers holding an internal-review role may see peer cases.
  const ownCases = await getCasesForUsers([auth.uid]);

  const role = await getUserRole(auth.uid);
  const canSeePeerCases = (["INTERNAL_REVIEWER", "DATA_OWNER", "SUPER_ADMIN"] as string[]).includes(role);
  if (!canSeePeerCases) {
    return { cases: ownCases, status: "success" };
  }

  const organisationId = await getUserOrganisationId(auth.uid);
  if (!organisationId) {
    return { cases: ownCases, status: "success" };
  }

  const membersSnapshot = await adminDb
    .collection("users")
    .where("organisationId", "==", organisationId)
    .limit(30)
    .get();
  const reviewerUids = membersSnapshot.docs
    .map((doc) => doc.id)
    .filter((memberUid) => memberUid !== auth.uid);

  const cases = await getCasesForUsers([auth.uid, ...reviewerUids]);
  return { cases, status: "success" };
});

export const calculateCbam = createCallable(
  { schema: z.object({ caseId: CaseIdSchema }) },
  async ({ caseId }, { auth }) => {
    const existing = await getCase(caseId).catch(translateCaseCompatibilityError);
    if (!existing || existing.uid !== auth.uid) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    const parsedData = parseCaseData(existing.data, auth.uid, caseId);
    const { performDossierCalculations } = await import("../cbam/calculator");
    return { calculation: performDossierCalculations(parsedData), status: "success" };
  }
);

export const getSourcesStatus = createCallable({}, async () => {
  return {
    status: "success",
    ruleset: "EU-CBAM-DEFINITIVE-2026",
    sourceStatus: "VERSION_LOCKED",
  };
});
