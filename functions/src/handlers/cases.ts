import { createCallable } from "../wrapper";
import { z } from "zod";
import { createCase, updateCase, getCase, getCasesForUser } from "@/cbam/storage/case-repository";


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
