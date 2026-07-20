import type { AuditReadyCase } from "../schema";
import type { EvidenceSufficiencyRow, EvidenceCoverageAssessment } from "../premium-dossier-model";
import { deriveMaterialRequirements } from "./material-input-registry";

function parsePeriodDates(periodStr: unknown): { start: string; end: string } | null {
  if (typeof periodStr !== "string") return null;
  const str = periodStr.trim().toUpperCase();
  if (!str) return null;

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

function getValueAtPath(obj: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    const match = part.match(/^(\w+)\[(\d+)\]$/);
    if (match) {
      const arr = (current as Record<string, unknown>)[match[1]];
      current = Array.isArray(arr) ? arr[parseInt(match[2], 10)] : undefined;
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }
  return current;
}

const STATE_SEVERITY: Record<string, number> = {
  MISSING: 10,
  UNLINKED: 9,
  HASH_MISMATCH: 8,
  BYTE_SIZE_MISMATCH: 7,
  MALWARE_UNCLEARED: 6,
  UNAPPROVED: 5,
  PARTIALLY_SUPPORTED: 4,
  OUT_OF_PERIOD: 3,
  SUPPORTED: 1,
};

function calculateIntervalUnionCoverage(
  inputPath: string,
  requiredStartStr: string,
  requiredEndStr: string,
  validRecords: Array<{ id: string; start: string; end: string }>
): EvidenceCoverageAssessment {
  const reqStart = new Date(requiredStartStr);
  const reqEnd = new Date(requiredEndStr);

  const reqMs = reqEnd.getTime() - reqStart.getTime() + 24 * 60 * 60 * 1000;
  const requiredDays = Math.ceil(reqMs / (24 * 60 * 60 * 1000));

  // 1. Clip intervals to required period
  const clipped: Array<{ start: Date; end: Date; id: string }> = [];
  for (const rec of validRecords) {
    const evStart = new Date(rec.start);
    const evEnd = new Date(rec.end);

    const overlapStart = new Date(Math.max(reqStart.getTime(), evStart.getTime()));
    const overlapEnd = new Date(Math.min(reqEnd.getTime(), evEnd.getTime()));

    if (overlapStart <= overlapEnd) {
      clipped.push({ start: overlapStart, end: overlapEnd, id: rec.id });
    }
  }

  // 2. Sort intervals by start date
  clipped.sort((left, right) => left.start.getTime() - right.start.getTime());

  // 3. Merge overlaps/contiguous intervals
  const merged: Array<{ start: string; end: string; evidenceIds: string[] }> = [];
  for (const interval of clipped) {
    if (merged.length === 0) {
      merged.push({
        start: interval.start.toISOString().split("T")[0],
        end: interval.end.toISOString().split("T")[0],
        evidenceIds: [interval.id],
      });
    } else {
      const prev = merged[merged.length - 1];
      const prevEndMs = new Date(prev.end).getTime();
      const currentStartMs = interval.start.getTime();

      // Contiguous or overlapping (allowing 1 day gap to merge contiguous, e.g. Jan 31 and Feb 1)
      if (currentStartMs <= prevEndMs + 24 * 60 * 60 * 1000) {
        const maxEnd = new Date(Math.max(prevEndMs, interval.end.getTime()));
        prev.end = maxEnd.toISOString().split("T")[0];
        if (!prev.evidenceIds.includes(interval.id)) {
          prev.evidenceIds.push(interval.id);
        }
      } else {
        merged.push({
          start: interval.start.toISOString().split("T")[0],
          end: interval.end.toISOString().split("T")[0],
          evidenceIds: [interval.id],
        });
      }
    }
  }

  // 4. Calculate Unique Covered Days
  let coveredDays = 0;
  for (const prev of merged) {
    const startMs = new Date(prev.start).getTime();
    const endMs = new Date(prev.end).getTime();
    const diffMs = endMs - startMs + 24 * 60 * 60 * 1000;
    coveredDays += Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  }

  // 5. Detect Uncovered Gaps
  const uncovered: Array<{ start: string; end: string; missingDays: number }> = [];
  let currentExpected = reqStart.getTime();

  for (const interval of merged) {
    const intStartMs = new Date(interval.start).getTime();
    const intEndMs = new Date(interval.end).getTime();

    if (intStartMs > currentExpected) {
      const gapStart = new Date(currentExpected);
      const gapEnd = new Date(intStartMs - 24 * 60 * 60 * 1000);
      const gapMs = gapEnd.getTime() - gapStart.getTime() + 24 * 60 * 60 * 1000;
      const missingDays = Math.ceil(gapMs / (24 * 60 * 60 * 1000));
      uncovered.push({
        start: gapStart.toISOString().split("T")[0],
        end: gapEnd.toISOString().split("T")[0],
        missingDays,
      });
    }
    currentExpected = intEndMs + 24 * 60 * 60 * 1000;
  }

  if (currentExpected <= reqEnd.getTime()) {
    const gapStart = new Date(currentExpected);
    const gapEnd = reqEnd;
    const gapMs = gapEnd.getTime() - gapStart.getTime() + 24 * 60 * 60 * 1000;
    const missingDays = Math.ceil(gapMs / (24 * 60 * 60 * 1000));
    uncovered.push({
      start: gapStart.toISOString().split("T")[0],
      end: gapEnd.toISOString().split("T")[0],
      missingDays,
    });
  }

  const coveragePercent = ((coveredDays / requiredDays) * 100).toFixed(2);
  const complete = coveragePercent === "100.00" && uncovered.length === 0;

  return {
    inputPath,
    requiredPeriodStart: requiredStartStr,
    requiredPeriodEnd: requiredEndStr,
    requiredDays,
    coveredDays,
    coveragePercent,
    mergedIntervals: merged,
    uncoveredIntervals: uncovered,
    supportingEvidenceIds: validRecords.map(r => r.id),
    complete,
  };
}

export function runEvidenceSufficiency(caseData: AuditReadyCase, _assessmentTimestamp?: string): EvidenceSufficiencyRow[] {
  const requirements = deriveMaterialRequirements(caseData);
  const rows: EvidenceSufficiencyRow[] = [];

  for (const req of requirements) {
    const datum = getValueAtPath(caseData, req.inputPath);
    const isMaterial = req.requirementLevel === "MATERIAL_REQUIRED" || req.requirementLevel === "REQUIRED";

    let datumEvidenceId: string | null = null;
    let datumExists = false;

    if (datum && typeof datum === "object") {
      const obj = datum as Record<string, unknown>;
      datumExists = obj.value !== null && obj.value !== "" && obj.value !== undefined;
      datumEvidenceId = (obj.evidenceId as string) || null;
    } else if (typeof datum === "string" && datum.trim().length > 0) {
      datumExists = true;
      if (req.inputPath.endsWith("EvidenceId")) {
        datumEvidenceId = datum;
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

    // Collect all evidence explicitly linked to this input path
    const linkedEvidenceIds = new Set<string>();
    if (datumEvidenceId) {
      linkedEvidenceIds.add(datumEvidenceId);
    }
    caseData.evidenceRegister.forEach((rec) => {
      if (rec.linkedInputs.includes(req.inputPath)) {
        linkedEvidenceIds.add(rec.evidenceId);
      }
    });

    if (linkedEvidenceIds.size === 0) {
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

    const caseYear = caseData.reportingPeriod.year.value;
    const caseQuarter = caseData.reportingPeriod.quarter.value || "ANNUAL";
    const requiredPeriodStart = String(caseData.reportingPeriod.startDate?.value || parsePeriodDates(`${caseYear}-${caseQuarter}`)?.start || `${caseYear}-01-01`);
    const requiredPeriodEnd = String(caseData.reportingPeriod.endDate?.value || parsePeriodDates(`${caseYear}-${caseQuarter}`)?.end || `${caseYear}-12-31`);

    const reqMs = new Date(requiredPeriodEnd).getTime() - new Date(requiredPeriodStart).getTime() + 24 * 60 * 60 * 1000;
    const requiredDays = Math.ceil(reqMs / (24 * 60 * 60 * 1000));

    let worstState: EvidenceSufficiencyRow["state"] = "SUPPORTED";
    const allReasonCodes = new Set<string>();
    const validIntervalsForUnion: Array<{ id: string; start: string; end: string }> = [];

    for (const evidenceId of linkedEvidenceIds) {
      const record = caseData.evidenceRegister.find((r) => r.evidenceId === evidenceId);
      if (!record) {
        worstState = "MISSING";
        allReasonCodes.add("EVIDENCE_RECORD_NOT_FOUND");
        continue;
      }

      let recordState: EvidenceSufficiencyRow["state"] = "SUPPORTED";
      const recordReasons: string[] = [];

      // Check tenant/case isolation path
      const expectedPrefix = `evidence/${caseData.ownerId}/${caseData.caseId}/${record.evidenceId}/`;
      if (caseData.caseId && !record.storagePath.startsWith(expectedPrefix)) {
        recordState = "UNLINKED";
        recordReasons.push("CROSS_TENANT_OR_CASE_MISMATCH");
      }

      // Check linked inputs
      if (!record.linkedInputs.includes(req.inputPath)) {
        recordState = "UNLINKED";
        recordReasons.push("INPUT_PATH_NOT_LINKED_TO_EVIDENCE");
      }

      // Check file integrity
      if (!/^[a-f0-9]{64}$/i.test(record.fileHash)) {
        recordState = "HASH_MISMATCH";
        recordReasons.push("INVALID_SHA256_HASH_FORMAT");
      }
      if (record.sizeBytes <= 0) {
        recordState = "BYTE_SIZE_MISMATCH";
        recordReasons.push("ZERO_OR_NEGATIVE_BYTE_SIZE");
      }

      // Check malware
      if (record.malwareScanStatus === "PENDING") {
        recordState = "MALWARE_UNCLEARED";
        recordReasons.push("MALWARE_SCAN_PENDING");
      } else if (record.malwareScanStatus === "INFECTED") {
        recordState = "MALWARE_UNCLEARED";
        recordReasons.push("MALWARE_SCAN_INFECTED");
      }

      // Check review status
      if (record.reviewStatus !== "APPROVED") {
        recordState = "UNAPPROVED";
        recordReasons.push("EVIDENCE_NOT_APPROVED_BY_OPERATOR");
      }

      // Parse dates for this specific evidence record
      let evStart = record.evidencePeriodStart || null;
      let evEnd = record.evidencePeriodEnd || null;

      if (!evStart || !evEnd) {
        const parsed = parsePeriodDates(record.reportingPeriod);
        if (parsed) {
          evStart = evStart || parsed.start;
          evEnd = evEnd || parsed.end;
        }
      }

      if (!evStart || !evEnd) {
        recordState = "OUT_OF_PERIOD";
        recordReasons.push("EVIDENCE_PERIOD_UNPARSEABLE");
      }

      // Check support status
      if (record.supportStatus === "PARTIALLY_SUPPORTED") {
        recordState = "PARTIALLY_SUPPORTED";
        recordReasons.push("EVIDENCE_PARTIALLY_SUPPORTED_ONLY");
      } else if (record.supportStatus === "UNSUPPORTED") {
        recordState = "MISSING";
        recordReasons.push("EVIDENCE_SUPPORT_STATUS_UNSUPPORTED");
      }

      // If this record had any invalidation, update worstState
      if (recordState !== "SUPPORTED") {
        if (STATE_SEVERITY[recordState] > STATE_SEVERITY[worstState]) {
          worstState = recordState;
        }
        recordReasons.forEach(r => allReasonCodes.add(r));
      } else if (evStart && evEnd) {
        validIntervalsForUnion.push({ id: evidenceId, start: evStart, end: evEnd });
      }
    }

    // Now assess union coverage using only the valid intervals
    const coverageAssessment = calculateIntervalUnionCoverage(
      req.inputPath,
      requiredPeriodStart,
      requiredPeriodEnd,
      validIntervalsForUnion
    );

    // If all individual records were valid but union doesn't cover 100.00%, row state becomes OUT_OF_PERIOD
    if (worstState === "SUPPORTED" && !coverageAssessment.complete) {
      worstState = "OUT_OF_PERIOD";
      allReasonCodes.add("EVIDENCE_ANNUAL_COVERAGE_INCOMPLETE");
    }

    const blocksSealing = isMaterial && worstState !== "SUPPORTED";
    const blocksOperatorReadiness = isMaterial && worstState !== "SUPPORTED";

    rows.push({
      requirementId: req.requirementId,
      inputPath: req.inputPath,
      evidenceIds: Array.from(linkedEvidenceIds),
      state: worstState,
      coverageNumerator: coverageAssessment.coveredDays.toString(),
      coverageDenominator: requiredDays.toString(),
      blocksOperatorReadiness,
      blocksSealing,
      reasonCodes: allReasonCodes.size > 0 ? Array.from(allReasonCodes) : ["PASS"],
      evidencePeriodStart: validIntervalsForUnion[0]?.start || null,
      evidencePeriodEnd: validIntervalsForUnion[0]?.end || null,
      coverageDays: coverageAssessment.coveredDays,
      requiredPeriodStart,
      requiredPeriodEnd,
      coveragePercent: coverageAssessment.coveragePercent,
      coverageAssessment,
    });
  }

  return rows;
}
