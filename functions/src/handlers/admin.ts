import { createCallable } from "../wrapper";
import { adminDb } from "../firebase-admin";
import { requireCanonicalOwner } from "../auth/owner-contract";
import { FieldPath } from "firebase-admin/firestore";
import {
  AdminListTransactionsInputSchema,
  AdminListUsersInputSchema,
  AdminSetUserTokensInputSchema,
  decodeUserPageToken,
  encodeUserPageToken,
} from "../admin/user-pagination";

export const listAllUsers = createCallable({
  schema: AdminListUsersInputSchema
}, async (data, { auth }) => {
  requireCanonicalOwner(auth);

  const limit = data?.limit || 100;
  let query = adminDb
    .collection("users")
    .orderBy(FieldPath.documentId())
    .limit(limit + 1);

  if (data?.pageToken) {
    const cursor = decodeUserPageToken(data.pageToken);
    query = query.startAfter(cursor.documentId);
  }

  const snapshot = await query.get();
  const pageDocuments = snapshot.docs.slice(0, limit);
  const users = await Promise.all(pageDocuments.map(async (doc) => {
    const profile = doc.data();
    const creditSnap = await adminDb.collection("users").doc(doc.id).collection("creditSummary").doc("current").get();
    const credits = creditSnap.exists ? creditSnap.data() : { availableCredits: 0 };

    return {
      id: doc.id,
      email: profile.email || "",
      displayName: profile.displayName || "",
      credits: credits?.availableCredits || 0,
      role: profile.role || "user"
    };
  }));

  const nextPageToken =
    snapshot.docs.length > limit && pageDocuments.length > 0
      ? encodeUserPageToken(pageDocuments[pageDocuments.length - 1].id)
      : undefined;

  return { users, nextPageToken };
});

export const listAllTransactions = createCallable({
  schema: AdminListTransactionsInputSchema
}, async (data, { auth }) => {
  requireCanonicalOwner(auth);
  const { toCustomerPurchaseRecord } = await import("../commerce/purchase-history");
  const limitCount = data?.limit || 100;

  try {
    const snapshot = await adminDb
      .collection("commerce_orders")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();
    return {
      transactions: snapshot.docs.map((doc) => ({
        ...toCustomerPurchaseRecord(doc.id, doc.data() as Record<string, unknown>),
        uid: String((doc.data() as { uid?: string }).uid || ""),
      })),
    };
  } catch (error) {
    console.warn("listAllTransactions orderBy fallback", error);
    const snapshot = await adminDb.collection("commerce_orders").limit(limitCount).get();
    const rows = snapshot.docs
      .map((doc) => ({
        ...toCustomerPurchaseRecord(doc.id, doc.data() as Record<string, unknown>),
        uid: String((doc.data() as { uid?: string }).uid || ""),
      }))
      .sort((a, b) => Date.parse(b.occurredAt || "0") - Date.parse(a.occurredAt || "0"));
    return { transactions: rows };
  }
});

export const adminSetUserTokens = createCallable({
  schema: AdminSetUserTokensInputSchema
}, async ({ targetUserId, tokensToSet }, { auth }) => {
  requireCanonicalOwner(auth);

  const creditRef = adminDb.collection("users").doc(targetUserId).collection("creditSummary").doc("current");
  const ledgerRef = adminDb.collection("users").doc(targetUserId).collection("creditLedger").doc();

  await adminDb.runTransaction(async (t) => {
    const doc = await t.get(creditRef);
    let currentCredits = 0;
    if (doc.exists) {
      currentCredits = doc.data()?.availableCredits || 0;
    }

    const diff = tokensToSet - currentCredits;
    if (diff === 0) return;

    t.set(creditRef, {
      availableCredits: tokensToSet,
      updatedAt: new Date().toISOString()
    }, { merge: true });

    t.set(ledgerRef, {
      amount: diff,
      type: diff > 0 ? "ADMIN_ADJUSTMENT_ADD" : "ADMIN_ADJUSTMENT_SUBTRACT",
      createdAt: new Date().toISOString(),
      balanceAfter: tokensToSet,
      reason: `Manual adjustment by admin ${auth.token.email}`
    });
  });

  return { success: true };
});
