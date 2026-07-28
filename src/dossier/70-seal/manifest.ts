/**
 * Manifest builder helpers for sealed packages (L7).
 */
import { createHash } from "node:crypto";

export interface ManifestFileEntry {
  readonly path: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface IntegrityManifest {
  readonly schema: "CBAMVALID-MANIFEST-1";
  readonly files: readonly ManifestFileEntry[];
  readonly manifestHash: string;
}

export function sha256Hex(bytes: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildIntegrityManifest(
  files: ReadonlyArray<{ path: string; bytes: Buffer | Uint8Array }>
): IntegrityManifest {
  const entries: ManifestFileEntry[] = files
    .map((f) => ({
      path: f.path,
      sha256: sha256Hex(f.bytes),
      sizeBytes: f.bytes.byteLength,
    }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const canonical = JSON.stringify({ schema: "CBAMVALID-MANIFEST-1", files: entries });
  return {
    schema: "CBAMVALID-MANIFEST-1",
    files: entries,
    manifestHash: sha256Hex(canonical),
  };
}
