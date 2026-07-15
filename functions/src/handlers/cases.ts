import { HttpsError } from "firebase-functions/v2/https";
import { z } from "zod";
import { createCallable } from "../wrapper";
import {
  archiveCase,
  createCase,
  deleteCase,
  getCase,
  getCasesForUser,
  updateCase,
} from "../cbam/storage/case-repository";
import { toCaseWorkspaceView } from "../cbam/storage/case-contract";
import { AuditReadyCaseSchema } from "../cbam/schema";
import { CaseIdSchema } from "../cbam/case-id";

function parseCaseData(data: unknown, uid: string, caseId?: string) {
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

export const saveCbamCase = createCallable(
  {
    schema: z.object({
      caseId: CaseIdSchema.optional(),
      data: z.unknown(),
    }),
  },
  async ({ caseId, data }, { auth }) => {
    if (!caseId) {
      const parsedData = parseCaseData(data, auth.uid);
      const newCase = await createCase(auth.uid, parsedData);
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
