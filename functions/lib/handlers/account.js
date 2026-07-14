"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestAccountClosure = exports.listPurchaseHistory = exports.listCreditLedger = exports.updateOwnProfile = exports.getAccountOverview = void 0;
const wrapper_1 = require("../wrapper");
const zod_1 = require("zod");
const firebase_admin_1 = require("../firebase-admin");
exports.getAccountOverview = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const uid = auth.uid;
    // 1. Fetch user profile and auth data securely
    const [profileSnap, creditSnap] = await Promise.all([
        firebase_admin_1.adminDb.collection("users").doc(uid).get(),
        firebase_admin_1.adminDb.collection("users").doc(uid).collection("creditSummary").doc("current").get()
    ]);
    const profile = profileSnap.exists ? profileSnap.data() : { email: auth.token.email };
    const credits = creditSnap.exists ? creditSnap.data() : {
        availableCredits: 0,
        lifetimePurchased: 0,
        lifetimeConsumed: 0,
        lifetimeAdjusted: 0,
        lifetimeRefunded: 0
    };
    return {
        profile: {
            displayName: (profile === null || profile === void 0 ? void 0 : profile.displayName) || "",
            company: (profile === null || profile === void 0 ? void 0 : profile.company) || "",
            country: (profile === null || profile === void 0 ? void 0 : profile.country) || "",
            email: auth.token.email,
            emailVerified: auth.token.email_verified || false,
        },
        credits
    };
});
exports.updateOwnProfile = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        displayName: zod_1.z.string().optional(),
        company: zod_1.z.string().optional(),
        country: zod_1.z.string().optional()
    })
}, async (data, { auth }) => {
    const uid = auth.uid;
    const updateData = { updatedAt: new Date().toISOString() };
    if (data.displayName !== undefined)
        updateData.displayName = data.displayName;
    if (data.company !== undefined)
        updateData.company = data.company;
    if (data.country !== undefined)
        updateData.country = data.country;
    await firebase_admin_1.adminDb.collection("users").doc(uid).set(updateData, { merge: true });
    return { success: true };
});
exports.listCreditLedger = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        limit: zod_1.z.number().max(100).default(50)
    }).optional()
}, async (data, { auth }) => {
    const limitCount = (data === null || data === void 0 ? void 0 : data.limit) || 50;
    const snapshot = await firebase_admin_1.adminDb.collection("users").doc(auth.uid)
        .collection("creditLedger")
        .orderBy("createdAt", "desc")
        .limit(limitCount)
        .get();
    return { ledger: snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data()))) };
});
exports.listPurchaseHistory = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        limit: zod_1.z.number().max(100).default(50)
    }).optional()
}, async (data, { auth }) => {
    const limitCount = (data === null || data === void 0 ? void 0 : data.limit) || 50;
    const snapshot = await firebase_admin_1.adminDb.collection("paddle_events")
        .where("uid", "==", auth.uid)
        .orderBy("occurredAt", "desc")
        .limit(limitCount)
        .get();
    return { history: snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data()))) };
});
exports.requestAccountClosure = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const uid = auth.uid;
    // Create an explicit closure request record that an admin can review
    await firebase_admin_1.adminDb.collection("account_closures").doc(uid).set({
        uid,
        email: auth.token.email,
        requestedAt: new Date().toISOString(),
        status: "PENDING"
    });
    return { success: true };
});
//# sourceMappingURL=account.js.map