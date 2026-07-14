"use server";

import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb, adminAuth, FieldValue } from "@/lib/firebase/admin";
import { logAdminAction } from "@/lib/admin/audit";

// ----------------------------------------------------------------------
// User Management
// ----------------------------------------------------------------------

export async function fetchAllUsers() {
  await requireSuperAdmin();
  
  const usersSnapshot = await adminDb.collection("users").orderBy("createdAt", "desc").limit(100).get();
  
  return Promise.all(usersSnapshot.docs.map(async (docSnap) => {
    const data = docSnap.data();
    
    // Fetch live credits
    const creditSnap = await adminDb.doc(`users/${docSnap.id}/creditSummary/current`).get();
    const credits = creditSnap.exists ? creditSnap.data()?.availableCredits || 0 : 0;
    
    return {
      id: docSnap.id,
      email: data.email,
      displayName: data.displayName || "",
      credits,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      role: data.role || "user",
    };
  }));
}

export async function fetchUserDetails(uid: string) {
  await requireSuperAdmin();
  
  const userRecord = await adminAuth.getUser(uid).catch(() => null);
  if (!userRecord) throw new Error("User not found");

  const userDoc = await adminDb.collection("users").doc(uid).get();
  const creditSnap = await adminDb.doc(`users/${uid}/creditSummary/current`).get();
  
  return {
    auth: {
      uid: userRecord.uid,
      email: userRecord.email,
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime,
      customClaims: userRecord.customClaims || {},
    },
    profile: userDoc.data() || {},
    credits: creditSnap.exists ? creditSnap.data()?.availableCredits || 0 : 0,
  };
}

// ----------------------------------------------------------------------
// Credit Economy (Grant & Reverse)
// ----------------------------------------------------------------------

export async function grantCredits(uid: string, amount: number, reason: string) {
  const adminClaims = await requireSuperAdmin();
  
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  if (!reason || reason.length < 5) throw new Error("A valid reason is required");

  // Create a synthetic ledger entry for the manual grant
  const transactionId = `admin_grant_${Date.now()}`;
  
  await adminDb.runTransaction(async (transaction) => {
    // 1. Add ledger entry
    const ledgerRef = adminDb.collection("users").doc(uid).collection("ledger").doc(transactionId);
    transaction.set(ledgerRef, {
      type: "ADMIN_GRANT",
      amount,
      reason,
      grantedBy: adminClaims.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. Update credit summary
    const summaryRef = adminDb.doc(`users/${uid}/creditSummary/current`);
    const summarySnap = await transaction.get(summaryRef);
    
    if (!summarySnap.exists) {
      transaction.set(summaryRef, { availableCredits: amount, updatedAt: FieldValue.serverTimestamp() });
    } else {
      transaction.update(summaryRef, { 
        availableCredits: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp()
      });
    }
  });

  await logAdminAction(adminClaims, "GRANT_CREDITS", "user", uid, { amount, reason, transactionId });
  
  return { success: true, transactionId };
}

export async function reverseCreditGrant(uid: string, amount: number, originalTransactionId: string, reason: string) {
  const adminClaims = await requireSuperAdmin();
  
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  
  const reversalId = `admin_reversal_${Date.now()}`;

  await adminDb.runTransaction(async (transaction) => {
    // 1. Verify original transaction exists
    const origRef = adminDb.doc(`users/${uid}/ledger/${originalTransactionId}`);
    const origSnap = await transaction.get(origRef);
    if (!origSnap.exists) throw new Error("Original transaction not found in ledger");

    // 2. Write reversal ledger entry
    const revRef = adminDb.collection("users").doc(uid).collection("ledger").doc(reversalId);
    transaction.set(revRef, {
      type: "ADMIN_REVERSAL",
      amount: -amount,
      originalTransactionId,
      reason,
      reversedBy: adminClaims.uid,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 3. Deduct from credit summary
    const summaryRef = adminDb.doc(`users/${uid}/creditSummary/current`);
    transaction.update(summaryRef, { 
      availableCredits: FieldValue.increment(-amount),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  await logAdminAction(adminClaims, "REVERSE_CREDITS", "user", uid, { amount, reason, originalTransactionId, reversalId });

  return { success: true, reversalId };
}

// ----------------------------------------------------------------------
// Metrics & Overviews
// ----------------------------------------------------------------------

export async function fetchSystemMetrics() {
  await requireSuperAdmin();
  
  // Basic metric fetching (in production this would use aggregations or specialized reporting tables)
  const usersCount = (await adminDb.collection("users").count().get()).data().count;
  const reportsCount = (await adminDb.collection("cbam_reports").where("status", "==", "SEALED").count().get()).data().count;
  
  return {
    totalUsers: usersCount,
    sealedReports: reportsCount,
    monthlyRevenue: reportsCount * 150, // Approximation based on existing client logic
  };
}
