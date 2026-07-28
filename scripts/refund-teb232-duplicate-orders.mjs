#!/usr/bin/env node
/**
 * One-shot owner repair: refund teb232@gmail.com duplicate $249 sandbox charges
 * caused by empty purchase-history UX (keep earliest legitimate payment).
 *
 * Keep:  ord_4a50356c60a0afe704c7e971 / txn_01kyj9trdrc6mwy8mjvz773ebm (2026-07-27T17:26)
 * Refund: ord_96f49c7b955424581aaecd92 / txn_01kyjgy8s7nrxt0h2w8f3z92xc
 * Refund: ord_40dbbc5599e3c8522e6b0c20 / txn_01kyjgzq8xrd6wah96q8rwvpdq
 *
 * Usage:
 *   PADDLE_API_KEY=... node scripts/refund-teb232-duplicate-orders.mjs
 *   DRY_RUN=1 ...  (default) inspect only
 *   EXECUTE=1 ...  create full Paddle refunds + mark Firestore
 */
import admin from "firebase-admin";
import { Paddle, Environment } from "@paddle/paddle-node-sdk";

const UID = "r3Sv0U5YqEcLLylbw5ndwK1Zg652";
const KEEP_ORDER_ID = "ord_4a50356c60a0afe704c7e971";
const DUPLICATES = [
  {
    orderId: "ord_96f49c7b955424581aaecd92",
    transactionId: "txn_01kyjgy8s7nrxt0h2w8f3z92xc",
    entitlementHint: "ELQNz5YTn9xUuUbo9MKJ",
  },
  {
    orderId: "ord_40dbbc5599e3c8522e6b0c20",
    transactionId: "txn_01kyjgzq8xrd6wah96q8rwvpdq",
    entitlementHint: "RO28dw4tlQm15I8DyKCq",
  },
];

const execute = process.env.EXECUTE === "1";
const apiKey = process.env.PADDLE_API_KEY || "";
if (!apiKey) {
  console.error("PADDLE_API_KEY required");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "cbam-desk",
  });
}
const db = admin.firestore();
const paddle = new Paddle(apiKey, { environment: Environment.sandbox });

async function revokeEntitlementsForOrder(orderId) {
  const snap = await db.collection("entitlements").where("orderId", "==", orderId).get();
  const now = new Date().toISOString();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (data.status === "REVOKED" || data.status === "REFUNDED") continue;
    if (data.status === "CONSUMED") {
      console.log("SKIP_CONSUMED_ENTITLEMENT", doc.id, orderId);
      continue;
    }
    await doc.ref.set(
      {
        status: "REVOKED",
        revokedAt: now,
        revokeReason: "DUPLICATE_CHARGE_REFUND_TEB232",
        updatedAt: now,
      },
      { merge: true }
    );
    console.log("REVOKED_ENTITLEMENT", doc.id, orderId);
  }
}

async function markOrderRefunded(orderId, adjustmentId) {
  const now = new Date().toISOString();
  await db
    .collection("commerce_orders")
    .doc(orderId)
    .set(
      {
        status: "REFUNDED_UNUSED",
        refundedAt: now,
        adjustmentId,
        refundReason: "DUPLICATE_CHARGE_AFTER_PURCHASE_HISTORY_BUG",
        updatedAt: now,
      },
      { merge: true }
    );
  console.log("ORDER_MARKED_REFUNDED", orderId, adjustmentId);
}

async function main() {
  console.log(JSON.stringify({ mode: execute ? "EXECUTE" : "DRY_RUN", uid: UID, keep: KEEP_ORDER_ID }));

  const keep = await db.collection("commerce_orders").doc(KEEP_ORDER_ID).get();
  console.log("KEEP_ORDER", KEEP_ORDER_ID, keep.exists ? keep.data()?.status : "MISSING");

  for (const dup of DUPLICATES) {
    const order = await db.collection("commerce_orders").doc(dup.orderId).get();
    const status = order.exists ? order.data()?.status : "MISSING";
    console.log("DUP_ORDER", dup.orderId, status, dup.transactionId);

    if (!execute) continue;
    if (status === "REFUNDED_UNUSED" || status === "REFUNDED_AFTER_DELIVERY" || status === "REFUNDED") {
      console.log("ALREADY_REFUNDED", dup.orderId);
      await revokeEntitlementsForOrder(dup.orderId);
      continue;
    }

    const adjustment = await paddle.adjustments.create({
      action: "refund",
      type: "full",
      transactionId: dup.transactionId,
      reason: "Duplicate $249 charge after purchase-history bug; keep earliest payment only.",
    });
    console.log("PADDLE_REFUND_CREATED", {
      orderId: dup.orderId,
      adjustmentId: adjustment.id,
      status: adjustment.status,
    });
    await revokeEntitlementsForOrder(dup.orderId);
    await markOrderRefunded(dup.orderId, adjustment.id);
  }

  if (!execute) {
    console.log("DRY_RUN_COMPLETE — re-run with EXECUTE=1 to refund.");
  } else {
    console.log("EXECUTE_COMPLETE");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
