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
const case_repository_1 = require("../cbam/storage/case-repository");
const PREPARATION_PACK_PRODUCT = "CBAM_CREDIT_PACK_5";
function errorMessage(error, fallback) {
    return error instanceof Error ? error.message : fallback;
}
exports.getEntitlements = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const snapshot = await firebase_admin_1.adminDb.collection("entitlements")
        .where("uid", "==", auth.uid)
        .where("status", "==", "AVAILABLE")
        .get();
    const entitlements = snapshot.docs.map((doc) => doc.data());
    return { entitlements, status: "success" };
});
exports.createCheckoutSession = (0, wrapper_1.createCallable)({
    secrets: ["PADDLE_API_KEY"],
    schema: zod_1.z.object({
        productCode: zod_1.z.literal(PREPARATION_PACK_PRODUCT),
        caseId: zod_1.z.string().min(1)
    })
}, async ({ productCode, caseId }, { auth }) => {
    const { createCheckout } = await Promise.resolve().then(() => __importStar(require("../commerce/paddle/checkout-service")));
    try {
        const transactionId = await createCheckout(auth.uid, auth.token.email || "", productCode, { caseId });
        return { transactionId, status: "success" };
    }
    catch (error) {
        const message = errorMessage(error, "Checkout could not be started.");
        console.error("[CHECKOUT] Server-side checkout creation failed:", message);
        throw new https_1.HttpsError("failed-precondition", message);
    }
});
/**
 * Backward-compatible conversion of historical account credits. The resulting
 * five versions are bound to one owned draft dossier, matching new purchases.
 */
exports.unlockCbamUses = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        requestId: zod_1.z.string().min(1),
        caseId: zod_1.z.string().min(1),
    })
}, async ({ requestId, caseId }, { auth }) => {
    try {
        const cbamCase = await (0, case_repository_1.verifyCaseOwner)(caseId, auth.uid);
        if (cbamCase.status !== "DRAFT") {
            throw new https_1.HttpsError("failed-precondition", "Historical credits can only unlock an active draft dossier.");
        }
        return await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
            var _a, _b;
            const idempotencyRef = firebase_admin_1.adminDb.collection("idempotency").doc(`unlock_${auth.uid}_${caseId}_${requestId}`);
            const idempotencyDoc = await dbTransaction.get(idempotencyRef);
            if (idempotencyDoc.exists) {
                return { status: "success", message: "Already unlocked" };
            }
            const creditRef = firebase_admin_1.adminDb.collection("users").doc(auth.uid).collection("creditSummary").doc("current");
            const creditDoc = await dbTransaction.get(creditRef);
            const availableCredits = creditDoc.exists ? Number(((_a = creditDoc.data()) === null || _a === void 0 ? void 0 : _a.availableCredits) || 0) : 0;
            if (availableCredits < 100) {
                throw new https_1.HttpsError("failed-precondition", "Insufficient historical account balance. 100 credits are required to unlock five report versions.");
            }
            const now = new Date().toISOString();
            dbTransaction.set(creditRef, {
                availableCredits: availableCredits - 100,
                lifetimeConsumed: Number(((_b = creditDoc.data()) === null || _b === void 0 ? void 0 : _b.lifetimeConsumed) || 0) + 100,
                updatedAt: now
            }, { merge: true });
            const ledgerRef = firebase_admin_1.adminDb.collection("users").doc(auth.uid).collection("creditLedger").doc();
            dbTransaction.set(ledgerRef, {
                uid: auth.uid,
                caseId,
                amount: -100,
                reason: "CBAM_PREPARATION_PACK_UNLOCK",
                requestId,
                createdAt: now,
                balanceAfter: availableCredits - 100
            });
            for (let sequence = 1; sequence <= 5; sequence += 1) {
                const entitlementId = `ent_unlock_${requestId}_${sequence}`;
                const entitlementRef = firebase_admin_1.adminDb.collection("entitlements").doc(entitlementId);
                dbTransaction.set(entitlementRef, {
                    entitlementId,
                    uid: auth.uid,
                    orderId: `UNLOCK_${requestId}`,
                    caseId,
                    productCode: PREPARATION_PACK_PRODUCT,
                    status: "AVAILABLE",
                    quantity: 1,
                    versionSequence: sequence,
                    createdAt: now,
                    updatedAt: now,
                });
            }
            dbTransaction.set(idempotencyRef, {
                processedAt: now,
                uid: auth.uid,
                caseId,
                requestId,
            });
            return { status: "success", message: "Successfully unlocked five case-bound report versions." };
        });
    }
    catch (error) {
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", errorMessage(error, "Historical credit unlock failed."));
    }
});
//# sourceMappingURL=commerce.js.map