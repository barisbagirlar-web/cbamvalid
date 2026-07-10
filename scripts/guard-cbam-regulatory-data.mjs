import { getRegulatorySnapshot } from "../lib/cbam/regulatory/snapshot-service.ts";

console.log("[GUARD-DATA] Validating regulatory snapshot configurations...");

try {
  const snapshot = getRegulatorySnapshot("SNAPSHOT_2026_V1");
  if (!snapshot.snapshotId || !snapshot.legalVersion || !snapshot.sourceHashes) {
    console.error("[GUARD-DATA] [FAIL] Regulatory snapshot is missing required attributes.");
    process.exit(1);
  }
  
  if (Object.keys(snapshot.sourceHashes).length < 2) {
    console.error("[GUARD-DATA] [FAIL] Snapshot sourceHashes map has insufficient entries.");
    process.exit(1);
  }

  console.log("[GUARD-DATA] [SUCCESS] Regulatory snapshot verified successfully.");
  process.exit(0);
} catch (e) {
  console.error("[GUARD-DATA] [FAIL] Exception during validation:", e);
  process.exit(1);
}
