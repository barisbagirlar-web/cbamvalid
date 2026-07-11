import crypto from "crypto";
import { adminDb } from "@/firebase-admin";
import { orchestrateCalculation } from "../engine/calculation-orchestrator";
import { reserveEntitlement, consumeEntitlement, releaseEntitlementReservation } from "../../commerce/entitlement-service";
import { buildPdfDossier } from "./pdf-builder";
import { buildWorkbook } from "./workbook-builder";
import { buildXml } from "./xml-builder";

export interface SealingResult {
  reportId: string;
  documentHash: string;
  pdfBuffer: Buffer;
  xlsxBuffer: Buffer;
  xmlContent: string;
  jsonContent: string;
}

/**
 * Calculates SHA-256 hash of a buffer or string
 */
export function calculateSha256(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Orchestrates the two-phase sealing process with strict double-spend checks and ledger records
 */
export async function sealReport(params: {
  uid: string;
  caseId: string;
  entitlementId: string;
  inputData: any;
}): Promise<SealingResult> {
  const reportRef = adminDb.collection("cbam_reports").doc();
  const reportId = reportRef.id;

  // Phase 1: Reserve the entitlement (Atomic)
  await adminDb.runTransaction(async (dbTransaction: any) => {
    await reserveEntitlement(dbTransaction, {
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

    const calcResult = orchestrateCalculation(calcInput);

    if (calcResult.pathway.sealingBlocked) {
      throw new Error(`Sealing blocked: ${calcResult.pathway.remediationMessage}`);
    }

    // 2. Generate all machine-readable and print artifacts
    const xmlContent = buildXml(params.inputData, calcResult);
    const xlsxBuffer = buildWorkbook(params.inputData, calcResult);
    const jsonContent = JSON.stringify({ data: params.inputData, calculation: calcResult }, null, 2);

    // Calculate preliminary hashes to inject into PDF
    const preHash = calculateSha256(xmlContent);
    const pdfBuffer = buildPdfDossier(params.inputData, calcResult, preHash);

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
    await adminDb.runTransaction(async (dbTransaction: any) => {
      // Finalize entitlement consumption
      await consumeEntitlement(dbTransaction, {
        entitlementId: params.entitlementId,
        uid: params.uid,
        reportId,
        reportHash: documentHash,
      });

      // Write public document verification seal
      const sealRef = adminDb.collection("document_seals").doc(documentHash);
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

  } catch (error) {
    console.error(`[SEALING-ENGINE] Sealing failed for report ${reportId}. Releasing reservation.`, error);
    // Failure Recovery: Release the reservation lease back to AVAILABLE
    try {
      await adminDb.runTransaction(async (dbTransaction: any) => {
        await releaseEntitlementReservation(dbTransaction, {
          entitlementId: params.entitlementId,
          uid: params.uid,
          reportId,
        });
      });
    } catch (releaseError) {
      console.error("[SEALING-ENGINE] Failed to release entitlement reservation:", releaseError);
    }
    throw error;
  }
}
