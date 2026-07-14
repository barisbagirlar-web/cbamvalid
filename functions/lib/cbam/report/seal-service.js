"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSha256 = calculateSha256;
exports.sealReport = sealReport;
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = require("../../firebase-admin");
const storage_1 = require("firebase-admin/storage");
const app_1 = require("firebase-admin/app");
const calculator_1 = require("../calculator");
const quality_controls_1 = require("../validation/quality-controls");
const entitlement_service_1 = require("../../commerce/entitlement-service");
const schema_1 = require("../schema");
const package_contract_validator_1 = require("./package-contract-validator");
const verifier_package_builder_1 = require("./verifier-package-builder");
function calculateSha256(content) {
    return crypto_1.default.createHash("sha256").update(content).digest("hex");
}
function canonicalize(value) {
    if (Array.isArray(value))
        return value.map(canonicalize);
    if (value && typeof value === "object") {
        return Object.keys(value)
            .sort()
            .reduce((result, key) => {
            result[key] = canonicalize(value[key]);
            return result;
        }, {});
    }
    return value;
}
function deterministicReportId(uid, caseId, requestId) {
    return `rel_${calculateSha256(`${uid}:${caseId}:${requestId}`).slice(0, 32)}`;
}
function toResult(record) {
    return {
        reportId: record.reportId,
        releaseVersion: record.releaseVersion,
        documentHash: record.documentHash,
        manifestHash: record.manifestHash,
        packageTopLevelComponentCount: record.packageTopLevelComponentCount,
        verifiedFileCount: record.verifiedFileCount,
        status: "SEALED",
    };
}
async function loadEvidenceFiles(caseData) {
    const bucket = (0, storage_1.getStorage)((0, app_1.getApp)()).bucket();
    const files = [];
    for (const evidence of caseData.evidenceRegister) {
        if (!evidence.storagePath.startsWith(`evidence/${caseData.ownerId}/${caseData.caseId}/`)) {
            throw new Error(`EVIDENCE_STORAGE_PATH_OWNERSHIP_MISMATCH:${evidence.evidenceId}`);
        }
        const file = bucket.file(evidence.storagePath);
        const [exists] = await file.exists();
        if (!exists)
            throw new Error(`EVIDENCE_FILE_MISSING:${evidence.evidenceId}`);
        const [buffer] = await file.download();
        if (buffer.byteLength !== evidence.sizeBytes) {
            throw new Error(`EVIDENCE_FILE_SIZE_MISMATCH:${evidence.evidenceId}`);
        }
        if (calculateSha256(buffer) !== evidence.fileHash.toLowerCase()) {
            throw new Error(`EVIDENCE_FILE_HASH_MISMATCH:${evidence.evidenceId}`);
        }
        files.push({
            evidenceId: evidence.evidenceId,
            fileName: evidence.fileName,
            buffer,
            mimeType: evidence.mimeType,
            sourceHash: evidence.fileHash.toLowerCase(),
        });
    }
    return files;
}
async function writeState(reportId, state, extra = {}) {
    const timestamp = new Date().toISOString();
    const summaryRef = firebase_admin_1.adminDb.collection("seal_log").doc(reportId);
    const eventId = `${timestamp.replace(/[^0-9]/g, "")}_${crypto_1.default.randomUUID()}`;
    const event = Object.assign({ reportId, state, timestamp }, extra);
    await Promise.all([
        summaryRef.set(Object.assign({ reportId, currentState: state, updatedAt: timestamp }, extra), { merge: true }),
        summaryRef.collection("events").doc(eventId).set(event),
    ]);
}
async function activateOutbox(record) {
    const reportRef = firebase_admin_1.adminDb.collection("cbam_reports").doc(record.reportId);
    await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
        await (0, entitlement_service_1.consumeEntitlement)(dbTransaction, {
            entitlementId: record.entitlementId,
            uid: record.uid,
            caseId: record.caseId,
            reportId: record.reportId,
            reportHash: record.documentHash,
        });
        dbTransaction.set(firebase_admin_1.adminDb.collection("document_seals").doc(record.documentHash), {
            valid: true,
            documentHash: record.documentHash,
            manifestHash: record.manifestHash,
            reportId: record.reportId,
            caseId: record.caseId,
            releaseVersion: record.releaseVersion,
            issuedAt: record.createdAt,
            commercialStatus: "ACTIVE",
            verificationBoundary: "PREPARATION_FOR_INDEPENDENT_VERIFICATION",
        });
        dbTransaction.set(reportRef, record);
        dbTransaction.set(firebase_admin_1.adminDb.collection("cbam_cases").doc(record.caseId), {
            latestReleaseId: record.reportId,
            latestReleaseVersion: record.releaseVersion,
            updatedAt: record.updatedAt,
        }, { merge: true });
    });
    await writeState(record.reportId, "ENTITLEMENT_CONSUMED");
    await writeState(record.reportId, "SEAL_ACTIVATED");
    await firebase_admin_1.adminDb.collection("seal_outbox").doc(record.reportId).delete();
    await writeState(record.reportId, "COMPLETION_NOTIFIED");
    return toResult(record);
}
async function sealReport(params) {
    const reportId = deterministicReportId(params.uid, params.caseId, params.requestId);
    const reportRef = firebase_admin_1.adminDb.collection("cbam_reports").doc(reportId);
    const outboxRef = firebase_admin_1.adminDb.collection("seal_outbox").doc(reportId);
    const existingReport = await reportRef.get();
    if (existingReport.exists) {
        const existing = existingReport.data();
        if (existing.uid !== params.uid ||
            existing.caseId !== params.caseId ||
            existing.requestId !== params.requestId) {
            throw new Error("SEAL_REQUEST_ID_COLLISION");
        }
        if (existing.status !== "SEALED") {
            throw new Error("SEAL_EXISTING_REPORT_NOT_FINAL");
        }
        return toResult(existing);
    }
    const pendingOutbox = await outboxRef.get();
    if (pendingOutbox.exists) {
        const record = pendingOutbox.data();
        if (record.uid !== params.uid ||
            record.caseId !== params.caseId ||
            record.requestId !== params.requestId ||
            record.entitlementId !== params.entitlementId) {
            throw new Error("SEAL_OUTBOX_IDEMPOTENCY_MISMATCH");
        }
        return activateOutbox(record);
    }
    await writeState(reportId, "SEAL_REQUESTED", {
        uid: params.uid,
        caseId: params.caseId,
        requestId: params.requestId,
    });
    let reservationCreated = false;
    try {
        const parsed = schema_1.AuditReadyCaseSchema.safeParse(Object.assign(Object.assign({}, params.inputData), { caseId: params.caseId, ownerId: params.uid }));
        if (!parsed.success) {
            throw new Error(`CASE_SCHEMA_INVALID:${parsed.error.issues.map((issue) => issue.path.join(".")).join(",")}`);
        }
        const caseData = parsed.data;
        const qualityControls = (0, quality_controls_1.runQualityControls)(caseData);
        const unresolved = qualityControls.filter((item) => item.status === "BLOCKER" || item.status === "WARNING");
        if (unresolved.length > 0) {
            throw new Error(`SEALING_BLOCKED:${unresolved.map((item) => item.ruleId).join(",")}`);
        }
        await writeState(reportId, "QC_VALIDATED", { qualityControls });
        const evidenceFiles = await loadEvidenceFiles(caseData);
        const evidenceRootHash = calculateSha256(JSON.stringify(caseData.evidenceRegister.map((record) => record.fileHash.toLowerCase()).sort()));
        await writeState(reportId, "EVIDENCE_VERIFIED", {
            evidenceCount: evidenceFiles.length,
            evidenceRootHash,
        });
        const reservedEntitlement = await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
            return (0, entitlement_service_1.reserveEntitlement)(dbTransaction, {
                entitlementId: params.entitlementId,
                uid: params.uid,
                caseId: params.caseId,
                reportId,
            });
        });
        reservationCreated = true;
        const releaseVersion = Number(reservedEntitlement === null || reservedEntitlement === void 0 ? void 0 : reservedEntitlement.versionSequence);
        if (!Number.isInteger(releaseVersion) || releaseVersion < 1 || releaseVersion > 5) {
            throw new Error("ENTITLEMENT_VERSION_SEQUENCE_INVALID");
        }
        await writeState(reportId, "ENTITLEMENT_RESERVED", { releaseVersion });
        const caseSnapshot = JSON.stringify(canonicalize(caseData));
        const caseSnapshotHash = calculateSha256(caseSnapshot);
        await writeState(reportId, "DATA_FROZEN", { caseSnapshotHash });
        const calculation = (0, calculator_1.performDossierCalculations)(caseData);
        if (calculation.trace.length === 0 ||
            calculation.trace.some((node) => node.outputValue === "NOT_CALCULATED") ||
            !/^[a-f0-9]{64}$/i.test(calculation.calculationRootHash)) {
            throw new Error("CALCULATION_TRACE_INCOMPLETE");
        }
        await writeState(reportId, "CALCULATION_COMPLETE", {
            calculationRootHash: calculation.calculationRootHash,
            ruleset: calculation.ruleset,
            engineVersion: calculation.engineVersion,
        });
        const packageResult = await (0, verifier_package_builder_1.buildVerifierPreparationPackage)({
            releaseId: reportId,
            caseData: Object.assign(Object.assign({}, caseData), { version: releaseVersion }),
            calculation,
            qualityControls,
            evidenceFiles,
        });
        await writeState(reportId, "ARTIFACTS_GENERATED");
        const documentHash = calculateSha256(packageResult.zipBuffer);
        const verifiedFileCount = packageResult.manifest.files.length;
        const validation = await (0, package_contract_validator_1.validatePackageContract)(packageResult.zipBuffer, packageResult.manifest);
        if (!validation.success) {
            throw new Error(`VERIFIER_PACKAGE_CONTRACT_VIOLATION:${validation.failures.join(",")}`);
        }
        await writeState(reportId, "PACKAGE_VERIFIED", {
            documentHash,
            manifestHash: packageResult.manifestHash,
            packageTopLevelComponentCount: 27,
            verifiedFileCount,
        });
        const bucket = (0, storage_1.getStorage)((0, app_1.getApp)()).bucket();
        const basePath = `reports/${params.uid}/${reportId}`;
        await Promise.all([
            bucket.file(`${basePath}/verifier-preparation-package.zip`).save(packageResult.zipBuffer, {
                contentType: "application/zip",
                resumable: false,
                metadata: { cacheControl: "private, max-age=0, no-store" },
            }),
            bucket.file(`${basePath}/data-integrity-manifest.json`).save(JSON.stringify(packageResult.manifest, null, 2), {
                contentType: "application/json",
                resumable: false,
                metadata: { cacheControl: "private, max-age=0, no-store" },
            }),
        ]);
        const now = new Date().toISOString();
        const sealedReport = {
            reportId,
            releaseId: reportId,
            releaseVersion,
            requestId: params.requestId,
            entitlementId: params.entitlementId,
            uid: params.uid,
            caseId: params.caseId,
            status: "SEALED",
            documentHash,
            manifestHash: packageResult.manifestHash,
            caseSnapshotHash,
            evidenceRootHash,
            calculationRootHash: calculation.calculationRootHash,
            ruleset: calculation.ruleset,
            engineVersion: calculation.engineVersion,
            packageTopLevelComponentCount: 27,
            verifiedFileCount,
            storagePath: `${basePath}/verifier-preparation-package.zip`,
            manifestStoragePath: `${basePath}/data-integrity-manifest.json`,
            calculation,
            qualityControls,
            createdAt: now,
            updatedAt: now,
        };
        await outboxRef.set(sealedReport);
        await writeState(reportId, "OUTBOX_WRITTEN");
        return activateOutbox(sealedReport);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "SEALING_FAILED";
        console.error(`[SEALING-ENGINE] Sealing failed for report ${reportId}.`, error);
        await writeState(reportId, "FAILED", { error: message });
        if (reservationCreated) {
            try {
                await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
                    await (0, entitlement_service_1.releaseEntitlementReservation)(dbTransaction, {
                        entitlementId: params.entitlementId,
                        uid: params.uid,
                        caseId: params.caseId,
                        reportId,
                    });
                });
            }
            catch (releaseError) {
                console.error("[SEALING-ENGINE] Failed to release entitlement reservation:", releaseError);
            }
        }
        throw error;
    }
}
//# sourceMappingURL=seal-service.js.map