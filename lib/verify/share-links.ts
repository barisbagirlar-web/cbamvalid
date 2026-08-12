import crypto from "node:crypto";
import { adminDb, FieldValue, type DocumentData } from "@/lib/firebase/admin";

const TOKEN_BYTES = 32;
const COLLECTION = "cbam_share_tokens";

export type ShareLinkRecord = {
  reportId: string;
  uid: string;
  label: string;
  createdAt?: unknown;
  revokedAt?: unknown | null;
  opens?: number;
  lastOpenedAt?: unknown | null;
};

export function isValidShareToken(token: string): boolean {
  return /^[a-f0-9]{64}$/i.test(token);
}

export function shareTokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function assertOwnedSealedReport(reportId: string, uid: string): Promise<DocumentData> {
  const snapshot = await adminDb.collection("cbam_reports").doc(reportId).get();
  if (!snapshot.exists) throw new Error("REPORT_NOT_FOUND");
  const data = snapshot.data() as DocumentData;
  if (data.uid !== uid) throw new Error("REPORT_FORBIDDEN");
  if (data.status !== "SEALED") throw new Error("REPORT_NOT_SEALED");
  return data;
}

export async function createShareLink(params: { reportId: string; uid: string; label: string }) {
  await assertOwnedSealedReport(params.reportId, params.uid);
  const label = params.label.trim().slice(0, 120);
  if (!label) throw new Error("SHARE_LABEL_REQUIRED");

  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = shareTokenHash(token);
  await adminDb.collection(COLLECTION).doc(tokenHash).create({
    reportId: params.reportId,
    uid: params.uid,
    label,
    createdAt: FieldValue.serverTimestamp(),
    revokedAt: null,
    opens: 0,
    lastOpenedAt: null,
  } satisfies ShareLinkRecord);
  return { token, tokenId: tokenHash.slice(0, 16), label };
}

export async function listShareLinks(reportId: string, uid: string) {
  await assertOwnedSealedReport(reportId, uid);
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where("reportId", "==", reportId)
    .where("uid", "==", uid)
    .get();
  return snapshot.docs
    .map((doc) => {
      const data = doc.data() as ShareLinkRecord;
      return {
        tokenId: doc.id.slice(0, 16),
        label: data.label,
        createdAt: data.createdAt ?? null,
        revokedAt: data.revokedAt ?? null,
        opens: Number(data.opens || 0),
        lastOpenedAt: data.lastOpenedAt ?? null,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export async function revokeShareLink(params: { reportId: string; uid: string; tokenId: string }) {
  await assertOwnedSealedReport(params.reportId, params.uid);
  const snapshot = await adminDb
    .collection(COLLECTION)
    .where("reportId", "==", params.reportId)
    .where("uid", "==", params.uid)
    .get();
  const match = snapshot.docs.find((doc) => doc.id.startsWith(params.tokenId));
  if (!match) throw new Error("SHARE_TOKEN_NOT_FOUND");
  await match.ref.set({ revokedAt: FieldValue.serverTimestamp() }, { merge: true });
}

export async function resolveShareToken(token: string, countOpen = true) {
  if (!isValidShareToken(token)) return { state: "INVALID" as const };
  const ref = adminDb.collection(COLLECTION).doc(shareTokenHash(token));
  const record = await ref.get();
  if (!record.exists) return { state: "MISSING" as const };
  const data = record.data() as ShareLinkRecord;
  if (data.revokedAt) return { state: "REVOKED" as const };

  const report = await adminDb.collection("cbam_reports").doc(data.reportId).get();
  if (!report.exists) return { state: "MISSING" as const };
  const reportData = report.data() as DocumentData;
  if (reportData.status !== "SEALED") return { state: "MISSING" as const };

  if (countOpen) {
    await ref.set(
      { opens: FieldValue.increment(1), lastOpenedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
  }
  return { state: "ACTIVE" as const, reportId: report.id, reportData, label: data.label };
}
