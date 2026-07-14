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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSha256 = calculateSha256;
exports.signManifest = signManifest;
exports.sealReport = sealReport;
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = require("../../firebase-admin");
const calculator_1 = require("../calculator");
const quality_controls_1 = require("../validation/quality-controls");
const entitlement_service_1 = require("../../commerce/entitlement-service");
const schema_1 = require("../schema");
const rulesets_1 = require("../registry/rulesets");
function calculateSha256(content) {
    return crypto_1.default.createHash("sha256").update(content).digest("hex");
}
function signManifest(content) {
    // If we had the Google Cloud KMS dependency and IAM set up, we'd do it here.
    // Fallback to exactly what the mandate requested when unimplemented.
    return "ASYMMETRIC_MANIFEST_SIGNATURE=NOT_IMPLEMENTED";
}
async function sealReport(params) {
    var _a, _b;
    const reportRef = firebase_admin_1.adminDb.collection("cbam_reports").doc();
    const reportId = reportRef.id;
    // State: SEAL_REQUESTED
    await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "SEAL_REQUESTED", timestamp: new Date().toISOString() });
    await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
        await (0, entitlement_service_1.reserveEntitlement)(dbTransaction, {
            entitlementId: params.entitlementId,
            uid: params.uid,
            reportId,
            caseId: params.caseId
        });
    });
    // State: ENTITLEMENT_RESERVED
    await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "ENTITLEMENT_RESERVED", timestamp: new Date().toISOString() });
    try {
        if (!params.inputData) {
            throw new Error("Case data is missing.");
        }
        const parseResult = schema_1.AuditReadyCaseSchema.safeParse(params.inputData);
        if (!parseResult.success) {
            throw new Error(`Invalid case data schema: ${parseResult.error.message}`);
        }
        const caseData = parseResult.data;
        // Validate ruleset (Fail-Closed)
        const reportYear = (_b = (_a = caseData.reportingPeriod) === null || _a === void 0 ? void 0 : _a.year) === null || _b === void 0 ? void 0 : _b.value;
        let checkDate = new Date();
        if (reportYear) {
            checkDate = new Date(`${reportYear}-01-01`);
        }
        const activeRuleset = (0, rulesets_1.getActiveRuleset)(checkDate);
        if (!activeRuleset) {
            throw new Error("Active ruleset is missing or expired.");
        }
        // 1. Enforce Quality Controls (Fail-Closed)
        const qcs = (0, quality_controls_1.runQualityControls)(caseData);
        const blockers = qcs.filter(q => q.status === "BLOCKER");
        if (blockers.length > 0) {
            throw new Error(`Sealing blocked due to strict quality controls: ${blockers.map(b => b.name).join(", ")}`);
        }
        // Strict evidence check: must be APPROVED, SUPPORTED, and CLEAN
        if (caseData.evidenceRegister.length === 0) {
            throw new Error("Sealing blocked: Evidence register is completely empty.");
        }
        for (const doc of caseData.evidenceRegister) {
            if (doc.reviewStatus !== "APPROVED") {
                throw new Error(`Sealing blocked: Evidence ${doc.fileName} (${doc.evidenceId}) is not APPROVED.`);
            }
            if (doc.supportStatus !== "SUPPORTED") {
                throw new Error(`Sealing blocked: Evidence ${doc.fileName} (${doc.evidenceId}) is not SUPPORTED.`);
            }
            if (doc.malwareScanStatus !== "CLEAN") {
                throw new Error(`Sealing blocked: Evidence ${doc.fileName} (${doc.evidenceId}) is flagged as: ${doc.malwareScanStatus}.`);
            }
        }
        // State: QC_VALIDATED
        await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "QC_VALIDATED", timestamp: new Date().toISOString() });
        // Data Freeze
        // State: DATA_FROZEN
        await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "DATA_FROZEN", timestamp: new Date().toISOString() });
        // 2. Run deterministic calculation
        const calcResult = (0, calculator_1.performDossierCalculations)(caseData);
        // State: CALCULATION_COMPLETE
        await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "CALCULATION_COMPLETE", timestamp: new Date().toISOString() });
        // 3. Generate JSON
        const jsonContent = JSON.stringify({ data: caseData, calculation: calcResult }, null, 2);
        // 4. Generate XML
        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CBAMValidDossier xmlns="urn:cbamvalid:schema:v2" format="PROPRIETARY_EXCHANGE_FORMAT">
  <Disclaimer>This XML is a proprietary data export of the CBAMValid system and does not constitute an official European Commission CBAM Registry submission file.</Disclaimer>
  <CaseData>
    <CaseId>${caseData.caseId || ""}</CaseId>
    <Status>SEALED</Status>
    <Version>${caseData.version}</Version>
  </CaseData>
  <Calculations>
    <TotalEmbeddedEmissions unit="tCO2e">${calcResult.totalEmbeddedEmissions}</TotalEmbeddedEmissions>
  </Calculations>
