"use server";

import { requireSuperAdmin } from "@/lib/auth/admin-gate";
import { adminDb, adminAuth, FieldValue } from "@/lib/firebase/admin";
import { logAdminAction } from "@/lib/admin/audit";
import { CANONICAL_PRICING } from "@/lib/billing/pricing-config";

// ----------------------------------------------------------------------
// User Management
// ----------------------------------------------------------------------

export async function fetchAllUsers() {
  await requireSuperAdmin();
  
  const usersSnapshot = await adminDb.collection("users").orderBy("createdAt", "desc").limit(100).get();
  
  // Super admin roles live in admin_identities (custom claims mirror). One read,
  // then map by UID so the list shows the authoritative system role.
  const adminIdentitiesSnap = await adminDb.collection("admin_identities").get();
  const adminRoles = new Map(
    adminIdentitiesSnap.docs.map((docSnap) => [
      docSnap.id,
      String(docSnap.data()?.role ?? "").toLowerCase(),
    ])
  );

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
      role: adminRoles.get(docSnap.id) || String(data.role || "user").toLowerCase(),
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

  // Canonical customer-visible ledger is creditLedger (not legacy users/{uid}/ledger).
  const transactionId = `admin_grant_${Date.now()}`;
  
  await adminDb.runTransaction(async (transaction) => {
    const summaryRef = adminDb.doc(`users/${uid}/creditSummary/current`);
    const summarySnap = await transaction.get(summaryRef);
    const currentCredits = summarySnap.exists
      ? Number(summarySnap.data()?.availableCredits || 0)
      : 0;
    const nextCredits = currentCredits + amount;

    const ledgerRef = adminDb.collection("users").doc(uid).collection("creditLedger").doc(transactionId);
    transaction.set(ledgerRef, {
      uid,
      type: "ADMIN_GRANT",
      amount,
      reason,
      grantedBy: adminClaims.uid,
      createdAt: FieldValue.serverTimestamp(),
      balanceAfter: nextCredits,
    });

    if (!summarySnap.exists) {
      transaction.set(summaryRef, {
        availableCredits: amount,
        lifetimeAdjusted: amount,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      transaction.update(summaryRef, { 
        availableCredits: FieldValue.increment(amount),
        lifetimeAdjusted: FieldValue.increment(amount),
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
    // Accept both canonical creditLedger and legacy ledger for historical grants.
    const canonicalOrigRef = adminDb.doc(`users/${uid}/creditLedger/${originalTransactionId}`);
    const legacyOrigRef = adminDb.doc(`users/${uid}/ledger/${originalTransactionId}`);
    const canonicalOrigSnap = await transaction.get(canonicalOrigRef);
    const legacyOrigSnap = await transaction.get(legacyOrigRef);
    if (!canonicalOrigSnap.exists && !legacyOrigSnap.exists) {
      throw new Error("Original transaction not found in credit ledger");
    }

    const summaryRef = adminDb.doc(`users/${uid}/creditSummary/current`);
    const summarySnap = await transaction.get(summaryRef);
    const currentCredits = summarySnap.exists
      ? Number(summarySnap.data()?.availableCredits || 0)
      : 0;
    const nextCredits = currentCredits - amount;

    const revRef = adminDb.collection("users").doc(uid).collection("creditLedger").doc(reversalId);
    transaction.set(revRef, {
      uid,
      type: "ADMIN_REVERSAL",
      amount: -amount,
      originalTransactionId,
      reason,
      reversedBy: adminClaims.uid,
      createdAt: FieldValue.serverTimestamp(),
      balanceAfter: nextCredits,
    });

    transaction.set(summaryRef, {
      availableCredits: nextCredits,
      lifetimeAdjusted: FieldValue.increment(-amount),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
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
    // Pack list price from CANONICAL_PRICING SSOT (amountMinor is minor units → /100).
    monthlyRevenue: reportsCount * (CANONICAL_PRICING.amountMinor / 100),
  };
}

// ----------------------------------------------------------------------
// Entitlements
// ----------------------------------------------------------------------

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in (value as object)) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export async function fetchAllEntitlements() {
  await requireSuperAdmin();

  const snapshot = await adminDb
    .collection("entitlements")
    .orderBy("createdAt", "desc")
    .limit(200)
    .get();

  return snapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      entitlementId: d.entitlementId || docSnap.id,
      uid: String(d.uid || ""),
      orderId: String(d.orderId || ""),
      productCode: String(d.productCode || ""),
      status: String(d.status || "UNKNOWN"),
      billingModel: String(d.billingModel || "LEGACY_PACK"),
      quantity: Number(d.quantity || 0),
      releasesCount: Number(d.releasesCount || 0),
      maxReleases: Number(d.maxReleases || 0),
      scopeCaseId: d.scopeCaseId ? String(d.scopeCaseId) : null,
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
      releasesList: Array.isArray(d.releasesList) ? d.releasesList : [],
    };
  });
}

// ----------------------------------------------------------------------
// Cases
// ----------------------------------------------------------------------

export async function fetchAllCases() {
  await requireSuperAdmin();

  const snapshot = await adminDb
    .collection("cbam_cases")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return snapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    const inner = (d?.data && typeof d.data === "object" ? d.data : {}) as Record<string, unknown>;
    return {
      caseId: d.caseId || docSnap.id,
      uid: String(d.uid || ""),
      releaseStatus: String(d.releaseStatus || "DRAFT"),
      reportingYear: String(d.reportingYear || ""),
      installationName:
        typeof inner?.installation === "object" &&
        (inner.installation as Record<string, unknown>)?.name &&
        typeof ((inner.installation as Record<string, unknown>).name as Record<string, unknown>)?.value === "string"
          ? String(((inner.installation as Record<string, unknown>).name as Record<string, unknown>).value)
          : "",
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
    };
  });
}

export async function fetchCaseDetail(caseId: string) {
  await requireSuperAdmin();

  const docSnap = await adminDb.collection("cbam_cases").doc(caseId).get();
  if (!docSnap.exists) return null;
  const d = docSnap.data() || {};
  const inner = (d?.data && typeof d.data === "object" ? d.data : {}) as Record<string, unknown>;
  return {
    caseId: d.caseId || docSnap.id,
    uid: String(d.uid || ""),
    releaseStatus: String(d.releaseStatus || "DRAFT"),
    reportingYear: String(d.reportingYear || ""),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    raw: d,
    installation: (inner.installation || {}) as Record<string, unknown>,
    goods: Array.isArray(inner.goods) ? inner.goods : [],
  };
}

// ----------------------------------------------------------------------
// Reports
// ----------------------------------------------------------------------

export async function fetchAllReports() {
  await requireSuperAdmin();

  const snapshot = await adminDb
    .collection("cbam_reports")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  return snapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      reportId: d.reportId || docSnap.id,
      uid: String(d.uid || ""),
      caseId: String(d.caseId || ""),
      status: String(d.status || "UNKNOWN"),
      releaseVersion: Number(d.releaseVersion || 1),
      installationName: String(d.installationName || ""),
      createdAt: toIso(d.createdAt),
      documentHash: String(d.documentHash || ""),
    };
  });
}

