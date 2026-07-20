import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { adminDb } from "../firebase-admin";
import { createCallable } from "../wrapper";
import {
  archiveCase,
  createCase,
  deleteCase,
  getCase,
  getCasesForUser,
  recordEvidenceMalwareScan,
  reviewCaseEvidence,
  updateCase,
} from "../cbam/storage/case-repository";
import { toCaseWorkspaceView } from "../cbam/storage/case-contract";
import { AuditReadyCaseSchema, type AuditReadyCase } from "../cbam/schema";
import { CaseIdSchema } from "../cbam/case-id";

const CreationRequestIdSchema = z.string().uuid();

function parseCaseData(data: unknown, uid: string, caseId?: string): AuditReadyCase {
  const parsed = AuditReadyCaseSchema.safeParse({
    ...(data as Record<string, unknown>),
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

async function requireAdmin(auth: { uid: string; token: Record<string, unknown> }): Promise<void> {
  if (auth.token.admin === true || auth.token.ownerAdmin === true) {
    return;
  }
  const configDoc = await adminDb.collection("system").doc("config").get();
  const allowedUid = configDoc.exists ? configDoc.data()?.smokeTestUid : null;
  if (allowedUid && auth.uid === allowedUid) {
    if (auth.token.smokeTestAllowed === true) {
      return;
    }
  }
  throw new HttpsError("permission-denied", "Requires administrator privileges.");
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

    if (!caseId) {
      const parsedData = parseCaseData(data, auth.uid);
      const creationRequestId = resolveCreationRequestId(requestId, parsedData);
      const newCase = await createCase(auth.uid, parsedData, creationRequestId);
      return { caseId: newCase.caseId, status: "success" };
    }

    const existing = await getCase(caseId);
    if (!existing || existing.uid !== auth.uid) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    if (existing.status !== "DRAFT") {
      throw new HttpsError("failed-precondition", "Only a draft case can be edited.");
    }

    const parsedData = parseCaseData(data, auth.uid, caseId);
    await updateCase(caseId, auth.uid, parsedData);
    return { caseId, status: "success" };
  }
);

export const getCbamCase = createCallable(
  { schema: z.object({ caseId: CaseIdSchema }) },
  async ({ caseId }, { auth }) => {
    const cbamCase = await getCase(caseId);
    if (!cbamCase || cbamCase.uid !== auth.uid) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
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
    try {
      const updated = await reviewCaseEvidence({ ...data, uid: auth.uid });
      return { case: toCaseWorkspaceView(updated), status: "success" };
    } catch (error) {
      translateEvidenceError(error);
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
    await requireAdmin(auth);
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
    const existing = await getCase(caseId);
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
    await updateCase(caseId, auth.uid, parseCaseData(updatedData, auth.uid, caseId));
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
  const cases = await getCasesForUser(auth.uid);
  return { cases, status: "success" };
});

export const calculateCbam = createCallable(
  { schema: z.object({ caseId: CaseIdSchema }) },
  async ({ caseId }, { auth }) => {
    const existing = await getCase(caseId);
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
