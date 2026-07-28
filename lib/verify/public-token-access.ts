import crypto from "crypto";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export type PublicTokenReport = {
  id: string;
  data: DocumentData;
};

export function hashPublicToken(publicToken: string): string {
  return crypto.createHash("sha256").update(publicToken).digest("hex");
}

export function isValidPublicTokenFormat(publicToken: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(publicToken);
}

export async function findActiveReportByPublicToken(
  publicToken: string
): Promise<PublicTokenReport | null> {
  const publicVerificationTokenHash = hashPublicToken(publicToken);
  const querySnap = await adminDb
    .collection("cbam_reports")
    .where("publicVerificationTokenHash", "==", publicVerificationTokenHash)
    .where("publicVerificationState", "==", "ACTIVE")
    .limit(1)
    .get();

  if (querySnap.empty) return null;
  return { id: querySnap.docs[0].id, data: querySnap.docs[0].data() };
}

/**
 * Append-only buyer view event for the exporter’s viral loop (T4.1).
 * Stores no buyer email; UA truncated; IP hashed when present.
 */
export async function logBuyerShareView(params: {
  reportId: string;
  userAgent: string | null;
  forwardedFor: string | null;
  event: "VIEW" | "DOWNLOAD";
}): Promise<void> {
  const ua = (params.userAgent || "").slice(0, 180);
  const ipHash = params.forwardedFor
    ? crypto
        .createHash("sha256")
        .update(params.forwardedFor.split(",")[0].trim())
        .digest("hex")
        .slice(0, 32)
    : null;

  await adminDb
    .collection("cbam_reports")
    .doc(params.reportId)
    .collection("buyer_share_events")
    .add({
      event: params.event,
      viewedAt: FieldValue.serverTimestamp(),
      userAgent: ua || null,
      ipHash,
      productBrand: "CBAMValid",
    });

  await adminDb.collection("cbam_reports").doc(params.reportId).set(
    {
      buyerShareViewCount: FieldValue.increment(params.event === "VIEW" ? 1 : 0),
      buyerShareDownloadCount: FieldValue.increment(params.event === "DOWNLOAD" ? 1 : 0),
      buyerShareLastViewedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

export function buildBuyerShareMetadata(reportData: DocumentData) {
  const calculation = (reportData.calculation || {}) as DocumentData;
  const totals = (calculation.totals || {}) as DocumentData;
  const goods = calculation.goods as Record<string, unknown> | undefined;

  const documentHash =
    (reportData.documentHash as string | undefined) ||
    ((reportData.seal as DocumentData | undefined)?.documentHash as string | undefined) ||
    ((reportData.integrity as DocumentData | undefined)?.documentHash as string | undefined) ||
    null;

  return {
    reportId: reportData.reportId,
    releaseVersion: reportData.releaseVersion,
    createdAt: reportData.createdAt,
    updatedAt: reportData.updatedAt,
    dossierSchemaVersion: reportData.dossierSchemaVersion || "CBAMVALID-DOSSIER-5.0",
    operatorReadinessStatus: reportData.operatorReadinessStatus,
    readinessScore: reportData.readinessScore,
    criticalBlockerCount: reportData.criticalBlockerCount,
    materialFindingCount: reportData.materialFindingCount,
    openFindingCount: reportData.openFindingCount,
    evidenceCoverage: reportData.evidenceCoverage,
    crosswalkCoverage: reportData.crosswalkCoverage || "100.00",
    installationName:
      calculation.installationName || reportData.installationName || "Controlled Installation",
    country: calculation.country || "",
    productionRoute: calculation.productionRoute || "",
    reportingPeriod: calculation.reportingPeriod || "",
    totalEmbeddedEmissions: totals.totalEmbeddedEmissions || "0.00",
    specificEmbeddedEmissions: totals.aggregateSpecificEmbeddedEmissions || "0.00",
    goodsCount: goods ? Object.keys(goods).length : 0,
    rulesetVersion: reportData.rulesetVersion || null,
    sourceHash: reportData.sourceHash || null,
    documentHash,
    publicVerificationState: reportData.publicVerificationState || "ACTIVE",
    brand: "CBAMValid",
    independenceBoundary:
      "Operator-prepared verifier-preparation pack — not an accredited verification opinion.",
  };
}
