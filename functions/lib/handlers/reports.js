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
exports.getReportDownloadUrl = exports.getCbamReport = exports.getCbamReports = exports.sealCbamReport = void 0;
const wrapper_1 = require("../wrapper");
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const firebase_admin_1 = require("../firebase-admin");
const case_repository_1 = require("../cbam/storage/case-repository");
exports.sealCbamReport = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        caseId: zod_1.z.string().min(1),
        entitlementId: zod_1.z.string().min(1),
        requestId: zod_1.z.string().uuid()
    })
}, async ({ caseId, entitlementId, requestId }, { auth }) => {
    const { sealReport } = await Promise.resolve().then(() => __importStar(require("../cbam/report/seal-service")));
    try {
        const cbamCase = await (0, case_repository_1.verifyCaseOwner)(caseId, auth.uid);
        const report = await sealReport({
            uid: auth.uid,
            caseId,
            entitlementId,
            requestId,
            inputData: cbamCase.data,
        });
        return { report, status: "success" };
    }
    catch (err) {
        console.error("[SEAL-CALLABLE] Sealing failed:", (err === null || err === void 0 ? void 0 : err.message) || err);
        const message = String((err === null || err === void 0 ? void 0 : err.message) || "Sealing failed.");
        if (message.startsWith("SEALING_BLOCKED") || message.startsWith("CASE_SCHEMA_INVALID")) {
            throw new https_1.HttpsError("failed-precondition", message);
        }
        if (message.includes("Ownership") || message.includes("different dossier")) {
            throw new https_1.HttpsError("permission-denied", message);
        }
        throw new https_1.HttpsError("internal", message);
    }
});
exports.getCbamReports = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const snapshot = await firebase_admin_1.adminDb
        .collection("cbam_reports")
        .where("uid", "==", auth.uid)
        .get();
    const reports = snapshot.docs
        .map((doc) => doc.data())
        .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { reports, status: "success" };
});
exports.getCbamReport = (0, wrapper_1.createCallable)({ schema: zod_1.z.object({ reportId: zod_1.z.string().min(1) }) }, async ({ reportId }, { auth }) => {
    const doc = await firebase_admin_1.adminDb.collection("cbam_reports").doc(reportId).get();
    const report = doc.data();
    if (!report || report.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Report not found or access denied.");
    }
    return { report, status: "success" };
});
exports.getReportDownloadUrl = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        reportId: zod_1.z.string().min(1),
        format: zod_1.z.enum(["zip", "manifest"])
    })
}, async ({ reportId, format }, { auth }) => {
    const doc = await firebase_admin_1.adminDb.collection("cbam_reports").doc(reportId).get();
    const report = doc.data();
    if (!report || report.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Report not found or access denied.");
    }
    const { getStorage } = await Promise.resolve().then(() => __importStar(require("firebase-admin/storage")));
    const { getApp } = await Promise.resolve().then(() => __importStar(require("firebase-admin/app")));
    const filePath = format === "zip" ? report.storagePath : report.manifestStoragePath;
    if (!filePath) {
        throw new https_1.HttpsError("failed-precondition", "Requested release artifact is unavailable.");
    }
    const bucket = getStorage(getApp()).bucket();
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    if (!exists) {
        throw new https_1.HttpsError("not-found", "Requested release artifact was not found.");
    }
    const [url] = await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 15 * 60 * 1000,
        responseDisposition: `attachment; filename="${format === "zip" ? `CBAMValid_${reportId}_Verifier_Preparation_Package.zip` : `CBAMValid_${reportId}_Data_Integrity_Manifest.json`}"`,
    });
    return { url, status: "success" };
});
//# sourceMappingURL=reports.js.map