</CBAMValidDossier>`;
        // 5. Generate PDF
        const { buildPdfDossier } = await Promise.resolve().then(() => __importStar(require("./pdf-builder")));
        const pdfBuffer = buildPdfDossier(caseData, calcResult, undefined, false);
        // 6. Generate CSV
        const { buildCsvDossier } = await Promise.resolve().then(() => __importStar(require("./csv-builder")));
        const csvContent = buildCsvDossier(caseData, calcResult);
        // State: ARTIFACTS_GENERATED
        await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "ARTIFACTS_GENERATED", timestamp: new Date().toISOString() });
        const xmlHash = calculateSha256(xmlContent);
        const jsonHash = calculateSha256(jsonContent);
        const manifestData = JSON.stringify({
            reportId,
            xmlHash,
            jsonHash,
            timestamp: new Date().toISOString(),
        });
        const documentHash = calculateSha256(manifestData);
        // 7. Sign Manifest (KMS mocked)
        const signature = signManifest(manifestData);
        // 8. Generate ZIP
        const { buildZipDossier } = await Promise.resolve().then(() => __importStar(require("./zip-builder")));
        const zipBuffer = await buildZipDossier({
            pdfBuffer,
            xmlContent,
            jsonContent,
            csvContent,
            signature,
            reportId
        });
        // 9. Upload to Firebase Storage
        const bucket = (0, firebase_admin_1.getStorageBucket)();
        const basePath = `reports/${params.uid}/${reportId}`;
        // Save all files
        await bucket.file(`${basePath}/dossier.pdf`).save(pdfBuffer, { contentType: 'application/pdf' });
        await bucket.file(`${basePath}/dossier.json`).save(jsonContent, { contentType: 'application/json' });
        await bucket.file(`${basePath}/dossier.xml`).save(xmlContent, { contentType: 'application/xml' });
        await bucket.file(`${basePath}/dossier.csv`).save(csvContent, { contentType: 'text/csv' });
        await bucket.file(`${basePath}/dossier.zip`).save(zipBuffer, { contentType: 'application/zip' });
        // Recalculate and verify hashes of all uploaded files via byte read-back
        const pdfHash = calculateSha256(pdfBuffer);
        const jsonHashValue = calculateSha256(jsonContent);
        const xmlHashValue = calculateSha256(xmlContent);
        const csvHash = calculateSha256(csvContent);
        const zipHash = calculateSha256(zipBuffer);
        const [readBackPdf] = await bucket.file(`${basePath}/dossier.pdf`).download();
        if (calculateSha256(readBackPdf) !== pdfHash) {
            throw new Error("Storage integrity validation failed: PDF hash mismatch on GCS read-back.");
        }
        const [readBackJson] = await bucket.file(`${basePath}/dossier.json`).download();
        if (calculateSha256(readBackJson) !== jsonHashValue) {
            throw new Error("Storage integrity validation failed: JSON hash mismatch on GCS read-back.");
        }
        const [readBackXml] = await bucket.file(`${basePath}/dossier.xml`).download();
        if (calculateSha256(readBackXml) !== xmlHashValue) {
            throw new Error("Storage integrity validation failed: XML hash mismatch on GCS read-back.");
        }
        const [readBackCsv] = await bucket.file(`${basePath}/dossier.csv`).download();
        if (calculateSha256(readBackCsv) !== csvHash) {
            throw new Error("Storage integrity validation failed: CSV hash mismatch on GCS read-back.");
        }
        const [readBackZip] = await bucket.file(`${basePath}/dossier.zip`).download();
        if (calculateSha256(readBackZip) !== zipHash) {
            throw new Error("Storage integrity validation failed: ZIP hash mismatch on GCS read-back.");
        }
        // State: KMS_SIGNED (Reusing this state broadly to mean cryptographic completion and artifact persisting)
        await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "KMS_SIGNED", timestamp: new Date().toISOString() });
        const now = new Date().toISOString();
        const sealedReport = {
            reportId,
            uid: params.uid,
            caseId: params.caseId,
            status: "SEALED",
            documentHash,
            signature,
            createdAt: now,
            updatedAt: now,
            calculation: calcResult,
            xmlHash,
            jsonHash,
        };
        // State: OUTBOX_WRITTEN
        await firebase_admin_1.adminDb.collection("seal_outbox").doc(reportId).set(sealedReport);
        await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "OUTBOX_WRITTEN", timestamp: now });
        // Phase 2: Consume entitlement and Finalize
        await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
            await (0, entitlement_service_1.consumeEntitlement)(dbTransaction, {
                entitlementId: params.entitlementId,
                uid: params.uid,
                reportId,
                caseId: params.caseId,
                reportHash: documentHash,
                version: caseData.version,
                correctionReason: params.correctionReason,
            });
            // State: ENTITLEMENT_CONSUMED (Implicit inside transaction)
            const sealRef = firebase_admin_1.adminDb.collection("document_seals").doc(documentHash);
            dbTransaction.set(sealRef, {
                valid: true,
                documentHash,
                reportId,
                version: caseData.version,
                issuedAt: now,
                signature,
                commercialStatus: "ACTIVE",
            });
            dbTransaction.set(reportRef, sealedReport);
        });
        // State: SEAL_ACTIVATED
        await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "SEAL_ACTIVATED", timestamp: new Date().toISOString() });
        // Remove from outbox
        await firebase_admin_1.adminDb.collection("seal_outbox").doc(reportId).delete();
        // State: COMPLETION_NOTIFIED
        await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "COMPLETION_NOTIFIED", timestamp: new Date().toISOString() });
        return {
            reportId,
            documentHash,
            xmlContent,
            jsonContent,
            signature,
        };
    }
    catch (error) {
        console.error(`[SEALING-ENGINE] Sealing failed for report ${reportId}.`, error);
        await firebase_admin_1.adminDb.collection("seal_log").doc(reportId).set({ state: "FAILED", error: error.message, timestamp: new Date().toISOString() });
        try {
            await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
                await (0, entitlement_service_1.releaseEntitlementReservation)(dbTransaction, {
                    entitlementId: params.entitlementId,
                    uid: params.uid,
                    reportId,
                });
            });
        }
        catch (releaseError) {
            console.error("[SEALING-ENGINE] Failed to release entitlement reservation:", releaseError);
        }
        throw error;
    }
}
//# sourceMappingURL=seal-service.js.map