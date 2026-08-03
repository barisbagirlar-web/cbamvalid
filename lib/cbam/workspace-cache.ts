import {
  AuditReadyCaseSchema,
  type AuditReadyCase,
} from "@/lib/cbam/schema";

const CASE_CACHE_VERSION = 2;
const FAST_OPEN_MAX_AGE_MS = 5 * 60 * 1000;

type CaseCacheEnvelope = {
  version: typeof CASE_CACHE_VERSION;
  cachedAt: number;
  serverUpdatedAt?: string;
  value: AuditReadyCase;
};

type CaseLikeRecord = {
  caseId: string;
  data: AuditReadyCase;
  updatedAt?: string;
};

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cacheKey(caseId: string): string {
  return `cbam_case_cache_${caseId}`;
}

export function writeCaseWorkspaceCache(
  caseId: string,
  value: AuditReadyCase,
  serverUpdatedAt?: string
): void {
  if (!storageAvailable()) return;
  const parsed = AuditReadyCaseSchema.parse(value);
  const envelope: CaseCacheEnvelope = {
    version: CASE_CACHE_VERSION,
    cachedAt: Date.now(),
    serverUpdatedAt,
    value: parsed,
  };
  window.localStorage.setItem(cacheKey(caseId), JSON.stringify(envelope));
}

export function primeCaseWorkspaceCaches(records: CaseLikeRecord[]): void {
  if (!storageAvailable()) return;
  for (const record of records) {
    try {
      writeCaseWorkspaceCache(record.caseId, record.data, record.updatedAt);
    } catch (error) {
      console.warn("Failed to prime case workspace cache", record.caseId, error);
    }
  }
}

export function readFreshCaseWorkspaceCache(
  caseId: string,
  maxAgeMs = FAST_OPEN_MAX_AGE_MS
): AuditReadyCase | null {
  if (!storageAvailable()) return null;
  const raw = window.localStorage.getItem(cacheKey(caseId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CaseCacheEnvelope | AuditReadyCase;

    // Legacy raw-case cache remains readable but is not trusted for fast-open
    // because it has no freshness timestamp.
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      parsed.version !== CASE_CACHE_VERSION
    ) {
      return null;
    }

    const age = Date.now() - Number(parsed.cachedAt || 0);
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return null;
    return AuditReadyCaseSchema.parse(parsed.value);
  } catch (error) {
    console.warn("Failed to read case workspace cache", caseId, error);
    return null;
  }
}

export function clearCaseWorkspaceCache(caseId: string): void {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(cacheKey(caseId));
}
