import {
  AuditReadyCaseSchema,
  type AuditReadyCase,
} from "@/lib/cbam/schema";

const CASE_CACHE_VERSION = 3;
const FAST_OPEN_MAX_AGE_MS = 5 * 60 * 1000;

type CaseCacheEnvelope = {
  version: typeof CASE_CACHE_VERSION;
  ownerUid: string;
  cachedAt: number;
  serverUpdatedAt?: string;
  value: AuditReadyCase;
};

function storageAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function cacheKey(ownerUid: string, caseId: string): string {
  return `cbam_case_cache_${ownerUid}_${caseId}`;
}

export function writeCaseWorkspaceCache(
  ownerUid: string,
  caseId: string,
  value: AuditReadyCase,
  serverUpdatedAt?: string
): void {
  if (!storageAvailable()) return;
  const parsed = AuditReadyCaseSchema.parse(value);
  const envelope: CaseCacheEnvelope = {
    version: CASE_CACHE_VERSION,
    ownerUid,
    cachedAt: Date.now(),
    serverUpdatedAt,
    value: parsed,
  };
  window.localStorage.setItem(cacheKey(ownerUid, caseId), JSON.stringify(envelope));
}

export function readFreshCaseWorkspaceCache(
  ownerUid: string,
  caseId: string,
  maxAgeMs = FAST_OPEN_MAX_AGE_MS
): AuditReadyCase | null {
  if (!storageAvailable()) return null;
  const raw = window.localStorage.getItem(cacheKey(ownerUid, caseId));
  if (!raw) return null;

  try {
    const candidate = JSON.parse(raw) as Partial<CaseCacheEnvelope>;
    if (
      candidate.version !== CASE_CACHE_VERSION ||
      candidate.ownerUid !== ownerUid ||
      typeof candidate.cachedAt !== "number" ||
      candidate.value == null
    ) {
      return null;
    }

    const age = Date.now() - candidate.cachedAt;
    if (!Number.isFinite(age) || age < 0 || age > maxAgeMs) return null;
    return AuditReadyCaseSchema.parse(candidate.value);
  } catch (error) {
    console.warn("Failed to read case workspace cache", caseId, error);
    return null;
  }
}

export function clearCaseWorkspaceCache(ownerUid: string, caseId: string): void {
  if (!storageAvailable()) return;
  window.localStorage.removeItem(cacheKey(ownerUid, caseId));
}
