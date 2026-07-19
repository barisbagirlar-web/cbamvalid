import type { AuditReadyCase } from "../schema";
import type { EvidenceSufficiencyRow } from "../report/premium-dossier-schema";
import { deriveMaterialRequirements } from "./material-input-registry";

function parsePeriodDates(periodStr: string): { start: string; end: string } | null {
  const str = periodStr.trim().toUpperCase();
  // Check ANNUAL
  let match = str.match(/^(\d{4})\s*ANNUAL$/) || str.match(/^(\d{4})$/);
  if (match) {
    return { start: `${match[1]}-01-01`, end: `${match[1]}-12-31` };
  }
  // Check Q1-Q4
  match = str.match(/^(\d{4})-(Q[1-4])$/) || str.match(/^(\d{4})\s*(Q[1-4])$/);
  if (match) {
    const year = match[1];
    const q = match[2];
    if (q === "Q1") return { start: `${year}-01-01`, end: `${year}-03-31` };
    if (q === "Q2") return { start: `${year}-04-01`, end: `${year}-06-30` };
    if (q === "Q3") return { start: `${year}-07-01`, end: `${year}-09-30` };
    if (q === "Q4") return { start: `${year}-10-01`, end: `${year}-12-31` };
  }
  // Check MONTHLY (e.g. 2026-03)
  match = str.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (match) {
    const year = match[1];
    const month = match[2];
    const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
    return { start: `${year}-${month}-01`, end: `${year}-${month}-${String(lastDay).padStart(2, "0")}` };
  }
  return null;
}

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

    // Check period alignment and exact coverage
    const caseYear = caseData.reportingPeriod.year.value;
    const caseQuarter = caseData.reportingPeriod.quarter.value || "ANNUAL";

    const requiredPeriodStart = String(caseData.reportingPeriod.startDate?.value || parsePeriodDates(`${caseYear}-${caseQuarter}`)?.start || `${caseYear}-01-01`);
    const requiredPeriodEnd = String(caseData.reportingPeriod.endDate?.value || parsePeriodDates(`${caseYear}-${caseQuarter}`)?.end || `${caseYear}-12-31`);

    let evidencePeriodStart: string | null = record.evidencePeriodStart || null;
    let evidencePeriodEnd: string | null = record.evidencePeriodEnd || null;

    if (!evidencePeriodStart || !evidencePeriodEnd) {
      const parsed = parsePeriodDates(record.reportingPeriod);
      if (parsed) {
        evidencePeriodStart = evidencePeriodStart || parsed.start;
        evidencePeriodEnd = evidencePeriodEnd || parsed.end;
      }
    }

    let coverageDays: number | null = null;
    let coveragePercent: string | null = null;

    if (evidencePeriodStart && evidencePeriodEnd) {
      const reqStart = new Date(requiredPeriodStart);
      const reqEnd = new Date(requiredPeriodEnd);
      const evStart = new Date(evidencePeriodStart);
      const evEnd = new Date(evidencePeriodEnd);

      const overlapStart = new Date(Math.max(reqStart.getTime(), evStart.getTime()));
      const overlapEnd = new Date(Math.min(reqEnd.getTime(), evEnd.getTime()));

      if (overlapStart <= overlapEnd) {
        const overlapMs = overlapEnd.getTime() - overlapStart.getTime() + 24 * 60 * 60 * 1000;
        coverageDays = Math.ceil(overlapMs / (24 * 60 * 60 * 1000));
      } else {
        coverageDays = 0;
      }

      const reqMs = reqEnd.getTime() - reqStart.getTime() + 24 * 60 * 60 * 1000;
      const reqDays = Math.ceil(reqMs / (24 * 60 * 60 * 1000));
      coveragePercent = ((coverageDays / reqDays) * 100).toFixed(2);

      // Verify exact period alignment
      // Case is ANNUAL, evidence must cover the full required period unless reconciled
      if (caseQuarter === "ANNUAL" && coverageDays < reqDays) {
        const hasReconciliation = caseData.methodologyDecisions.some(
          d => d.topic === "EVIDENCE_RECONCILIATION" && d.reviewStatus === "ACCEPTED"
        );
        if (!hasReconciliation) {
          state = "OUT_OF_PERIOD";
          reasonCodes.push("EVIDENCE_ANNUAL_COVERAGE_INCOMPLETE");
        }
      }
    } else {
      // Fallback old includes check if dates are not parseable
      if (record.reportingPeriod && record.reportingPeriod.trim().length > 0) {
        const evidencePeriod = record.reportingPeriod.trim();
        if (!evidencePeriod.includes(String(caseYear)) && !evidencePeriod.includes(String(caseQuarter))) {
          state = "OUT_OF_PERIOD";
          reasonCodes.push("EVIDENCE_PERIOD_MISMATCH");
        }
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
        // Partially supported and out of period also blocks readiness for material inputs
        blocksOperatorReadiness = true;
      }
    }

    let coverageNumerator = "0.0";
    let coverageDenominator = "1.0";
    if (coverageDays !== null && coveragePercent !== null) {
      coverageNumerator = coverageDays.toString();
      const reqMs = new Date(requiredPeriodEnd).getTime() - new Date(requiredPeriodStart).getTime() + 24 * 60 * 60 * 1000;
      const reqDays = Math.ceil(reqMs / (24 * 60 * 60 * 1000));
      coverageDenominator = reqDays.toString();
    } else {
      if (state === "SUPPORTED") {
        coverageNumerator = "1.0";
      } else if (state === "PARTIALLY_SUPPORTED") {
        coverageNumerator = "0.5";
      }
    }

    rows.push({
      requirementId: req.requirementId,
      inputPath: req.inputPath,
      evidenceIds: [evidenceId],
      state,
      coverageNumerator,
      coverageDenominator,
      blocksOperatorReadiness,
      blocksSealing,
      reasonCodes: reasonCodes.length > 0 ? reasonCodes : ["PASS"],
      evidencePeriodStart,
      evidencePeriodEnd,
      coverageDays,
      requiredPeriodStart,
      requiredPeriodEnd,
      coveragePercent,
    });
  }

  return rows;
}
