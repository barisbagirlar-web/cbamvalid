/**
 * G-09 — temporal integrity and leak scan. D-08.
 *
 * Sealed packages are fail-closed on time-stamp contradictions and carry
 * findings for suspiciously small evidence and out-of-window dates:
 *   - a signature/review timestamp later than generatedAt blocks the package;
 *   - evidence files smaller than 20 KB raise EVIDENCE_SUSPICIOUSLY_SMALL;
 *   - any date outside the reporting period ± 24 months raises a finding.
 */
import type { AuditReadyCase } from "../../schema";

export const EVIDENCE_SMALL_BYTE_THRESHOLD = 20 * 1024;
export const DATE_WINDOW_MONTHS = 24;

export interface TemporalIntegrityResult {
  /** Fail-closed errors: when non-empty the package must not be produced. */
  readonly errors: readonly string[];
  /** Findings: recorded but non-blocking. */
  readonly findings: readonly string[];
  readonly smallEvidence: readonly { evidenceId: string; sizeBytes: number }[];
  readonly outOfWindowDates: readonly string[];
}

export function checkTemporalIntegrity(
  caseData: AuditReadyCase,
  generatedAt: string
): TemporalIntegrityResult {
  const errors: string[] = [];
  const findings: string[] = [];
  const smallEvidence: { evidenceId: string; sizeBytes: number }[] = [];
  const outOfWindowDates: string[] = [];

  const generatedAtMs = Date.parse(generatedAt);
  if (Number.isNaN(generatedAtMs)) {
    return { errors: ["GENERATED_AT_INVALID"], findings: [], smallEvidence: [], outOfWindowDates: [] };
  }

  const afterGeneratedAt = (label: string, timestamp: string | undefined): void => {
    if (!timestamp) return;
    const ms = Date.parse(timestamp);
    if (!Number.isNaN(ms) && ms > generatedAtMs) {
      errors.push(`${label} (${timestamp}) is later than package generatedAt (${generatedAt}) — SIGNATURE_TIMESTAMP_INVALID`);
    }
  };

  for (const signOff of caseData.operatorSignOffs ?? []) {
    afterGeneratedAt(`Operator sign-off ${signOff.role}`, signOff.signedAt);
  }

  for (const record of caseData.evidenceRegister) {
    afterGeneratedAt(`Evidence ${record.evidenceId} review`, record.reviewedAt);
    afterGeneratedAt(`Evidence ${record.evidenceId} upload`, record.uploadTimestamp);
    afterGeneratedAt(`Evidence ${record.evidenceId} quality assessment`, record.qualityAssessedAt);
    if (record.sizeBytes > 0 && record.sizeBytes < EVIDENCE_SMALL_BYTE_THRESHOLD) {
      smallEvidence.push({ evidenceId: record.evidenceId, sizeBytes: record.sizeBytes });
      findings.push(
        `EVIDENCE_SUSPICIOUSLY_SMALL: evidence ${record.evidenceId} is ${record.sizeBytes} bytes (< ${EVIDENCE_SMALL_BYTE_THRESHOLD} KB)`
      );
    }
  }

  for (const event of caseData.auditEvents ?? []) {
    afterGeneratedAt(`Audit event ${event.eventId}`, event.timestamp);
  }

  const startMs = Date.parse(String(caseData.reportingPeriod.startDate?.value ?? ""));
  const endMs = Date.parse(String(caseData.reportingPeriod.endDate?.value ?? ""));
  if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
    const windowStart = new Date(startMs);
    windowStart.setUTCMonth(windowStart.getUTCMonth() - DATE_WINDOW_MONTHS);
    const windowEnd = new Date(endMs);
    windowEnd.setUTCMonth(windowEnd.getUTCMonth() + DATE_WINDOW_MONTHS);
    const inWindow = (date: string | null | undefined): boolean => {
      if (!date) return true;
      const ms = Date.parse(date);
      return !Number.isNaN(ms) && ms >= windowStart.getTime() && ms <= windowEnd.getTime();
    };
    for (const record of caseData.evidenceRegister) {
      if (!inWindow(record.issueDate)) {
        outOfWindowDates.push(`Evidence ${record.evidenceId} issueDate ${record.issueDate}`);
      }
      if (!inWindow(record.evidencePeriodStart) || !inWindow(record.evidencePeriodEnd)) {
        outOfWindowDates.push(`Evidence ${record.evidenceId} period ${record.evidencePeriodStart ?? ""}..${record.evidencePeriodEnd ?? ""}`);
      }
    }
  }
  for (const date of outOfWindowDates) {
    findings.push(`DATE_OUTSIDE_REPORTING_WINDOW: ${date}`);
  }

  return { errors, findings, smallEvidence, outOfWindowDates };
}
