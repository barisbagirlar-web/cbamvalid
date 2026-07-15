"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.unlockCbamUses = exports.createCheckoutSession = exports.getEntitlements = void 0;
const wrapper_1 = require("../wrapper");
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const firebase_admin_1 = require("../firebase-admin");
exports.getEntitlements = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const snapshot = await firebase_admin_1.adminDb.collection("entitlements")
        .where("uid", "==", auth.uid)
        .where("status", "==", "AVAILABLE")
        .get();
    const entitlements = snapshot.docs.map(doc => doc.data());
    return { entitlements, status: "success" };
});
exports.createCheckoutSession = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        productCode: zod_1.z.string(),
        caseId: zod_1.z.string()
    })
}, async ({ productCode, caseId }, { auth }) => {
    const { createCheckout } = await Promise.resolve().then(() => __importStar(require("../commerce/paddle/checkout-service")));
    try {
        const transactionId = await createCheckout(auth.uid, auth.token.email || "", productCode, { caseId });
        return { transactionId, status: "success" };
    }
    catch (err) {
        throw new https_1.HttpsError("internal", err.message);
    }
});
exports.unlockCbamUses = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        requestId: zod_1.z.string(), // Idempotency key
    })
}, async ({ requestId }, { auth }) => {
    try {
        return await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
            var _a, _b;
            // 1. Check idempotency
            const idempotencyRef = firebase_admin_1.adminDb.collection("idempotency").doc(`unlock_${requestId}`);
            const idempotencyDoc = await dbTransaction.get(idempotencyRef);
            if (idempotencyDoc.exists) {
                return { status: "success", message: "Already unlocked" };
            }
            // 2. Read user credit summary
            const creditRef = firebase_admin_1.adminDb.collection("users").doc(auth.uid).collection("creditSummary").doc("current");
            const creditDoc = await dbTransaction.get(creditRef);
            let availableCredits = 0;
            if (creditDoc.exists) {
                availableCredits = ((_a = creditDoc.data()) === null || _a === void 0 ? void 0 : _a.availableCredits) || 0;
            }
            // 3. Ensure sufficient credits (100 credits = 5 uses)
            if (availableCredits < 100) {
                throw new https_1.HttpsError("failed-precondition", "Insufficient general account credits. 100 credits are required to unlock 5 CBAM report uses.");
            }
            // 4. Deduct 100 credits
            dbTransaction.set(creditRef, {
                availableCredits: availableCredits - 100,
                lifetimeConsumed: (((_b = creditDoc.data()) === null || _b === void 0 ? void 0 : _b.lifetimeConsumed) || 0) + 100,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            const now = new Date().toISOString();
            // 5. Write to credit ledger
            const ledgerRef = firebase_admin_1.adminDb.collection("users").doc(auth.uid).collection("creditLedger").doc();
            dbTransaction.set(ledgerRef, {
                uid: auth.uid,
                amount: -100,
                reason: "CBAM_UNLOCK",
                requestId,
                createdAt: now,
                balanceAfter: availableCredits - 100
            });
            // 6. Issue exactly 5 CBAM report entitlements
            for (let i = 0; i < 5; i++) {
                const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc();
                dbTransaction.set(entitlementRef, {
                    entitlementId: entitlementRef.id,
                    uid: auth.uid,
                    orderId: `UNLOCK_${requestId}`,
                    productCode: "CBAM_EXPORTER_FINAL_REPORT",
                    status: "AVAILABLE",
                    quantity: 1,
                    createdAt: now,
                    updatedAt: now,
                });
            }
            // 7. Record idempotency
            dbTransaction.set(idempotencyRef, {
                processedAt: now,
                uid: auth.uid
            });
            return { status: "success", message: "Successfully unlocked 5 CBAM report uses." };
        });
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        throw new https_1.HttpsError("internal", err.message);
    }
});
//# sourceMappingURL=commerce.js.map