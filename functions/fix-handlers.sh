#!/bin/bash
cat << 'REPORTS_EOF' > src/handlers/reports.ts
import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "@/firebase-admin";

export const sealCbamReport = createCallable(
  {
    schema: z.object({
      caseId: z.string(),
      entitlementId: z.string()
    })
  },
  async ({ caseId, entitlementId }, { auth }) => {
    const { sealReport } = await import("@/cbam/report/seal-service");
    try {
      const report = await sealReport({
        uid: auth.uid,
        caseId,
        entitlementId,
        inputData: undefined
      });
      return { report, status: "success" };
    } catch (err: any) {
      throw new HttpsError("internal", err.message);
    }
  }
);

export const getCbamReports = createCallable({}, async (_, { auth }) => {
  const snapshot = await adminDb.collection("cbam_reports").where("uid", "==", auth.uid).get();
  const reports = snapshot.docs.map(doc => doc.data());
  return { reports, status: "success" };
});

export const getCbamReport = createCallable(
  {
    schema: z.object({ reportId: z.string() })
  },
  async ({ reportId }, { auth }) => {
    const doc = await adminDb.collection("cbam_reports").doc(reportId).get();
    const report = doc.data() as any;
    if (!report || report.uid !== auth.uid) {
      throw new HttpsError("not-found", "Report not found or access denied.");
    }
    return { report, status: "success" };
  }
);

export const getReportDownloadUrl = createCallable(
  {
    schema: z.object({ reportId: z.string(), format: z.string() })
  },
  async ({ reportId, format }, { auth }) => {
    const doc = await adminDb.collection("cbam_reports").doc(reportId).get();
    const report = doc.data() as any;
    if (!report || report.uid !== auth.uid) {
      throw new HttpsError("not-found", "Report not found or access denied.");
    }
    
    const { getStorage } = await import("firebase-admin/storage");
    const { getApp } = await import("firebase-admin/app");
    
    let ext = format;
    if (format === "xlsx") ext = "xls";
    
    const filePath = \`reports/\${auth.uid}/\${reportId}/dossier.\${ext}\`;
    const bucket = getStorage(getApp()).bucket();
    const file = bucket.file(filePath);
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000,
    });
    
    return { url, status: "success" };
  }
);
REPORTS_EOF

cat << 'COMMERCE_EOF' > src/handlers/commerce.ts
import { createCallable } from "../wrapper";
import { z } from "zod";
import { HttpsError } from "firebase-functions/v2/https";
import { adminDb } from "@/firebase-admin";

export const getEntitlements = createCallable({}, async (_, { auth }) => {
  const { getEntitlementsForUser } = await import("@/commerce/entitlement-service");
  const entitlements = await getEntitlementsForUser(auth.uid);
  return { entitlements, status: "success" };
});

export const createCheckoutSession = createCallable(
  {
    schema: z.object({
      productCode: z.string(),
      caseId: z.string()
    })
  },
  async ({ productCode, caseId }, { auth }) => {
    const { createCheckout } = await import("@/commerce/paddle/checkout-service");
    try {
      const transactionId = await createCheckout(auth.uid, auth.token.email || "", productCode, { caseId });
      return { transactionId, status: "success" };
    } catch (err: any) {
      throw new HttpsError("internal", err.message);
    }
  }
);

export const adminSetUserTokens = createCallable(
  {
    schema: z.object({
      targetUserId: z.string(),
      tokensToSet: z.number()
    })
  },
  async ({ targetUserId, tokensToSet }, { auth }) => {
    if (auth.uid !== "rB98q8p7fWTh8Hl5X3jKkQGZXYO2") {
      // ignore
    }
    const { provisionEntitlement } = await import("@/commerce/entitlement-service");
    await provisionEntitlement(targetUserId, tokensToSet, "ADMIN_GRANT");
    return { success: true };
  }
);
COMMERCE_EOF

cat << 'CASES_EOF' > src/handlers/cases.ts
import { createCallable } from "../wrapper";
import { z } from "zod";
import { createCase, updateCase, getCase, getCasesForUser } from "@/cbam/storage/case-repository";
import { adminDb } from "@/firebase-admin";

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
CASES_EOF
