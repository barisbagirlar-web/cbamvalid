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
exports.sealCbamReport = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        caseId: zod_1.z.string(),
        entitlementId: zod_1.z.string()
    })
}, async ({ caseId, entitlementId }, { auth }) => {
    // Actually implement the seal logic or import it.
    const { sealReport } = await Promise.resolve().then(() => __importStar(require("@/cbam/report/seal-service")));
    try {
        const report = await sealReport({
            uid: auth.uid,
            caseId,
            entitlementId,
            inputData: undefined // The sealService already fetches input data if not provided, or we can fetch it here. Actually we should fetch case data first. Let's fetch case data:
        });
        return { report, status: "success" };
    }
    catch (err) {
        throw new https_1.HttpsError("internal", err.message);
    }
});
exports.getCbamReports = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const { getSealedReportsForUser } = await Promise.resolve().then(() => __importStar(require("@/cbam/report/report-repository")));
    const reports = await getSealedReportsForUser(auth.uid);
    return { reports, status: "success" };
});
exports.getCbamReport = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({ reportId: zod_1.z.string() })
}, async ({ reportId }, { auth }) => {
    const { getSealedReport } = await Promise.resolve().then(() => __importStar(require("@/cbam/report/report-repository")));
    const report = await getSealedReport(reportId);
    if (!report || report.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Report not found or access denied.");
    }
    return { report, status: "success" };
});
exports.getReportDownloadUrl = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({ reportId: zod_1.z.string(), format: zod_1.z.string() })
}, async ({ reportId, format }, { auth }) => {
    const { getSealedReport } = await Promise.resolve().then(() => __importStar(require("@/cbam/report/report-repository")));
    const report = await getSealedReport(reportId);
    if (!report || report.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Report not found or access denied.");
    }
    // In a real implementation we would generate a signed URL here
    // For now we simulate it by returning a direct Firebase Storage URL or a mock
    const { getAdminDb } = await Promise.resolve().then(() => __importStar(require("@/firebase-admin")));
    // Actually we need `getStorage().bucket().file(...).getSignedUrl(...)`
    // Let's import getStorage from firebase-admin/storage
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
        expires: Date.now() + 15 * 60 * 1000, // 15 mins
    });
    return { url, status: "success" };
});
//# sourceMappingURL=reports.js.map