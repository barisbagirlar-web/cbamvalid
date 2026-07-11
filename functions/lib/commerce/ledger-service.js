"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateEntryHash = calculateEntryHash;
exports.writeLedgerEntry = writeLedgerEntry;
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = require("@/firebase-admin");
/**
 * Computes SHA-256 hash for a ledger entry to enforce chain security
 */
function calculateEntryHash(entry) {
    const dataString = JSON.stringify({
        entryId: entry.entryId,
        uid: entry.uid,
        orderId: entry.orderId,
        transactionId: entry.transactionId,
        eventId: entry.eventId,
        type: entry.type,
        quantity: entry.quantity,
        currency: entry.currency || "",
        amountMinor: entry.amountMinor || 0,
        createdAt: entry.createdAt,
        idempotencyKey: entry.idempotencyKey,
        previousEntryHash: entry.previousEntryHash || "",
    });
    return crypto_1.default.createHash("sha256").update(dataString).digest("hex");
}
/**
 * Appends a new entry to the immutable commerce ledger within a transaction context
 */
async function writeLedgerEntry(dbTransaction, entryParams) {
    const ledgerCollection = firebase_admin_1.adminDb.collection("commerce_ledger");
    // 1. Check if an entry with this idempotency key already exists to prevent duplicate operations
    const existingQuery = await dbTransaction.get(ledgerCollection.where("idempotencyKey", "==", entryParams.idempotencyKey).limit(1));
    if (!existingQuery.empty) {
        const doc = existingQuery.docs[0];
        return doc.data();
    }
    // 2. Fetch the latest ledger entry to construct the chain link
    const latestSnapshot = await dbTransaction.get(ledgerCollection.orderBy("createdAt", "desc").limit(1));
    let previousEntryHash = "";
    if (!latestSnapshot.empty) {
        const latestDoc = latestSnapshot.docs[0].data();
        previousEntryHash = latestDoc.entryHash;
    }
    // 3. Construct the new entry
    const entryId = ledgerCollection.doc().id;
    const createdAt = new Date().toISOString();
    const entryData = Object.assign(Object.assign({}, entryParams), { entryId,
        createdAt,
        previousEntryHash });
    const entryHash = calculateEntryHash(entryData);
    const finalEntry = Object.assign(Object.assign({}, entryData), { entryHash });
    // 4. Save to firestore within the transactional context
    dbTransaction.set(ledgerCollection.doc(entryId), finalEntry);
    return finalEntry;
}
//# sourceMappingURL=ledger-service.js.map