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
exports.sealCbamReport = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        caseId: zod_1.z.string(),
        entitlementId: zod_1.z.string()
    })
}, async ({ caseId, entitlementId }, { auth }) => {
    const { sealReport } = await Promise.resolve().then(() => __importStar(require("../cbam/report/seal-service")));
    try {
        const report = await sealReport({
            uid: auth.uid,
            caseId,
            entitlementId,
            inputData: undefined
        });
        return { report, status: "success" };
    }
    catch (err) {
        throw new https_1.HttpsError("internal", err.message);
    }
});
exports.getCbamReports = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const snapshot = await firebase_admin_1.adminDb.collection("cbam_reports").where("uid", "==", auth.uid).get();
    const reports = snapshot.docs.map(doc => doc.data());
    return { reports, status: "success" };
});
exports.getCbamReport = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({ reportId: zod_1.z.string() })
}, async ({ reportId }, { auth }) => {
    const doc = await firebase_admin_1.adminDb.collection("cbam_reports").doc(reportId).get();
    const report = doc.data();
    if (!report || report.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Report not found or access denied.");
    }
    return { report, status: "success" };
});
exports.getReportDownloadUrl = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({ reportId: zod_1.z.string(), format: zod_1.z.string() })
}, async ({ reportId, format }, { auth }) => {
    const doc = await firebase_admin_1.adminDb.collection("cbam_reports").doc(reportId).get();
    const report = doc.data();
    if (!report || report.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Report not found or access denied.");
    }
    const { getStorage } = await Promise.resolve().then(() => __importStar(require("firebase-admin/storage")));
    const { getApp } = await Promise.resolve().then(() => __importStar(require("firebase-admin/app")));
    let ext = format;
    if (format === "xlsx")
        ext = "xls";
    const filePath = `reports/${auth.uid}/${reportId}/dossier.${ext}`;
    const bucket = getStorage(getApp()).bucket();
    const file = bucket.file(filePath);
    const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: Date.now() + 15 * 60 * 1000,
    });
    return { url, status: "success" };
});
//# sourceMappingURL=reports.js.map