export async function fetchReportDetail(reportId: string) {
  await requireSuperAdmin();

  const docSnap = await adminDb.collection("cbam_reports").doc(reportId).get();
  if (!docSnap.exists) return null;
  const d = docSnap.data() || {};
  return {
    reportId: d.reportId || docSnap.id,
    uid: String(d.uid || ""),
    caseId: String(d.caseId || ""),
    entitlementId: String(d.entitlementId || ""),
    status: String(d.status || "UNKNOWN"),
    releaseVersion: Number(d.releaseVersion || 1),
    installationName: String(d.installationName || ""),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    documentHash: String(d.documentHash || ""),
    manifestHash: String(d.manifestHash || ""),
    packageHash: String(d.packageHash || ""),
    calculation: (d.calculation || {}) as Record<string, unknown>,
    packageMetadata: (d.packageMetadata || {}) as Record<string, unknown>,
  };
}

// ----------------------------------------------------------------------
// Webhook events
// ----------------------------------------------------------------------

export async function fetchWebhookEvents() {
  await requireSuperAdmin();

  const snapshot = await adminDb
    .collection("paddle_events")
    .orderBy("receivedAt", "desc")
    .limit(100)
    .get();

  return snapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      eventId: d.eventId || docSnap.id,
      eventType: String(d.eventType || ""),
      processingState: String(d.processingState || "UNKNOWN"),
      signatureVerified: d.signatureVerified === true,
      attempts: Number(d.attempts || 0),
      occurredAt: toIso(d.occurredAt),
      receivedAt: toIso(d.receivedAt),
    };
  });
}

// ----------------------------------------------------------------------
// Audit log
// ----------------------------------------------------------------------

export async function fetchAuditLog() {
  await requireSuperAdmin();

  const snapshot = await adminDb
    .collection("admin_audit_log")
    .orderBy("timestamp", "desc")
    .limit(200)
    .get();

  return snapshot.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      adminId: String(d.adminId || ""),
      adminEmail: String(d.adminEmail || ""),
      action: String(d.action || ""),
      targetType: String(d.targetType || ""),
      targetId: String(d.targetId || ""),
      details: (d.details || {}) as Record<string, unknown>,
      timestamp: toIso(d.timestamp),
    };
  });
}

// ----------------------------------------------------------------------
// System health
// ----------------------------------------------------------------------

