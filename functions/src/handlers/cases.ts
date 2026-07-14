import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { createCase, updateCase, getCase, getCasesForUser } from "../cbam/storage/case-repository";
import { AuditReadyCaseSchema } from "../cbam/schema";

function parseCaseData(data: unknown, uid: string, caseId?: string) {
  const parsed = AuditReadyCaseSchema.safeParse({
    ...(data as Record<string, unknown>),
    ownerId: uid,
    ...(caseId ? { caseId } : {}),
  });

  if (!parsed.success) {
    throw new HttpsError(
      "invalid-argument",
      `Case data is invalid: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`
    );
  }
  return parsed.data;
}

export const saveCbamCase = createCallable(
  {
    schema: z.object({
      caseId: z.string().optional(),
      data: z.unknown()
    })
  },
  async ({ caseId, data }, { auth }) => {
    if (caseId) {
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

    const parsedData = parseCaseData(data, auth.uid);
    const newCase = await createCase(auth.uid, parsedData);
    return { caseId: newCase.caseId, status: "success" };
  }
);

export const getCbamCase = createCallable(
  { schema: z.object({ caseId: z.string() }) },
  async ({ caseId }, { auth }) => {
    const cbamCase = await getCase(caseId);
    if (!cbamCase || cbamCase.uid !== auth.uid) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    return {
      case: {
        ...cbamCase.data,
        caseId: cbamCase.caseId,
        ownerId: cbamCase.uid,
        recordStatus: cbamCase.status,
        createdAt: cbamCase.createdAt,
        updatedAt: cbamCase.updatedAt,
      },
      status: "success"
    };
  }
);

export const renameCbamCase = createCallable(
  {
    schema: z.object({ caseId: z.string(), newName: z.string().min(1).max(200) })
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
        name: { ...existing.data.installation?.name, value: newName },
      },
    };
    const parsedData = parseCaseData(updatedData, auth.uid, caseId);
    await updateCase(caseId, auth.uid, parsedData);
    return { success: true };
  }
);

export const archiveCbamCase = createCallable(
  { schema: z.object({ caseId: z.string() }) },
  async ({ caseId }, { auth }) => {
    const existing = await getCase(caseId);
    if (!existing || existing.uid !== auth.uid) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    const { adminDb } = await import("../firebase-admin");
    await adminDb.collection("cbam_cases").doc(caseId).update({
      status: "ARCHIVED",
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  }
);

export const deleteCbamCase = createCallable(
  { schema: z.object({ caseId: z.string() }) },
  async ({ caseId }, { auth }) => {
    const existing = await getCase(caseId);
    if (!existing || existing.uid !== auth.uid) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    if (existing.latestReleaseId) {
      throw new HttpsError("failed-precondition", "A dossier with sealed releases cannot be deleted. Archive it instead.");
    }
    const { adminDb } = await import("../firebase-admin");
    await adminDb.collection("cbam_cases").doc(caseId).delete();
    return { success: true };
  }
);

export const getCbamCases = createCallable({}, async (_, { auth }) => {
  const cases = await getCasesForUser(auth.uid);
  return { cases, status: "success" };
});

export const calculateCbam = createCallable(
  { schema: z.object({ caseId: z.string() }) },
  async ({ caseId }, { auth }) => {
    const existing = await getCase(caseId);
    if (!existing || existing.uid !== auth.uid) {
      throw new HttpsError("not-found", "Case not found or access denied.");
    }
    const parsedData = parseCaseData(existing.data, auth.uid, caseId);
    const { performDossierCalculations } = await import("../cbam/calculator");
    const calculation = performDossierCalculations(parsedData);
    return { calculation, status: "success" };
  }
);

export const getSourcesStatus = createCallable({}, async () => {
  return {
    status: "success",
    ruleset: "EU-CBAM-DEFINITIVE-2026",
    sourceStatus: "VERSION_LOCKED",
  };
});
