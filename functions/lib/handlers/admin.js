"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSetUserTokens = exports.listAllTransactions = exports.listAllUsers = void 0;
const wrapper_1 = require("../wrapper");
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const firebase_admin_1 = require("../firebase-admin");
function requireAdmin(auth) {
    if (auth.token.admin !== true && auth.token.ownerAdmin !== true) {
        throw new https_1.HttpsError("permission-denied", "Requires administrator privileges.");
    }
}
exports.listAllUsers = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        limit: zod_1.z.number().max(500).default(100),
        pageToken: zod_1.z.string().optional()
    }).optional()
}, async (data, { auth }) => {
    requireAdmin(auth);
    let query = firebase_admin_1.adminDb.collection("users").orderBy("email").limit((data === null || data === void 0 ? void 0 : data.limit) || 100);
    if (data === null || data === void 0 ? void 0 : data.pageToken) {
        // Basic pagination mock (replace with real document reference in production)
        // For simplicity, we assume we just return the first set.
    }
    const snapshot = await query.get();
    const users = await Promise.all(snapshot.docs.map(async (doc) => {
        const profile = doc.data();
        const creditSnap = await firebase_admin_1.adminDb.collection("users").doc(doc.id).collection("creditSummary").doc("current").get();
        const credits = creditSnap.exists ? creditSnap.data() : { availableCredits: 0 };
        return {
            id: doc.id,
            email: profile.email || "",
            displayName: profile.displayName || "",
            credits: (credits === null || credits === void 0 ? void 0 : credits.availableCredits) || 0,
            role: profile.role || "user"
        };
    }));
    return { users };
});
exports.listAllTransactions = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        limit: zod_1.z.number().max(500).default(100)
    }).optional()
}, async (data, { auth }) => {
    requireAdmin(auth);
    const snapshot = await firebase_admin_1.adminDb.collection("paddle_events")
        .orderBy("occurredAt", "desc")
        .limit((data === null || data === void 0 ? void 0 : data.limit) || 100)
        .get();
    return { transactions: snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data()))) };
});
exports.adminSetUserTokens = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        targetUserId: zod_1.z.string(),
        tokensToSet: zod_1.z.number()
    })
}, async ({ targetUserId, tokensToSet }, { auth }) => {
    requireAdmin(auth);
    const creditRef = firebase_admin_1.adminDb.collection("users").doc(targetUserId).collection("creditSummary").doc("current");
    const ledgerRef = firebase_admin_1.adminDb.collection("users").doc(targetUserId).collection("creditLedger").doc();
    await firebase_admin_1.adminDb.runTransaction(async (t) => {
        var _a;
        const doc = await t.get(creditRef);
        let currentCredits = 0;
        if (doc.exists) {
            currentCredits = ((_a = doc.data()) === null || _a === void 0 ? void 0 : _a.availableCredits) || 0;
        }
        const diff = tokensToSet - currentCredits;
        if (diff === 0)
            return;
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
//# sourceMappingURL=admin.js.map