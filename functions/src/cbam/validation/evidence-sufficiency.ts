import type { AuditReadyCase } from "../schema";
import type { EvidenceSufficiencyRow } from "../report/premium-dossier-schema";
import { deriveMaterialRequirements } from "./material-input-registry";

function getValueAtPath(obj: any, path: string): any {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      current = current[match[1]]?.[parseInt(match[2], 10)];
    } else {
      current = current[part];
    }
  }
  return current;
}

export function runEvidenceSufficiency(caseData: AuditReadyCase): EvidenceSufficiencyRow[] {
  const requirements = deriveMaterialRequirements(caseData);
  const rows: EvidenceSufficiencyRow[] = [];

  for (const req of requirements) {
    const datum = getValueAtPath(caseData, req.inputPath);
    const isMaterial = req.requirementLevel === "MATERIAL_REQUIRED" || req.requirementLevel === "REQUIRED";

    let evidenceId: string | null = null;
    let datumExists = false;

    if (datum && typeof datum === "object") {
      datumExists = datum.value !== null && datum.value !== "" && datum.value !== undefined;
      evidenceId = datum.evidenceId || null;
    } else if (typeof datum === "string" && datum.trim().length > 0) {
      datumExists = true;
      if (req.inputPath.endsWith("EvidenceId")) {
        evidenceId = datum;
      } else {
        evidenceId = null;
      }
    }

    if (!datumExists) {
      rows.push({
        requirementId: req.requirementId,
        inputPath: req.inputPath,
        evidenceIds: [],
        state: "MISSING",
        coverageNumerator: "0.0",
        coverageDenominator: "1.0",
        blocksOperatorReadiness: isMaterial,
        blocksSealing: isMaterial,
        reasonCodes: ["INPUT_VALUE_MISSING"],
      });
      continue;
    }

    if (!evidenceId) {
      if (req.minimumEvidenceCount === 0) {
        rows.push({
          requirementId: req.requirementId,
          inputPath: req.inputPath,
          evidenceIds: [],
          state: "SUPPORTED",
          coverageNumerator: "1.0",
          coverageDenominator: "1.0",
          blocksOperatorReadiness: false,
          blocksSealing: false,
          reasonCodes: ["PASS"],
        });
      } else {
        rows.push({
          requirementId: req.requirementId,
          inputPath: req.inputPath,
          evidenceIds: [],
          state: "MISSING",
          coverageNumerator: "0.0",
          coverageDenominator: "1.0",
          blocksOperatorReadiness: isMaterial,
          blocksSealing: isMaterial,
          reasonCodes: ["EVIDENCE_ID_MISSING"],
        });
      }
      continue;
    }

    // Look up evidence in caseData
    const record = caseData.evidenceRegister.find((r) => r.evidenceId === evidenceId);
    if (!record) {
      rows.push({
        requirementId: req.requirementId,
        inputPath: req.inputPath,
        evidenceIds: [evidenceId],
        state: "MISSING",
        coverageNumerator: "0.0",
        coverageDenominator: "1.0",
        blocksOperatorReadiness: isMaterial,
        blocksSealing: isMaterial,
        reasonCodes: ["EVIDENCE_RECORD_NOT_FOUND"],
      });
      continue;
    }

    const reasonCodes: string[] = [];
    let state: EvidenceSufficiencyRow["state"] = "SUPPORTED";
    let blocksOperatorReadiness = false;
    let blocksSealing = false;

    // Check tenant/case isolation path
    const expectedPrefix = `evidence/${caseData.ownerId}/${caseData.caseId}/${record.evidenceId}/`;
    if (caseData.caseId && !record.storagePath.startsWith(expectedPrefix)) {
      state = "UNLINKED";
      reasonCodes.push("CROSS_TENANT_OR_CASE_MISMATCH");
    }

    // Check linked inputs
    if (!record.linkedInputs.includes(req.inputPath)) {
      state = "UNLINKED";
      reasonCodes.push("INPUT_PATH_NOT_LINKED_TO_EVIDENCE");
    }

    // Check file integrity
    if (!/^[a-f0-9]{64}$/i.test(record.fileHash)) {
      state = "HASH_MISMATCH";
      reasonCodes.push("INVALID_SHA256_HASH_FORMAT");
    }
    if (record.sizeBytes <= 0) {
      state = "BYTE_SIZE_MISMATCH";
      reasonCodes.push("ZERO_OR_NEGATIVE_BYTE_SIZE");
    }

    // Check malware
    if (record.malwareScanStatus === "PENDING") {
      state = "MALWARE_UNCLEARED";
      reasonCodes.push("MALWARE_SCAN_PENDING");
    } else if (record.malwareScanStatus === "INFECTED") {
      state = "MALWARE_UNCLEARED";
      reasonCodes.push("MALWARE_SCAN_INFECTED");
    }

    // Check review status
    if (record.reviewStatus !== "APPROVED") {
      state = "UNAPPROVED";
      reasonCodes.push("EVIDENCE_NOT_APPROVED_BY_OPERATOR");
    }

    // Check period alignment
    const caseYear = caseData.reportingPeriod.year.value;
    const caseQuarter = caseData.reportingPeriod.quarter.value || "ANNUAL";
    if (record.reportingPeriod && record.reportingPeriod.trim().length > 0) {
      const evidencePeriod = record.reportingPeriod.trim();
      if (!evidencePeriod.includes(String(caseYear)) && !evidencePeriod.includes(String(caseQuarter))) {
        state = "OUT_OF_PERIOD";
        reasonCodes.push("EVIDENCE_PERIOD_MISMATCH");
      }
    }

    // Check support status
    if (record.supportStatus === "PARTIALLY_SUPPORTED") {
      state = "PARTIALLY_SUPPORTED";
      reasonCodes.push("EVIDENCE_PARTIALLY_SUPPORTED_ONLY");
    } else if (record.supportStatus === "UNSUPPORTED") {
      state = "MISSING";
      reasonCodes.push("EVIDENCE_SUPPORT_STATUS_UNSUPPORTED");
    }

    // Determine blocks
    if (isMaterial) {
      if (state !== "SUPPORTED") {
        blocksSealing = true;
        // Partially supported also blocks readiness for material inputs
        blocksOperatorReadiness = true;
      }
    }

    let coverageNumerator = "0.0";
    if (state === "SUPPORTED") {
      coverageNumerator = "1.0";
    } else if (state === "PARTIALLY_SUPPORTED") {
      coverageNumerator = "0.5";
    }

    rows.push({
      requirementId: req.requirementId,
      inputPath: req.inputPath,
      evidenceIds: [evidenceId],
      state,
      coverageNumerator,
      coverageDenominator: "1.0",
      blocksOperatorReadiness,
      blocksSealing,
      reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["PASS"],
    });
  }

  return rows;
}
