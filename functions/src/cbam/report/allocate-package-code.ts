import { adminDb } from "../../firebase-admin";
import {
  PACKAGE_CODE_PATTERN,
  derivePackageCodeCandidate,
  type PackageCode,
} from "./package-code";

const MAX_ATTEMPTS = 2000;

export async function allocatePackageCode(params: {
  digest: string;
  reportId: string;
  uid: string;
}): Promise<PackageCode> {
  const existingReport = await adminDb.collection("cbam_reports").doc(params.reportId).get();
  const stored = existingReport.data()?.packageCode;
  if (typeof stored === "string" && PACKAGE_CODE_PATTERN.test(stored)) {
    return stored as PackageCode;
  }

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const code = derivePackageCodeCandidate(params.digest, attempt);
    const ref = adminDb.collection("package_codes").doc(code);
    try {
      await adminDb.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(ref);
        if (snapshot.exists) {
          const data = snapshot.data() as { reportId?: string };
          if (data.reportId === params.reportId) return;
          throw new Error("PACKAGE_CODE_TAKEN");
        }
        transaction.set(ref, {
          packageCode: code,
          reportId: params.reportId,
          uid: params.uid,
          digest: params.digest,
          createdAt: new Date().toISOString(),
        });
      });
      return code;
    } catch (error) {
      if (error instanceof Error && error.message === "PACKAGE_CODE_TAKEN") continue;
      throw error;
    }
  }

  throw new Error("PACKAGE_CODE_ALLOCATION_EXHAUSTED");
}
