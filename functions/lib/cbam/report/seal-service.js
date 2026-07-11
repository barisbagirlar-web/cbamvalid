"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSha256 = calculateSha256;
exports.sealReport = sealReport;
const crypto_1 = __importDefault(require("crypto"));
const firebase_admin_1 = require("@/firebase-admin");
const calculation_orchestrator_1 = require("../engine/calculation-orchestrator");
const entitlement_service_1 = require("../../commerce/entitlement-service");
const pdf_builder_1 = require("./pdf-builder");
const workbook_builder_1 = require("./workbook-builder");
const xml_builder_1 = require("./xml-builder");
/**
 * Calculates SHA-256 hash of a buffer or string
 */
function calculateSha256(content) {
    return crypto_1.default.createHash("sha256").update(content).digest("hex");
}
/**
 * Orchestrates the two-phase sealing process with strict double-spend checks and ledger records
 */
async function sealReport(params) {
    const reportRef = firebase_admin_1.adminDb.collection("cbam_reports").doc();
    const reportId = reportRef.id;
    // Phase 1: Reserve the entitlement (Atomic)
    await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
        await (0, entitlement_service_1.reserveEntitlement)(dbTransaction, {
            entitlementId: params.entitlementId,
            uid: params.uid,
            reportId,
        });
    });
    try {
        // 1. Run deterministic CBAM calculation
        const calcInput = {
            role: params.inputData.role || "IMPORTER",
            importYear: params.inputData.importYear || 2026,
            importQuarter: params.inputData.importQuarter || 1,
            cnCode: params.inputData.cnCode,
            productionVolume: params.inputData.productionVolume,
            installationName: params.inputData.installationName,
            hasActualData: params.inputData.hasActualData || false,
            isVerified: params.inputData.isVerified || false,
            directEmissionsInput: params.inputData.directEmissions,
            electricityConsumedInput: params.inputData.electricityConsumed,
            gridEmissionFactorInput: params.inputData.gridEmissionFactor,
            isComplexGood: params.inputData.isComplexGood || false,
            precursorDirectEmissionsInput: params.inputData.precursorDirectEmissions,
            precursorIndirectEmissionsInput: params.inputData.precursorIndirectEmissions,
            carbonPricePaidInput: params.inputData.carbonPricePaid,
        };
        const calcResult = (0, calculation_orchestrator_1.orchestrateCalculation)(calcInput);
        if (calcResult.pathway.sealingBlocked) {
            throw new Error(`Sealing blocked: ${calcResult.pathway.remediationMessage}`);
        }
        // 2. Generate all machine-readable and print artifacts
        const xmlContent = (0, xml_builder_1.buildXml)(params.inputData, calcResult);
        const xlsxBuffer = (0, workbook_builder_1.buildWorkbook)(params.inputData, calcResult);
        const jsonContent = JSON.stringify({ data: params.inputData, calculation: calcResult }, null, 2);
        // Calculate preliminary hashes to inject into PDF
        const preHash = calculateSha256(xmlContent);
        const pdfBuffer = (0, pdf_builder_1.buildPdfDossier)(params.inputData, calcResult, preHash);
        // 3. Compute final cryptographic package manifest hash
        const pdfHash = calculateSha256(pdfBuffer);
        const xlsxHash = calculateSha256(xlsxBuffer);
        const xmlHash = calculateSha256(xmlContent);
        const jsonHash = calculateSha256(jsonContent);
        const manifestData = JSON.stringify({
            reportId,
            pdfHash,
            xlsxHash,
            xmlHash,
            jsonHash,
            timestamp: new Date().toISOString(),
        });
        const documentHash = calculateSha256(manifestData);
        // 4. Persist sealed report metadata
        const now = new Date().toISOString();
        const sealedReport = {
            reportId,
            uid: params.uid,
            caseId: params.caseId,
            status: "SEALED",
            documentHash,
            createdAt: now,
            updatedAt: now,
            calculation: calcResult,
            // In production these buffers are uploaded to secure Google Cloud Storage bucket
            // returning signed URLs. For metadata registry, we store their cryptographic hashes.
            pdfHash,
            xlsxHash,
            xmlHash,
            jsonHash,
        };
        // 5. Phase 2: Consume the entitlement and store the verification index record atomically
        await firebase_admin_1.adminDb.runTransaction(async (dbTransaction) => {
            // Finalize entitlement consumption
            await (0, entitlement_service_1.consumeEntitlement)(dbTransaction, {
                entitlementId: params.entitlementId,
                uid: params.uid,
                reportId,
                reportHash: documentHash,
            });
            // Write public document verification seal
            const sealRef = firebase_admin_1.adminDb.collection("document_seals").doc(documentHash);
            dbTransaction.set(sealRef, {
                valid: true,
                documentHash,
                reportId,
                version: 1,
                issuedAt: now,
                commercialStatus: "ACTIVE",
                methodologyVersion: "EU_CBAM_METHODOLOGY_2026_V1",
                regulatorySnapshotId: "SNAPSHOT_2026_V1",
            });
            // Save report
            dbTransaction.set(reportRef, sealedReport);
        });
        return {
            reportId,
            documentHash,
            pdfBuffer,
            xlsxBuffer,
            xmlContent,
            jsonContent,
        };
    }
    catch (error) {
        console.error(`[SEALING-ENGINE] Sealing failed for report ${reportId}. Releasing reservation.`, error);
        // Failure Recovery: Release the reservation lease back to AVAILABLE
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