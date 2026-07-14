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
exports.getSourcesStatus = exports.calculateCbam = exports.getCbamCases = exports.deleteCbamCase = exports.archiveCbamCase = exports.renameCbamCase = exports.getCbamCase = exports.saveCbamCase = void 0;
const wrapper_1 = require("../wrapper");
const zod_1 = require("zod");
const https_1 = require("firebase-functions/v2/https");
const case_repository_1 = require("../cbam/storage/case-repository");
const schema_1 = require("../cbam/schema");
function parseCaseData(data, uid, caseId) {
    const parsed = schema_1.AuditReadyCaseSchema.safeParse(Object.assign(Object.assign(Object.assign({}, data), { ownerId: uid }), (caseId ? { caseId } : {})));
    if (!parsed.success) {
        throw new https_1.HttpsError("invalid-argument", `Case data is invalid: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
    }
    return parsed.data;
}
exports.saveCbamCase = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({
        caseId: zod_1.z.string().optional(),
        data: zod_1.z.unknown()
    })
}, async ({ caseId, data }, { auth }) => {
    if (caseId) {
        const existing = await (0, case_repository_1.getCase)(caseId);
        if (!existing || existing.uid !== auth.uid) {
            throw new https_1.HttpsError("not-found", "Case not found or access denied.");
        }
        if (existing.status !== "DRAFT") {
            throw new https_1.HttpsError("failed-precondition", "Only a draft case can be edited.");
        }
        const parsedData = parseCaseData(data, auth.uid, caseId);
        await (0, case_repository_1.updateCase)(caseId, auth.uid, parsedData);
        return { caseId, status: "success" };
    }
    const parsedData = parseCaseData(data, auth.uid);
    const newCase = await (0, case_repository_1.createCase)(auth.uid, parsedData);
    return { caseId: newCase.caseId, status: "success" };
});
exports.getCbamCase = (0, wrapper_1.createCallable)({ schema: zod_1.z.object({ caseId: zod_1.z.string() }) }, async ({ caseId }, { auth }) => {
    const cbamCase = await (0, case_repository_1.getCase)(caseId);
    if (!cbamCase || cbamCase.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Case not found or access denied.");
    }
    return {
        case: Object.assign(Object.assign({}, cbamCase.data), { caseId: cbamCase.caseId, ownerId: cbamCase.uid, recordStatus: cbamCase.status, createdAt: cbamCase.createdAt, updatedAt: cbamCase.updatedAt }),
        status: "success"
    };
});
exports.renameCbamCase = (0, wrapper_1.createCallable)({
    schema: zod_1.z.object({ caseId: zod_1.z.string(), newName: zod_1.z.string().min(1).max(200) })
}, async ({ caseId, newName }, { auth }) => {
    var _a;
    const existing = await (0, case_repository_1.getCase)(caseId);
    if (!existing || existing.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Case not found or access denied.");
    }
    if (existing.status !== "DRAFT") {
        throw new https_1.HttpsError("failed-precondition", "Only a draft case can be renamed.");
    }
    const updatedData = Object.assign(Object.assign({}, existing.data), { installation: Object.assign(Object.assign({}, existing.data.installation), { name: Object.assign(Object.assign({}, (_a = existing.data.installation) === null || _a === void 0 ? void 0 : _a.name), { value: newName }) }) });
    const parsedData = parseCaseData(updatedData, auth.uid, caseId);
    await (0, case_repository_1.updateCase)(caseId, auth.uid, parsedData);
    return { success: true };
});
exports.archiveCbamCase = (0, wrapper_1.createCallable)({ schema: zod_1.z.object({ caseId: zod_1.z.string() }) }, async ({ caseId }, { auth }) => {
    const existing = await (0, case_repository_1.getCase)(caseId);
    if (!existing || existing.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Case not found or access denied.");
    }
    const { adminDb } = await Promise.resolve().then(() => __importStar(require("../firebase-admin")));
    await adminDb.collection("cbam_cases").doc(caseId).update({
        status: "ARCHIVED",
        updatedAt: new Date().toISOString()
    });
    return { success: true };
});
exports.deleteCbamCase = (0, wrapper_1.createCallable)({ schema: zod_1.z.object({ caseId: zod_1.z.string() }) }, async ({ caseId }, { auth }) => {
    const existing = await (0, case_repository_1.getCase)(caseId);
    if (!existing || existing.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Case not found or access denied.");
    }
    if (existing.latestReleaseId) {
        throw new https_1.HttpsError("failed-precondition", "A dossier with sealed releases cannot be deleted. Archive it instead.");
    }
    const { adminDb } = await Promise.resolve().then(() => __importStar(require("../firebase-admin")));
    await adminDb.collection("cbam_cases").doc(caseId).delete();
    return { success: true };
});
exports.getCbamCases = (0, wrapper_1.createCallable)({}, async (_, { auth }) => {
    const cases = await (0, case_repository_1.getCasesForUser)(auth.uid);
    return { cases, status: "success" };
});
exports.calculateCbam = (0, wrapper_1.createCallable)({ schema: zod_1.z.object({ caseId: zod_1.z.string() }) }, async ({ caseId }, { auth }) => {
    const existing = await (0, case_repository_1.getCase)(caseId);
    if (!existing || existing.uid !== auth.uid) {
        throw new https_1.HttpsError("not-found", "Case not found or access denied.");
    }
    const parsedData = parseCaseData(existing.data, auth.uid, caseId);
    const { performDossierCalculations } = await Promise.resolve().then(() => __importStar(require("../cbam/calculator")));
    const calculation = performDossierCalculations(parsedData);
    return { calculation, status: "success" };
});
exports.getSourcesStatus = (0, wrapper_1.createCallable)({}, async () => {
    return {
        status: "success",
        ruleset: "EU-CBAM-DEFINITIVE-2026",
        sourceStatus: "VERSION_LOCKED",
    };
});
//# sourceMappingURL=cases.js.map