export async function fetchSystemHealth() {
  await requireSuperAdmin();

  const [usersCount, casesCount, reportsCount, sealedCount, entitlementsCount, eventsCount, identitiesCount] =
    await Promise.all([
      adminDb.collection("users").count().get(),
      adminDb.collection("cbam_cases").count().get(),
      adminDb.collection("cbam_reports").count().get(),
      adminDb.collection("cbam_reports").where("status", "==", "SEALED").count().get(),
      adminDb.collection("entitlements").count().get(),
      adminDb.collection("paddle_events").count().get(),
      adminDb.collection("admin_identities").count().get(),
    ]);

  const configSnap = await adminDb.collection("system").doc("config").get();
  const config = configSnap.exists ? configSnap.data() : {};

  return {
    users: usersCount.data().count,
    cases: casesCount.data().count,
    reports: reportsCount.data().count,
    sealedReports: sealedCount.data().count,
    entitlements: entitlementsCount.data().count,
    webhookEvents: eventsCount.data().count,
    adminIdentities: identitiesCount.data().count,
    publicPaidLaunchEnabled: config?.publicPaidLaunchEnabled === true,
    version: String(config?.version || "unset"),
  };
}

// ----------------------------------------------------------------------
// Security overview
// ----------------------------------------------------------------------

export async function fetchSecurityOverview() {
  await requireSuperAdmin();

  const identitiesSnap = await adminDb.collection("admin_identities").get();
  const identities = identitiesSnap.docs.map((docSnap) => ({
    uid: docSnap.id,
    email: String(docSnap.data()?.email || ""),
    role: String(docSnap.data()?.role || ""),
    owner: docSnap.data()?.owner === true,
  }));

  const configSnap = await adminDb.collection("system").doc("config").get();
  const config = configSnap.exists ? configSnap.data() : {};

  return {
    adminIdentities: identities,
    publicPaidLaunchEnabled: config?.publicPaidLaunchEnabled === true,
    requireEmailVerification: config?.requireEmailVerification !== false,
  };
}

// ----------------------------------------------------------------------
// Billing & purchases overview
// ----------------------------------------------------------------------

export async function fetchBillingOverview() {
  await requireSuperAdmin();

  const [entitlementsSnap, sealedReportsSnap, eventsSnap] = await Promise.all([
    adminDb.collection("entitlements").orderBy("createdAt", "desc").limit(200).get(),
    adminDb.collection("cbam_reports").where("status", "==", "SEALED").get(),
    adminDb
      .collection("paddle_events")
      .where("eventType", "in", [
        "transaction.completed",
        "transaction.paid",
        "transaction.updated",
      ])
      .limit(200)
      .get(),
  ]);

  const entitlements = entitlementsSnap.docs.map((docSnap) => {
    const d = docSnap.data();
    return {
      entitlementId: d.entitlementId || docSnap.id,
      uid: String(d.uid || ""),
      orderId: String(d.orderId || ""),
      productCode: String(d.productCode || ""),
      status: String(d.status || "UNKNOWN"),
      billingModel: String(d.billingModel || "LEGACY_PACK"),
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
    };
  });

  const unitPrice = CANONICAL_PRICING.amountMinor / 100;
  const sealedCount = sealedReportsSnap.size;
  const completedEvents = eventsSnap.docs.filter((doc) =>
    String(doc.data()?.processingState || "") !== "DUPLICATE_OR_FAILED"
  ).length;

  return {
    entitlements,
    sealedCount,
    estimatedGrossRevenue: sealedCount * unitPrice,
    unitPrice,
    completedWebhookCount: completedEvents,
    lastEventAt: eventsSnap.docs.length > 0 ? toIso(eventsSnap.docs[0].data()?.receivedAt) : null,
  };
}

// ----------------------------------------------------------------------
// Settings (system config)
// ----------------------------------------------------------------------

export async function fetchSettings() {
  await requireSuperAdmin();

  const configSnap = await adminDb.collection("system").doc("config").get();
  const config = configSnap.exists ? configSnap.data() : {};
  return {
    publicPaidLaunchEnabled: config?.publicPaidLaunchEnabled === true,
    version: String(config?.version || "unset"),
    updatedAt: toIso(config?.updatedAt),
    raw: config,
  };
}

export async function updateSettings(input: { publicPaidLaunchEnabled: boolean; reason: string }) {
  const adminClaims = await requireSuperAdmin();
  if (!input.reason || input.reason.length < 5) throw new Error("A valid reason is required");

  await adminDb.collection("system").doc("config").set(
    {
      publicPaidLaunchEnabled: input.publicPaidLaunchEnabled,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: adminClaims.uid,
    },
    { merge: true }
  );

  await logAdminAction(adminClaims, "UPDATE_SYSTEM_SETTINGS", "system", "config", {
    publicPaidLaunchEnabled: input.publicPaidLaunchEnabled,
    reason: input.reason,
  });

  return { success: true };
}
