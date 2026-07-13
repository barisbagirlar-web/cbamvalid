import crypto from "crypto";
import admin from "firebase-admin";
import { adminDb } from "../firebase-admin";
import { writeLedgerEntry } from "./ledger-service";

export interface PreparationPackEntitlement {
  entitlementId: string;
  uid: string;
  orderId: string;
  caseId: string;
  productCode: string;
  status: "AVAILABLE" | "RESERVED" | "CONSUMED" | "REVOKED";
  quantity: 1;
  versionSequence: number;
  createdAt: string;
  updatedAt: string;
}

function entitlementIdFor(transactionId: string, caseId: string, sequence: number): string {
  const digest = crypto
    .createHash("sha256")
    .update(`${transactionId}:${caseId}:${sequence}`)
    .digest("hex")
    .slice(0, 32);
  return `ent_${digest}`;
}

/**
 * Issues exactly one entitlement document per successful sealed version.
 * Deterministic IDs make webhook retries idempotent even beyond event-ID
 * deduplication.
 */
export async function issuePreparationPack(
  dbTransaction: admin.firestore.Transaction,
  params: {
    uid: string;
    orderId: string;
    caseId: string;
    transactionId: string;
    eventId: string;
    productCode: string;
    versions: number;
  }
): Promise<PreparationPackEntitlement[]> {
  if (!Number.isInteger(params.versions) || params.versions !== 5) {
    throw new Error("PREPARATION_PACK_VERSION_COUNT_INVALID");
  }

  const now = new Date().toISOString();
  const issued: PreparationPackEntitlement[] = [];

  for (let sequence = 1; sequence <= params.versions; sequence++) {
    const entitlementId = entitlementIdFor(params.transactionId, params.caseId, sequence);
    const entitlementRef = adminDb.collection("entitlements").doc(entitlementId);
    const existing = await dbTransaction.get(entitlementRef);

    const entitlement: PreparationPackEntitlement = {
      entitlementId,
      uid: params.uid,
      orderId: params.orderId,
      caseId: params.caseId,
      productCode: params.productCode,
      status: "AVAILABLE",
      quantity: 1,
      versionSequence: sequence,
      createdAt: now,
      updatedAt: now,
    };

    if (existing.exists) {
      const current = existing.data() as PreparationPackEntitlement;
      if (
        current.uid !== params.uid ||
        current.orderId !== params.orderId ||
        current.caseId !== params.caseId ||
        current.versionSequence !== sequence
      ) {
        throw new Error("ENTITLEMENT_IDEMPOTENCY_PAYLOAD_MISMATCH");
      }
      issued.push(current);
      continue;
    }

    dbTransaction.set(entitlementRef, entitlement);
    issued.push(entitlement);
  }

  await writeLedgerEntry(dbTransaction, {
    uid: params.uid,
    orderId: params.orderId,
    transactionId: params.transactionId,
    eventId: params.eventId,
    type: "ENTITLEMENT_ISSUED",
    quantity: params.versions,
    idempotencyKey: `preparation-pack:${params.transactionId}:${params.caseId}`,
  });

  return issued;
}
