"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issuePreparationPack = issuePreparationPack;
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = require("../firebase-admin");
const ledger_service_1 = require("./ledger-service");
function entitlementIdFor(transactionId, caseId, sequence) {
    const digest = crypto_1.default
        .createHash("sha256")
        .update(`${transactionId}:${caseId}:${sequence}`)
        .digest("hex")
        .slice(0, 32);
    return `ent_${digest}`;
}
/**
 * Issues exactly one entitlement document per successful sealed version.
 *
 * Firestore transactions require every read to occur before the first write.
 * This function therefore preloads all deterministic entitlement documents,
 * then creates the ledger entry, and only then writes missing entitlements.
 * Deterministic IDs make retries idempotent beyond webhook-event deduplication.
 */
async function issuePreparationPack(dbTransaction, params) {
    if (!Number.isInteger(params.versions) || params.versions !== 5) {
        throw new Error("PREPARATION_PACK_VERSION_COUNT_INVALID");
    }
    const now = new Date().toISOString();
    const candidates = Array.from({ length: params.versions }, (_, index) => {
        const versionSequence = index + 1;
        const entitlementId = entitlementIdFor(params.transactionId, params.caseId, versionSequence);
        return {
            versionSequence,
            entitlementId,
            ref: firebase_admin_1.adminDb.collection("entitlements").doc(entitlementId),
        };
    });
    // All entitlement reads happen before writeLedgerEntry performs its first write.
    const snapshots = await Promise.all(candidates.map((candidate) => dbTransaction.get(candidate.ref)));
    const issued = candidates.map((candidate, index) => {
        const snapshot = snapshots[index];
        if (snapshot.exists) {
            const current = snapshot.data();
            if (current.uid !== params.uid ||
                current.orderId !== params.orderId ||
                current.caseId !== params.caseId ||
                current.productCode !== params.productCode ||
                current.versionSequence !== candidate.versionSequence) {
                throw new Error("ENTITLEMENT_IDEMPOTENCY_PAYLOAD_MISMATCH");
            }
            return current;
        }
        return {
            entitlementId: candidate.entitlementId,
            uid: params.uid,
            orderId: params.orderId,
            caseId: params.caseId,
            productCode: params.productCode,
            status: "AVAILABLE",
            quantity: 1,
            versionSequence: candidate.versionSequence,
            createdAt: now,
            updatedAt: now,
        };
    });
    await (0, ledger_service_1.writeLedgerEntry)(dbTransaction, {
        uid: params.uid,
        orderId: params.orderId,
        transactionId: params.transactionId,
        eventId: params.eventId,
        type: "ENTITLEMENT_ISSUED",
        quantity: params.versions,
        idempotencyKey: `preparation-pack:${params.transactionId}:${params.caseId}`,
    });
    candidates.forEach((candidate, index) => {
        if (!snapshots[index].exists) {
            dbTransaction.set(candidate.ref, issued[index]);
        }
    });
    return issued;
}
//# sourceMappingURL=preparation-pack-service.js.map