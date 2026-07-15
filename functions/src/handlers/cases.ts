import { createCallable } from "../wrapper";
import { z } from "zod";
import { createCase, updateCase, getCase, getCasesForUser } from "../cbam/storage/case-repository";


export const saveCbamCase = createCallable(
  {
    schema: z.object({
      caseId: z.string().optional(),
      data: z.any()
    })
  },
  async ({ caseId, data }, { auth }) => {
    if (caseId) {
      const existing = await getCase(caseId);
      if (!existing || existing.uid !== auth.uid) {
        throw new Error("Case not found or access denied.");
      }
      await updateCase(caseId, auth.uid, data);
      return { caseId, status: "success" };
    } else {
      const newCase = await createCase(auth.uid, data);
      return { caseId: newCase.caseId, status: "success" };
    }
  }
);

export const getCbamCase = createCallable(
  {
    schema: z.object({
      caseId: z.string()
    })
  },
  async ({ caseId }, { auth }) => {
    const cbamCase = await getCase(caseId);
    if (!cbamCase || cbamCase.uid !== auth.uid) {
      throw new Error("Case not found or access denied.");
    }
    return { case: cbamCase, status: "success" };
  }
);

export const renameCbamCase = createCallable(
  {
    schema: z.object({
      caseId: z.string(),
      newName: z.string()
    })
  },
  async ({ caseId, newName }, { auth }) => {
    const existing = await getCase(caseId);
    if (!existing || existing.uid !== auth.uid) {
      throw new Error("Case not found or access denied.");
    }
    const updatedData = { ...existing.data, installationName: newName };
    await updateCase(caseId, auth.uid, updatedData);
    return { success: true };
  }
);

export const archiveCbamCase = createCallable(
  {
    schema: z.object({
      caseId: z.string()
    })
  },
  async ({ caseId }, { auth }) => {
    const existing = await getCase(caseId);
    if (!existing || existing.uid !== auth.uid) {
      throw new Error("Case not found or access denied.");
    }
    // Update status to ARCHIVED
    const { adminDb } = await import("../firebase-admin");
    await adminDb.collection("cbam_cases").doc(caseId).update({
      status: "ARCHIVED",
      updatedAt: new Date().toISOString()
    });
    return { success: true };
  }
);

export const deleteCbamCase = createCallable(
  {
    schema: z.object({
      caseId: z.string()
    })
  },
  async ({ caseId }, { auth }) => {
    const existing = await getCase(caseId);
    if (!existing || existing.uid !== auth.uid) {
      throw new Error("Case not found or access denied.");
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

export const calculateCbam = createCallable({}, async (data, _) => {
  return { data: {}, status: "success" };
});

export const getSourcesStatus = createCallable({}, async () => {
  return { status: "success", sources: [] };
});
