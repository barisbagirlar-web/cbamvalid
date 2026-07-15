"use server";

import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb, adminAuth } from "@/lib/firebase/admin";
import { logAdminAction } from "@/lib/admin/audit";
import {
  grantAccountCredits,
  reverseAccountCreditGrant,
} from "@/lib/admin/credit-service.server";

export async function fetchAllUsers() {
  await requireSuperAdmin();
  const snapshot = await adminDb.collection("users").orderBy("createdAt", "desc").limit(100).get();
  return Promise.all(snapshot.docs.map(async (document) => {
    const data = document.data() as Record<string, unknown>;
    const creditSnapshot = await adminDb.doc(`users/${document.id}/creditSummary/current`).get();
    const credits = Number(creditSnapshot.data()?.availableCredits || 0);
    return {
      id: document.id,
      email: typeof data.email === "string" ? data.email : "",
      displayName: typeof data.displayName === "string" ? data.displayName : "",
      credits: Number.isSafeInteger(credits) && credits >= 0 ? credits : 0,
      createdAt:
        typeof data.createdAt === "object" && data.createdAt && "toDate" in data.createdAt
          ? (data.createdAt as { toDate: () => Date }).toDate().toISOString()
          : null,
      role: typeof data.role === "string" ? data.role : "user",
    };
  }));
}

export async function fetchUserDetails(uid: string) {
  await requireSuperAdmin();
  const userRecord = await adminAuth.getUser(uid).catch(() => null);
  if (!userRecord) throw new Error("USER_NOT_FOUND");
  const [userDocument, creditSnapshot] = await Promise.all([
    adminDb.collection("users").doc(uid).get(),
    adminDb.doc(`users/${uid}/creditSummary/current`).get(),
  ]);
  return {
    auth: {
      uid: userRecord.uid,
      email: userRecord.email,
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime,
      customClaims: userRecord.customClaims || {},
    },
    profile: userDocument.data() || {},
    credits: Number(creditSnapshot.data()?.availableCredits || 0),
  };
}

export async function grantCredits(
  uid: string,
  amount: number,
  reason: string,
  requestId: string
) {
  const adminClaims = await requireSuperAdmin();
  const result = await grantAccountCredits({
    uid,
    amount,
    reason,
    requestId,
    actorUid: adminClaims.uid,
  });
  await logAdminAction(adminClaims, "GRANT_CREDITS", "user", uid, {
    amount,
    reason,
    requestId,
    idempotent: result.idempotent,
  });
  return { success: true, ...result };
}

export async function reverseCreditGrant(
  uid: string,
  amount: number,
  originalTransactionId: string,
  reason: string,
  requestId: string
) {
  const adminClaims = await requireSuperAdmin();
  const result = await reverseAccountCreditGrant({
    uid,
    amount,
    originalTransactionId,
    reason,
    requestId,
    actorUid: adminClaims.uid,
  });
  await logAdminAction(adminClaims, "REVERSE_CREDITS", "user", uid, {
    amount,
    reason,
    originalTransactionId,
    requestId,
    idempotent: result.idempotent,
  });
  return { success: true, ...result };
}

export async function fetchSystemMetrics() {
  await requireSuperAdmin();
  const [users, reports, paidOrders] = await Promise.all([
    adminDb.collection("users").count().get(),
    adminDb.collection("cbam_reports").where("status", "==", "SEALED").count().get(),
    adminDb.collection("commerce_orders").where("status", "==", "ENTITLED").get(),
  ]);
  const grossRevenueMinor = paidOrders.docs.reduce((sum, document) => {
    const amount = Number(document.data()?.amountMinor || 0);
    return Number.isSafeInteger(amount) && amount >= 0 ? sum + amount : sum;
  }, 0);
  return {
    totalUsers: users.data().count,
    sealedReports: reports.data().count,
    paidOrders: paidOrders.size,
    grossRevenueUsd: grossRevenueMinor / 100,
  };
}
