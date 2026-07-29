export type SealLeaseView = {
  status?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
};

export function isSealLeaseHeldByOther(
  marker: SealLeaseView,
  claimant: string,
  now: Date
): boolean {
  if (marker.status !== "IN_PROGRESS" || marker.leaseOwner === claimant) return false;
  if (!marker.leaseExpiresAt) return false;
  const expiresAt = new Date(marker.leaseExpiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt > now.getTime();
}

export function assertCompleteArtifactCommit(
  expectedPaths: readonly string[],
  receipts: ReadonlyArray<{ path: string; sha256: string; sizeBytes: number }>
): void {
  const expected = [...expectedPaths].sort();
  const actual = receipts.map((entry) => entry.path).sort();
  if (
    expected.length !== actual.length ||
    expected.some((path, index) => path !== actual[index])
  ) {
    throw new Error("SEAL_ARTIFACT_COMMIT_INCOMPLETE");
  }
  for (const receipt of receipts) {
    if (!/^[a-f0-9]{64}$/.test(receipt.sha256) || !Number.isSafeInteger(receipt.sizeBytes) || receipt.sizeBytes <= 0) {
      throw new Error(`SEAL_ARTIFACT_RECEIPT_INVALID:${receipt.path}`);
    }
  }
}
