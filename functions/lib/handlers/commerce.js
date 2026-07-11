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
exports.adminSetUserTokens = exports.createCheckoutSession = exports.getEntitlements = void 0;
const wrapper_1 = require("../wrapper");
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const firebase_admin_1 = require("@/firebase-admin");
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
    const { createCheckout } = await Promise.resolve().then(() => __importStar(require("@/commerce/paddle/checkout-service")));
    try {
        const transactionId = await createCheckout(auth.uid, auth.token.email || "", productCode, { caseId });
        return { transactionId, status: "success" };
    }
    catch (err) {
        throw new https_1.HttpsError("internal", err.message);
    }
});
exports.adminSetUserTokens = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        targetUserId: zod_1.z.string(),
        tokensToSet: zod_1.z.number()
    })
}, async ({ targetUserId, tokensToSet }, { auth }) => {
    if (auth.uid !== "rB98q8p7fWTh8Hl5X3jKkQGZXYO2") {
        // ignore
    }
    // Mock provisioning
    return { success: true };
});
//# sourceMappingURL=commerce.js.map