import { listIndexablePublicCnEntries } from "./cn-public-registry";
import type { CbamCnPublicEntry } from "./types";

export const RELATED_CN_LINK_COUNT = 4;

/**
 * Deterministic ring links across the verified public CN allowlist.
 * The ring shape gives every eligible CN page multiple distinct inbound sources
 * instead of concentrating equity only on the first few codes in a sorted list.
 */
export function getRelatedCnEntries(
  currentCode: string,
  limit = RELATED_CN_LINK_COUNT,
): readonly CbamCnPublicEntry[] {
  const entries = [...listIndexablePublicCnEntries()].sort((a, b) =>
    a.cnCode.localeCompare(b.cnCode),
  );
  if (entries.length <= 1 || limit <= 0) return [];

  const normalized = currentCode.replace(/\s+/g, "");
  const currentIndex = entries.findIndex((entry) => entry.cnCode === normalized);
  if (currentIndex < 0) return [];

  const result: CbamCnPublicEntry[] = [];
  const seen = new Set<string>([normalized]);
  const offsets = [1, -1, 2, -2, 3, -3, 4, -4];

  for (const offset of offsets) {
    if (result.length >= Math.min(limit, entries.length - 1)) break;
    const index = (currentIndex + offset + entries.length) % entries.length;
    const candidate = entries[index];
    if (!candidate || seen.has(candidate.cnCode)) continue;
    seen.add(candidate.cnCode);
    result.push(candidate);
  }

  return result;
}
